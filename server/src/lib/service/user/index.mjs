import crypto from 'crypto';
import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";
import {v4 as uuid} from "uuid";

const SQLS = {
    GET_USER_BY_OPEN_ID: "SELECT * FROM users WHERE `open_id`=? AND `env`=?",
    INSERT_USER: "INSERT INTO users(id,open_id,env,session_key,name,avatar) VALUES (?,?,?,?,?,?)",
    UPDATE_USER_SESSION_KEY: "UPDATE users SET session_key = ? WHERE open_id = ? AND env = ?",
};

const RANDOM_NAME_PREFIX = ['Red', 'Chuck', 'Bomb', 'Matilda', 'Terence'];

const DEFAULT_AVATAR = 'https://ec7-fun.oss-rg-china-mainland.aliyuncs.com/vocab_master/mp/default_avatar.jpg';

const encode = function (name, env, token) {
    let salt = NestiaWeb.manifest.get('user.salt');
    let txt = name + env + salt + token;
    try {
        let messageDigest = crypto.createHash('sha512');
        let hash = messageDigest.update(txt, 'utf8').digest();
        if (hash instanceof Buffer) {
            hash = hash.toString('hex');
        }
        return hash;
    } catch (e) {
        NestiaWeb.logger.error(e.message, e);
        throw e;
    }
}


export async function userLogin(openId, envString, sessionKey) {
    let user = await getUser(openId, envString);
    if (!user) {
        // create new user
        user = await createUser(openId, envString, sessionKey);
    } else {
        // update session key
        await updateUserSessionKey(openId, envString, sessionKey);
    }
    return user;
}

export async function checkUserLogin(openId, envString, token) {
    let user = await getUser(openId, envString);
    if (!user) {
        return false;
    }
    return user.token === token;
}

export async function getUser(openId, envString) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs = await DataBase.doQuery(conn, SQLS.GET_USER_BY_OPEN_ID, [openId, envString]);
        if (rs != null && rs.length > 0) {
            let result = rs[0];
            if (!result || !result.open_id || !result.session_key) {
                return null;
            }
            result.token = encode(result.open_id, result.env, result.session_key);
            delete result['session_key'];
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

async function createUser(openId, envString, sessionKey) {
    //random a name;
    let name = RANDOM_NAME_PREFIX[Math.floor(Math.random() * RANDOM_NAME_PREFIX.length)] + '_' + uuid().substring(0, 4);

    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let generatedUuid = (uuid()).replace(/-/g, '');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        await DataBase.doQuery(conn, SQLS.INSERT_USER, [generatedUuid, openId, envString, sessionKey, name, DEFAULT_AVATAR]);
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
    return await getUser(openId, envString);
}

async function updateUserSessionKey(openId, envString, sessionKey) {

    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        await DataBase.doQuery(conn, SQLS.UPDATE_USER_SESSION_KEY, [sessionKey, openId, envString]);
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}
