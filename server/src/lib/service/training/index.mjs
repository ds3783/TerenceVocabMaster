import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";
import {v4 as uuid} from "uuid";
import * as claude from "../../ai/claude.mjs";

const SQLS = {
    GET_LEXICON_BY_USER_ID: "SELECT * FROM user_lexicon WHERE `user_id`=?",
    GET_ALL_LEXICON: "SELECT * FROM voc_lexicon ORDER BY difficulty DESC",
    INSERT_USER_LEXICON: 'INSERT INTO user_lexicon(`id`,`user_id`,`lexicon_code`) VALUES(?,?,?)',
    DELETE_USER_LEXICON: 'DELETE FROM user_lexicon WHERE `user_id`=? AND `lexicon_code`=?',
    DELETE_NOT_ANSWERED_TOPICS_BY_LEXICON: 'DELETE FROM train_topic WHERE `user_id`=? AND `lexicon_code`=? AND `user_choice` IS NULL',
    GET_REMAINING_TOPICS: 'SELECT COUNT(*) FROM train_topic WHERE `user_id`=? AND `user_choice` IS NULL',
    GET_RANDOM_WORD_NOT_SELECTED: 'SELECT * FROM vocabulary v WHERE `lexicon`=? AND NOT EXISTS(SELECT 1 FROM train_topic t WHERE `user_id` = ? AND v.word = t.word ) ORDER BY RAND() LIMIT 1',
    GET_RANDOM_WORD: 'SELECT * FROM vocabulary v WHERE `lexicon`=?  ORDER BY RAND() LIMIT 1',
    GET_MAX_SEQUENCE_BY_USER: 'SELECT MAX(`sequence`) AS MAX_SEQUENCE FROM train_topic WHERE `user_id`=? ',
    INSERT_TOPIC: 'INSERT INTO train_topic(`id`,`user_id`,`lexicon_code`,`word`,`sequence`) VALUES(?,?,?,?,?)',
    GET_NON_OPTIONS_TOPICS: 'SELECT * FROM train_topic WHERE `user_id`=? AND `user_choice` IS NULL AND `options` IS NULL ORDER BY `sequence` LIMIT 10',
    UPDATE_TOPIC_OPTIONS: 'UPDATE train_topic SET `options`=?,`correct_choice`=? WHERE `id`=?'

};

const MIN_BUFFED_TOPICS = 100;

const TOPIC_PROMPT = "You need to give a single-choice answers to the following phrase and give 4 Chinese answers, and at least 1 answer has similar meanings, but only one answer is correct.Reply in format 'Answers: A. B. C. D. Correct: [ABCD]', phase:'${word}'";
const CACHE_CATEGORY = 'TOPIC_OPTIONS_GENERATION';

async function getUserSelection(user_id) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs = await DataBase.doQuery(conn, SQLS.GET_LEXICON_BY_USER_ID, [user_id]);
        let result = [];
        for (const r of rs) {
            result.push(r.lexicon_code);
        }
        return result;
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}

export async function getAllLexicon() {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        return await DataBase.doQuery(conn, SQLS.GET_ALL_LEXICON, []);
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}

async function fullfillTopics(userId) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        while (true) {
            let rs = await DataBase.doQuery(conn, SQLS.GET_NON_OPTIONS_TOPICS, [userId]);
            if (rs.length === 0) {
                break;
            }
            for (const r of rs) {
                //query cache for options
                //if not found, request ai                
                let prompt = TOPIC_PROMPT.replace('${word}', r.word);
                let res = await claude.request(prompt, {category: CACHE_CATEGORY, key: r.word});
                let valid = /^Answers:\nA. (.*)\nB. (.*)\nC. (.*)\nD. (.*)\n+Correct: [ABCD](\. .*)?$/.test(res);
                if (!valid) {
                    await claude.deleteCache(CACHE_CATEGORY, r.word);
                    NestiaWeb.logger.error('Invalid ai response:', res);
                    continue;
                }
                let options = res.match(/^Answers:\nA. (.*)\nB. (.*)\nC. (.*)\nD. (.*)\n+Correct: ([ABCD])(\. .*)?$/);
                let selections = [options[1], options[2], options[3], options[4]];
                selections = selections.map((item) => {
                    return item.replace(/\(.*\)/g, '').replace(/\s-.*$/,'').trim();
                });
                let correct = {A: 0, B: 1, C: 2, D: 3}[options[5]];
                let correctChoice = selections[correct];
                if (!correctChoice) {
                    await claude.deleteCache(CACHE_CATEGORY, r.word);
                    NestiaWeb.logger.error('Invalid ai response,NO correct answer found:', res);
                    continue;
                }
                //shuffle
                let shuffleTimes=Math.floor(Math.random()*10);
                for (let i = 0; i < shuffleTimes; i++) {
                    selections = selections.sort(() => (Math.random() * 10000) % 2 - 1);
                }
                for (let i = 0; i < selections.length; i++) {
                    if (selections[i] === correctChoice) {
                        correct = i;
                        break;
                    }
                }
                //update topic
                await DataBase.doQuery(conn, SQLS.UPDATE_TOPIC_OPTIONS, [JSON.stringify(selections), correct, r.id]);

            }


        }

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

}

