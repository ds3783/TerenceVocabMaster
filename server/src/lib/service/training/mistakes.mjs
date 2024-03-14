import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";
import {v4 as uuid} from "uuid";

const SQLS = {
    INSERT_MISTAKE_TOPIC: 'INSERT INTO train_topic_mistakes (id, word, lexicon_code, user_id, options, user_choice, correct_choice, sequence, answer_time, mistake_times, correct_times) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    GET_NEXT_MISTAKE_TOPICS: 'SELECT * FROM train_topic_mistakes WHERE user_id = ? AND sequence > ? ORDER BY sequence LIMIT 1',
    GET_FIRST_MISTAKE_TOPICS: 'SELECT * FROM train_topic_mistakes WHERE user_id = ? ORDER BY sequence LIMIT 1',
    GET_PREV_MISTAKE_TOPICS: 'SELECT * FROM train_topic_mistakes WHERE user_id = ? AND sequence < ? ORDER BY sequence DESC LIMIT 1',
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
