import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";
import {v4 as uuid} from "uuid";
import * as claude from "../../ai/claude.mjs";
import {insertMistake} from "./mistakes.mjs";

const SQLS = {
    GET_LEXICON_BY_USER_ID: "SELECT * FROM user_lexicon WHERE `user_id`=?",
    GET_ALL_LEXICON: "SELECT * FROM voc_lexicon ORDER BY difficulty DESC",
    INSERT_USER_LEXICON: 'INSERT INTO user_lexicon(`id`,`user_id`,`lexicon_code`) VALUES(?,?,?)',
    DELETE_USER_LEXICON: 'DELETE FROM user_lexicon WHERE `user_id`=? AND `lexicon_code`=?',
    DELETE_NOT_ANSWERED_TOPICS_BY_LEXICON: 'DELETE FROM train_topic WHERE `user_id`=? AND `lexicon_code`=? AND `user_choice` IS NULL',
    GET_REMAINING_TOPICS: 'SELECT COUNT(*) FROM train_topic WHERE `user_id`=? AND `user_choice` IS NULL',
    GET_RANDOM_WORD_NOT_SELECTED: 'SELECT * FROM vocabulary v WHERE `lexicon`=? AND NOT EXISTS(SELECT 1 FROM train_topic t WHERE `user_id` = ? AND v.word = t.word ) ORDER BY RAND() LIMIT 1',
    // GET_RANDOM_WORD: 'SELECT * FROM vocabulary v WHERE `lexicon`=?  ORDER BY RAND() LIMIT 1',
    GET_MAX_SEQUENCE_BY_USER: 'SELECT MAX(`sequence`) AS MAX_SEQUENCE FROM train_topic WHERE `user_id`=? ',
    INSERT_TOPIC: 'INSERT INTO train_topic(`id`,`user_id`,`lexicon_code`,`word`,`sequence`) VALUES(?,?,?,?,?)',
    GET_NON_OPTIONS_TOPICS: 'SELECT * FROM train_topic WHERE `user_id`=? AND `user_choice` IS NULL AND `options` IS NULL ORDER BY `sequence` LIMIT 10',
    GET_NEXT_TRAINED_TOPICS: 'SELECT * FROM train_topic WHERE `user_id`=? AND `sequence`>? AND `user_choice` IS NOT NULL AND `options` IS NOT NULL ORDER BY `sequence` ASC LIMIT 1',
    GET_NEXT_TRAINING_TOPICS: 'SELECT * FROM train_topic WHERE `user_id`=? AND `user_choice` IS NULL AND `options` IS NOT NULL ORDER BY `sequence` ASC LIMIT 1',
    GET_PREV_TRAINING_TOPICS: 'SELECT * FROM train_topic WHERE `user_id`=? AND `user_choice` IS NOT NULL AND `options` IS NOT NULL AND `sequence` < ? ORDER BY `sequence` DESC LIMIT 1',
    UPDATE_TOPIC_OPTIONS: 'UPDATE train_topic SET `options`=?,`correct_choice`=? WHERE `id`=?',
    GET_NOT_ANSWERED_TOPIC_BY_ID_AND_USER: 'SELECT * FROM train_topic WHERE `id`=? AND `user_id`=? AND `user_choice` IS NULL',
    SAVE_TOPIC_CHOICE: 'UPDATE train_topic SET `user_choice`=?,`answer_time` = ? WHERE `id`=?',
    GET_COUNT_ANSWERED_TOPIC: 'SELECT COUNT(*) AS CNT FROM train_topic WHERE `user_id`=? AND `user_choice` IS NOT NULL',
    GET_COUNT_CORRECT_TOPIC: 'SELECT COUNT(*) AS CNT FROM train_topic WHERE `user_id`=? AND `user_choice` IS NOT NULL AND `user_choice` = `correct_choice`',
    DELETE_USER_TOPIC: 'DELETE FROM train_topic WHERE `user_id`=?',
    GET_TOPIC_ID: 'SELECT * FROM train_topic WHERE `id`= ? AND `user_id`=?',
    GET_COUNT_TOTAL_WORDS: 'SELECT COUNT(*) AS CNT FROM vocabulary WHERE `lexicon` in (SELECT `lexicon_code` FROM user_lexicon WHERE `user_id`=?)',
    GET_MOST_DIFFICULT_WORD: 'SELECT word FROM user_mistakes WHERE `user_id`=?  ORDER BY count DESC LIMIT 1',
    GET_USER_MISTAKE: 'SELECT * FROM user_mistakes WHERE `user_id`=? AND `word`=?',
    UPDATE_USER_MISTAKE_COUNT: 'UPDATE user_mistakes SET `count`=? WHERE `id`=?',
    INSERT_USER_MISTAKE: 'INSERT INTO user_mistakes(`id`,`user_id`,`word`,`count`) VALUES(?,?,?,?)',
    DELETE_USER_MISTAKE: 'DELETE FROM user_mistakes WHERE `user_id`=?',
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
                    return item.replace(/\(.*\)/g, '').replace(/\s-.*$/, '').trim();
                });
                let correct = {A: 0, B: 1, C: 2, D: 3}[options[5]];
                let correctChoice = selections[correct];
                if (!correctChoice) {
                    await claude.deleteCache(CACHE_CATEGORY, r.word);
                    NestiaWeb.logger.error('Invalid ai response,NO correct answer found:', res);
                    continue;
                }
                //shuffle
                let shuffleTimes = Math.floor(Math.random() * 10);
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
            let word;
            //random select lexicon
            while (lexiconList.length > 0) {
                let randomLexiconIndex = Math.floor(Math.random() * lexiconList.length);
                let lexicon = lexiconList[randomLexiconIndex];

                word = await DataBase.doQuery(conn, SQLS.GET_RANDOM_WORD_NOT_SELECTED, [lexicon, userId]);
                word = word[0];
                if (!word) {
                    lexiconList.splice(randomLexiconIndex, 1);
                } else {
                    break;
                }
            }

            if (!word) {
                NestiaWeb.logger.error('User has completed all lexicons, user_id:', userId);
                return;
            }
            //fetch max  sequence
            let maxSeq = await DataBase.doQuery(conn, SQLS.GET_MAX_SEQUENCE_BY_USER, [userId]);
            if (!maxSeq || maxSeq.length === 0) {
                maxSeq = 0;
            } else {
                maxSeq = maxSeq[0]['MAX_SEQUENCE'] * 1 + 1;
            }
            //insert topic
            await DataBase.doQuery(conn, SQLS.INSERT_TOPIC, [uuid(), userId, word.lexicon, word.word, maxSeq]);
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
            await DataBase.doQuery(conn, SQLS.DELETE_NOT_ANSWERED_TOPICS_BY_LEXICON, [userId, deletedLexicon]);
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
    // update topics and trigger training topics generation
    await trainTopics(userId, lexiconUpdate);

    return lexiconUpdate;
}


