import DataBase from "../../db/index.mjs";
import NestiaWeb from "nestia-web";
import {getListByConditionsAndOrderWithPagination} from "../../misc/reusefulQuerys.mjs";


const SQLS = {
    LIST_USER: "SELECT * FROM users ${CONDITION} ORDER BY ${SORT} LIMIT ?,?",
    // COUNT_LIST_USER: "SELECT COUNT(*) AS CNT FROM users ${CONDITION}",
    LIST_INVITATION: "SELECT * FROM users_invitation ${CONDITION} ORDER BY ${SORT} LIMIT ?,?",
    // COUNT_LIST_INVITATION: "SELECT COUNT(*) AS CNT FROM users_invitation ${CONDITION}",
    GET_USER_BY_ID: "SELECT * FROM users WHERE id = ? ",
    UPDATE_USER_ROLES: "UPDATE users SET roles = ? WHERE id = ? ",
    INSERT_INVITATION: "INSERT INTO  users_invitation(code,email,roles,create_time,used,send_mail_times) VALUES (?,?,?,?,0,0)",
};


async function validateIsAdmin(req) {
    let user = req.user;
    if (!user) {
        throw new Error('Admin should login!');
    }
    let userObj = await getUser(user.id);
    if (!userObj) {
        throw new Error('Admin user not exists.');
    }
    if (!userObj.admin) {
        throw new Error(`User[${userObj.name}] is not administrator`);
    }

}

export async function setPassword(userName, newPwd, req) {
    await validateIsAdmin(req);

}

export async function lockUser(userName, newPwd, req) {
    await validateIsAdmin(req);

}

export async function unlockUser(userName, newPwd, req) {
    await validateIsAdmin(req);

}

export async function register(userName, email) {

}

export async function confirmRegister(userName, email, token, password) {

}

export async function resetPwd(userName, email, token, password) {

}


export async function getUsers(conditions, offset, limit, sort, order) {
    let $sort;

    if (['name'].includes(sort)) {
        order = ['ASC', 'DESC'].includes(order) ? order : 'DESC'
        $sort = `\`${sort}\` ${order || 'DESC'}`;
    } else {
        $sort = 'id DESC';
    }
    return await getListByConditionsAndOrderWithPagination(SQLS.LIST_USER, conditions, offset, limit, $sort);
}

export async function getInvitations(conditions, offset, limit, sort, order) {
    let $sort;
    if (['create_time', 'email'].includes(sort)) {
        order = ['ASC', 'DESC'].includes(order) ? order : 'DESC'
        $sort = `\`${sort}\` ${order || 'DESC'}`;
    } else {
        $sort = 'create_time DESC';
    }
    return await getListByConditionsAndOrderWithPagination(SQLS.LIST_INVITATION, conditions, offset, limit, $sort);

}

export async function setUserRoles(userid, roles, req) {
    await validateIsAdmin(req);
    let user = await getUser(userid);
    if (!user || !userid) {
        throw new Error('Invalid user ' + userid);
    }

    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        await DataBase.doQuery(conn, SQLS.UPDATE_USER_ROLES, [roles, user.id]);
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}


async function getUser(id) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs = await DataBase.doQuery(conn, SQLS.GET_USER_BY_ID, [id]);
        if (rs != null && rs.length > 0) {
            return rs[0];
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

function generateRandomString(len) {
    let result = '';
    const characters = 'BCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const charactersLength = characters.length;
    for (let i = 0; i < len; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
}

export async function generateNewInvitations(type, amount, emailList, roles) {
    let limitEmail;
    switch (type) {
        case 'amount':
            limitEmail = false;
            break;
        case 'email':
            limitEmail = true;
            emailList = emailList.split(/\s+/);
            amount = emailList.length;
            for (const email of emailList) {
                if (!/^[0-9a-zA-Z_][0-9a-zA-Z+_~\-]*@(?!-)[A-Za-z0-9-]+([\-.][A-Za-z0-9]+)*\.[A-Za-z]{2,6}$/.test(email)) {
                    throw new Error('Invalid email: ' + email);
                }
            }
            break;
        default:
            throw new Error('Invalid type: ' + type);
    }


    let result = [];
    for (let i = 0; i < amount; i++) {
        let tokenObj = {};
        if (limitEmail) {
            tokenObj.code = generateRandomString(6);
            tokenObj.email = emailList[i];
        } else {
            tokenObj.code = generateRandomString(8);
        }
        result.push(tokenObj);
    }
    let resultStr = [];
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        for (const tokenObj of result) {
            await DataBase.doQuery(conn, SQLS.INSERT_INVITATION, [
                tokenObj.code,
                tokenObj.email || null,
                roles,
                Date.now()
            ]);
            if (tokenObj.email) {
                resultStr.push(`${tokenObj.email}\t${tokenObj.code}`);
            } else {
                resultStr.push(tokenObj.code);
            }
        }


    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

    return resultStr;
}