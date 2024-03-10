import NestiaWeb from "nestia-web";
import DataBase from "../db/index.mjs";
import {v4 as uuid} from "uuid";

let threshold = 0, thresholdIndicator = Math.floor(Date.now() / 60000);

const MAX_REQ_PER_MIN = 60;

const SQLS = {
    GET_CACHE: 'SELECT * FROM ai_cache WHERE `category` = ? AND `key` = ? AND `created_at` > ?',
    SET_CACHE: 'INSERT INTO ai_cache(`id`,`category`,`key`,`created_at`,`content`) VALUES(?,?,?,?,?)',
    DELETE_CACHE: 'DELETE FROM ai_cache WHERE `category` = ? AND `key` = ?'
}

const CACHE_TTL = 365 * 60 * 60 * 24 * 1000;

async function getCache(category, key) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    let now = Date.now();
    try {
        conn = await DataBase.borrow(dbName);
        let result = await DataBase.doQuery(conn, SQLS.GET_CACHE, [category, key, now - CACHE_TTL]);
        if (result.length) {
            return result[0];
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

async function setCache(category, key, content) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    let now = Date.now();
    try {
        conn = await DataBase.borrow(dbName);
        await DataBase.doQuery(conn, SQLS.DELETE_CACHE, [category, key]);
        let result = await DataBase.doQuery(conn, SQLS.SET_CACHE, [uuid(), category, key, now, content]);
        if (result.length) {
            return result[0];
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

export async function deleteCache(category, key) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        await DataBase.doQuery(conn, SQLS.DELETE_CACHE, [category, key]);
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}


export async function request(prompt, options) {
    let cacheData = null;
    if (options.category && options.key) {
        cacheData = await getCache(options.category, options.key);
    }
    if (cacheData) {
        return cacheData;
    }
    let now = Math.floor(Date.now() / 60000);
    if (now > thresholdIndicator) {
        thresholdIndicator = now;
        threshold = 0;
    }
    if (threshold >= MAX_REQ_PER_MIN) {
        throw new Error('Request limit reached');
    }
    threshold++;
    options = options || {};
    let key = NestiaWeb.manifest.get('claude.key');
    let result = await NestiaWeb.ajax.request({
        server: 'claude',
        path: '/v1/messages',
        method: 'POST',
        headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
        },
        reqContentType: 'json',
        resContentType: 'json',
        data: {
            "model": options.model || "claude-3-opus-20240229",
            "max_tokens": 1024,
            "messages": [{
                "role": "user",
                "content": prompt
            }]
        },
    });
    if (result.data?.content && result.data?.content.length) {
        result = result.data?.content[0]?.text;
    }
    if (result && options.category && options.key) {
        await setCache(options.category, options.key, result);
    }
    return result;
}