async function generateTopics(userId, count) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    let remainingTopics = count;
    let lexiconList = await getUserSelection(userId);
    if (lexiconList.length === 0) {
        NestiaWeb.logger.info('User has no lexicon selected');
        return;
    }
    try {
        conn = await DataBase.borrow(dbName);
        //generate topics
        while (remainingTopics > 0) {

            //random select lexicon
            let lexicon = lexiconList[Math.floor(Math.random() * lexiconList.length)];
            let word = await DataBase.doQuery(conn, SQLS.GET_RANDOM_WORD_NOT_SELECTED, [lexicon, userId]);
            word = word[0];
            if (!word) {
                word = await DataBase.doQuery(conn, SQLS.GET_RANDOM_WORD, [lexicon]);
                word = word[0];
            }
            if (!word) {
                NestiaWeb.logger.error('No word found for lexicon:', lexicon);
                continue;
            }
            //fetch max  sequence
            let maxSeq = await DataBase.doQuery(conn, SQLS.GET_MAX_SEQUENCE_BY_USER, [userId]);
            if (!maxSeq || maxSeq.length === 0) {
                maxSeq = 0;
            } else {
                maxSeq = maxSeq[0]['MAX_SEQUENCE'] * 1 + 1;
            }
            //insert topic
            await DataBase.doQuery(conn, SQLS.INSERT_TOPIC, [uuid(), userId, lexicon, word.word, maxSeq]);
            remainingTopics--;
        }
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }


}

async function trainTopics(userId, lexiconUpdate) {


    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    let remainingTopics = 0;
    try {
        //delete topics that lexicons are  in lexiconUpdate.deleted  and not answered by user
        conn = await DataBase.borrow(dbName);
        for (const deletedLexicon of lexiconUpdate.deleted) {
            await DataBase.doQuery(conn, SQLS.DELETE_NOT_ANSWERED_TOPICS_BY_LEXICON, [userId,]);
        }
        //check user's not answered topics
        remainingTopics = await DataBase.doQuery(conn, SQLS.GET_REMAINING_TOPICS, [userId]);
        remainingTopics = remainingTopics[0]['COUNT(*)'];
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

    //if topics are less than threshold, generate new topics
    let toGenerate = MIN_BUFFED_TOPICS - remainingTopics;
    if (toGenerate > 0) {
        NestiaWeb.logger.info('Generate topics for user:', userId, 'toGenerate:', toGenerate);
        generateTopics(userId, toGenerate).then(() => {
            NestiaWeb.logger.info(`Finished generate [${toGenerate}] topics for user:`, userId);
            fullfillTopics(userId).then(() => {
                NestiaWeb.logger.info(`Finished fulfil topics for user:`, userId);
            });
        });
    } else {
        fullfillTopics(userId).then(() => {
            NestiaWeb.logger.info(`Finished fulfil topics for user:`, userId);
        });
    }
}

export async function getUserLexiconList(userId) {
    let userSelection = await getUserSelection(userId);
    let allLexicon = await getAllLexicon();
    let result = [];
    for (let lexicon of allLexicon) {
        lexicon.selected = !!userSelection.find((item) => item === lexicon.code);
        result.push(lexicon);
    }
    return result;
}


export async function setUserLexiconList(userId, lexiconList) {
    let userSelection = await getUserSelection(userId);
    let allLexicon = await getAllLexicon();
    for (const lexicon of lexiconList) {
        if (!allLexicon.find((item) => item.code === lexicon)) {
            throw new Error('Invalid lexicon code:' + lexicon);
        }
    }
    let deleted = [];
    let added = [];
    for (let lexicon of userSelection) {
        let found = false;
        for (let lexiconInList of lexiconList) {
            if (lexiconInList === lexicon) {
                found = true;
                break;
            }
        }
        if (!found) {
            deleted.push(lexicon);
        }
    }
    for (let lexicon of lexiconList) {
        let found = false;
        for (let lexiconInDb of userSelection) {
            if (lexiconInDb === lexicon) {
                found = true;
                break;
            }
        }
        if (!found) {
            added.push(lexicon);
        }
    }

    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        //insert added to db
        for (let lexicon of added) {
            await DataBase.doQuery(conn, SQLS.INSERT_USER_LEXICON, [uuid(), userId, lexicon]);
        }

        //delete deleted from db
        for (let lexicon of deleted) {
            await DataBase.doQuery(conn, SQLS.DELETE_USER_LEXICON, [userId, lexicon]);
        }

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

    let lexiconUpdate = {
        added: added,
        deleted: deleted
    };
    // trigger test topics generation
    await trainTopics(userId, lexiconUpdate);

    return lexiconUpdate;
}



