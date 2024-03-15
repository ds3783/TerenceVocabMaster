import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";
import {v4 as uuid} from "uuid";

const SQLS = {
    INSERT_MISTAKE_TOPIC: 'INSERT INTO train_topic_mistakes (id, word, lexicon_code, user_id, options, user_choice, correct_choice, sequence, answer_time, mistake_times, correct_times) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    GET_NEXT_MISTAKE_TOPICS: 'SELECT * FROM train_topic_mistakes WHERE user_id = ? AND sequence > ? ORDER BY sequence LIMIT 1',
    GET_FIRST_MISTAKE_TOPICS: 'SELECT * FROM train_topic_mistakes WHERE user_id = ? ORDER BY sequence LIMIT 1',
    GET_PREV_MISTAKE_TOPICS: 'SELECT * FROM train_topic_mistakes WHERE user_id = ? AND sequence < ? ORDER BY sequence DESC LIMIT 1',
    GET_NEXT_RANDOM_MISTAKE_TOPICS: 'SELECT * FROM train_topic_mistakes WHERE user_id = ? ORDER BY RAND() LIMIT 1',
    GET_TOPIC_BY_ID_AND_USER: 'SELECT * FROM train_topic_mistakes WHERE id = ? AND user_id = ?',
    DELETE_BOOST_TOPIC_CHOICE: 'DELETE FROM train_topic_mistakes WHERE id = ?',
    SAVE_BOOST_TOPIC_CHOICE: 'UPDATE train_topic_mistakes SET correct_times = ?, mistake_times = ?, options = ?, correct_choice = ?, user_choice = ?, answer_time = ? WHERE id = ?'

};


export async function insertMistake(topicObj) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        await DataBase.doQuery(conn, SQLS.INSERT_MISTAKE_TOPIC, [
            uuid(),
            topicObj.word,
            topicObj.lexicon_code,
            topicObj.user_id,
            topicObj.options,
            topicObj.user_choice,
            topicObj.correct_choice,
            topicObj.sequence,
            topicObj.answer_time,
            0,
            0
        ]);

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}


export async function getUserNextMistakeTopic(userId, sequence = null) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs;
        if (sequence !== null) {
            rs = await DataBase.doQuery(conn, SQLS.GET_NEXT_MISTAKE_TOPICS, [userId, sequence]);
            if (rs.length > 0) {
                let result = rs[0];
                result.options = JSON.parse(result.options);
                return result;
            } else {
                return null;
            }
        }
        rs = await DataBase.doQuery(conn, SQLS.GET_FIRST_MISTAKE_TOPICS, [userId]);
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


export async function getUserPreviousMistakeTopic(userId, sequence) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs = await DataBase.doQuery(conn, SQLS.GET_PREV_MISTAKE_TOPICS, [userId, sequence]);
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


export async function getUserNextRandomMistakeTopic(userId = null) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs;
        rs = await DataBase.doQuery(conn, SQLS.GET_NEXT_RANDOM_MISTAKE_TOPICS, [userId]);
        if (rs.length > 0) {
            let result = rs[0];
            result.options = JSON.parse(result.options);
            //shuffle options
            let options = result.options;
            let keys = Array.from({length: options.length}, (_, index) => index);
            let resultOptions = [];
            //shuffle keys
            let shuffleTimes = Math.floor(Math.random() * 10);
            for (let i = 0; i < shuffleTimes; i++) {
                keys.sort(() => Math.random() - 0.5);
            }
            for (let key of keys) {
                resultOptions.push(options[key]);
            }
            let correctIndex = keys.indexOf(result.correct_choice * 1);
            result.options = resultOptions;
            result.correct_choice = '' + correctIndex;
            //base64 encode shuffle keys
            result.shuffle = Buffer.from(keys.join(',')).toString('base64');
            result.user_choice = null;
            return result;
        } else {
            return null;
        }
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}


export async function saveBoosterChoice(userId, topicId, choice, shuffle) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    let topic;
    let topics;
    try {
        conn = await DataBase.borrow(dbName);

        topics = await DataBase.doQuery(conn, SQLS.GET_TOPIC_BY_ID_AND_USER, [topicId, userId]);

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
    if (topics.length === 0) {
        throw new Error('Invalid topic id or user id or topic has been answered');
    } else {
        topic = topics[0];
    }
    try {
        conn = await DataBase.borrow(dbName);

        //decode shuffle keys
        let keys = Buffer.from(shuffle, 'base64').toString().split(',');
        let correctIndex = keys.indexOf(topic.correct_choice);
        topic.correct_choice = '' + correctIndex;
        topic.options = JSON.parse(topic.options);
        //apply shuffle keys to options
        let resultOptions = [];
        for (let key of keys) {
            resultOptions.push(topic.options[key]);
        }

        if (topic.mistake_times > 65535 || topic.correct_times > 65535) {
            //if mistake_times or correct_times is too large, reset them to 0
            topic.mistake_times = 0;
            topic.correct_times = 0;
        }
        if ('' + choice !== '' + correctIndex) {
            topic.mistake_times++;
            topic.correct_times = 0;
        } else {
            topic.correct_times++;
        }
        // user must correct 3 times without mistakes to remove it from mistake table
        if (topic.correct_times > 3) {
            //if correct_times-mistake_times>5, means user has mastered this topic, delete it from mistake table
            await DataBase.doQuery(conn, SQLS.DELETE_BOOST_TOPIC_CHOICE, [topicId]);
        } else {
            await DataBase.doQuery(conn, SQLS.SAVE_BOOST_TOPIC_CHOICE, [topic.correct_times, topic.mistake_times, JSON.stringify(resultOptions), correctIndex, choice, Date.now(), topicId]);
        }

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}