export async function getUserNextTopic(userId, sequence = null) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs;
        if (sequence !== null) {
            rs = await DataBase.doQuery(conn, SQLS.GET_NEXT_TRAINED_TOPICS, [userId, sequence]);
            if (rs.length > 0) {
                let result = rs[0];
                result.options = JSON.parse(result.options);
                return result;
            }
        }
        rs = await DataBase.doQuery(conn, SQLS.GET_NEXT_TRAINING_TOPICS, [userId]);
        if (rs.length === 0) {
            return null;
        }
        let result = rs[0];
        result.options = JSON.parse(result.options);
        return result;
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}

export async function getUserPreviousTopic(userId, sequence) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs = await DataBase.doQuery(conn, SQLS.GET_PREV_TRAINING_TOPICS, [userId, sequence]);
        if (rs.length === 0) {
            return null;
        }
        let result = rs[0];
        result.options = JSON.parse(result.options);
        return result;
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}

export async function saveUserChoice(userId, topicId, choice) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    let topic;
    let topics;
    try {
        conn = await DataBase.borrow(dbName);
        topics = await DataBase.doQuery(conn, SQLS.GET_NOT_ANSWERED_TOPIC_BY_ID_AND_USER, [topicId, userId]);

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
    if (topics.length === 0) {
        throw new Error('Invalid topic id or user id or topic has been answered');
    }
    try {
        conn = await DataBase.borrow(dbName);

        await DataBase.doQuery(conn, SQLS.SAVE_TOPIC_CHOICE, [choice, Date.now(), topicId]);
        topic = await DataBase.doQuery(conn, SQLS.GET_TOPIC_ID, [topicId, userId]);
        topic = topic[0];
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
    if (topic.user_choice !== topic.correct_choice) {
        await insertMistake(topic);
        await addUserMistakeCount(userId, topic.word);
    }
    return topic;
}

export async function addUserMistakeCount(userId, word) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let mistake = await DataBase.doQuery(conn, SQLS.GET_USER_MISTAKE, [userId, word]);
        if (mistake.length > 0) {
            mistake = mistake[0];
            await DataBase.doQuery(conn, SQLS.UPDATE_USER_MISTAKE_COUNT, [mistake.count + 1, mistake.id]);
        } else {
            await DataBase.doQuery(conn, SQLS.INSERT_USER_MISTAKE, [uuid(), userId, word, 1]);
        }
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

}

export async function clearUserMistakeCount(userId) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        await DataBase.doQuery(conn, SQLS.DELETE_USER_MISTAKE, [userId]);

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

}


export async function getUserTrainSummary(userId, full = false) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let answered = await DataBase.doQuery(conn, SQLS.GET_COUNT_ANSWERED_TOPIC, [userId]);
        answered = answered[0]['CNT'];
        let correct = await DataBase.doQuery(conn, SQLS.GET_COUNT_CORRECT_TOPIC, [userId]);
        correct = correct[0]['CNT'];
        let result = {
            words_correct: correct,
            words_answered: answered,
        };
        if (answered > 0) {
            result.correct_rate = (correct / answered * 100).toFixed(2);
        }
        if (full) {
            let total_words = await DataBase.doQuery(conn, SQLS.GET_COUNT_TOTAL_WORDS, [userId]);
            total_words = total_words[0]['CNT'];
            result.words_total = total_words;
            if (total_words > 0) {
                result.complete_rate = (answered / total_words * 100).toFixed(2);
            }
            let mostDifficult = await DataBase.doQuery(conn, SQLS.GET_MOST_DIFFICULT_WORD, [userId]);
            if (mostDifficult.length > 0) {
                result.most_difficult = mostDifficult[0]['word'];
            }
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

export async function trainingStartOver(userId) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        await DataBase.doQuery(conn, SQLS.DELETE_USER_TOPIC, [userId]);

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
    NestiaWeb.logger.info('User start over:', userId);
    generateTopics(userId, MIN_BUFFED_TOPICS).then(() => {
        NestiaWeb.logger.info(`Finished generate [${MIN_BUFFED_TOPICS}] topics for user:`, userId);
        fullfillTopics(userId).then(() => {
            NestiaWeb.logger.info(`Finished fulfil topics for user:`, userId);
        });
    });
}

