import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";
import {v4 as uuid} from "uuid";

const SQLS = {
    GET_LEXICON_BY_USER_ID: "SELECT * FROM user_lexicon WHERE `user_id`=?",
    GET_ALL_LEXICON: "SELECT * FROM voc_lexicon ORDER BY difficulty DESC",
    INSERT_USER_LEXICON: 'INSERT INTO user_lexicon(`id`,`user_id`,`lexicon_code`) VALUES(?,?,?)',
    DELETE_USER_LEXICON: 'DELETE FROM user_lexicon WHERE `user_id`=? AND `lexicon_code`=?',

};

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


    return {
        added: added,
        deleted: deleted
    };
}



