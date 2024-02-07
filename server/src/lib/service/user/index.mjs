import crypto from 'crypto';
import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";
import jwt from "jsonwebtoken";
import {v4 as uuid} from "uuid";
import {validateEmail, validateUserName} from "../../misc/inputValidators.mjs";

const SQLS = {
    SELECT_BY_NAME_PWD: "SELECT * FROM users WHERE `name`=? AND `password`=? LIMIT 1 ",
    SELECT_BY_ID: "SELECT * FROM users WHERE id = ? ",
    SELECT_BY_EMAIL: "SELECT * FROM users WHERE email = ? ",
    GET_INVITATION_BY_CODE: "SELECT * FROM users_invitation WHERE `code` = ? AND used = 0",
    GET_INVITATION_BY_CODE_TOKEN: "SELECT * FROM users_invitation WHERE email = ? AND `code` = ? AND token = ? AND used = 0",
    UPDATE_INVITATION_MAIL_INFO: "UPDATE users_invitation SET email = ? , token = ?, send_mail_times = ?, last_mail_sent_time = ? WHERE id = ?",
    UPDATE_INVITATION_USED: "UPDATE users_invitation SET used = ?, used_time = ? WHERE id = ?",
    GET_COUNT_BY_USER: "SELECT COUNT(*) AS CNT FROM users WHERE name = ?",
    GET_COUNT_BY_EMAIL: "SELECT COUNT(*) AS CNT FROM users WHERE email = ?",
    INSERT_NEW_USER: "INSERT INTO users(name , email , password , admin , roles) VALUES (?,?,?,0,?)",
    UPDATE_USER_PWD: "UPDATE users SET password = ? WHERE id = ?",
    GET_PWD_RESET_MAIL_CNT: "SELECT COUNT(id) as CNT FROM users_pwd_recovery WHERE email = ? AND last_mail_sent_time >= ?",
    GET_LAST_PWD_RESET_MAIL: "SELECT * FROM users_pwd_recovery WHERE email = ? AND used = 0 ORDER BY last_mail_sent_time desc LIMIT 1",
    UPDATE_PWD_RESET_MAIL_INFO: "UPDATE users_pwd_recovery SET token = ? , last_mail_sent_time = ? , send_mail_times = ? WHERE id = ?",
    INSERT_PWD_RESET_MAIL_INFO: "INSERT INTO users_pwd_recovery(email,token,used,create_time,used_time,send_mail_times,last_mail_sent_time) VALUES (?,?,?,?,?,?,?)",
    UPDATE_PWD_RESET_USED: "UPDATE users_pwd_recovery SET used = ? , used_time = ? WHERE id = ?",
};


const encode = function (n, t) {
    let salt = NestiaWeb.manifest.get('user.salt');
    let txt = n + salt + t;
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

export function validateCookies(cookies) {
    if (!cookies) {
        return false;
    }
    let n = cookies['_n'], t = cookies['_t'], v = cookies['_v'];
    let token = cookies['token'];
    if (!n || !t || !v || !token) {
        return false;
    }
    let tl = t * 1000, now = Date.now();


    if (now - tl < 0) {
        return false;
    }

    let expire = NestiaWeb.manifest.get('user.cookieExpire');

    if (now - tl > expire * 1000) {
        return false;
    }

    try {
        if (encode(n, t) !== v) {
            return false;
        }
    } catch (e) {
        NestiaWeb.logger.fatal('Error when encode verify', e);
        return false;
    }
    return true;
}

export async function getUser(userId){
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs = await DataBase.doQuery(conn, SQLS.SELECT_BY_ID, [userId]);
        if (rs != null && rs.length > 0) {
            let user= rs[0];
            delete user['password'];
            return user;
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

export async function checkPwd(usr, pwd) {
    let hash = encode(pwd, "");
    hash = encode(hash, pwd);
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let rs = await DataBase.doQuery(conn, SQLS.SELECT_BY_NAME_PWD, [usr, hash]);
        if (rs != null && rs.length > 0) {
            let user= rs[0];
            delete user['password'];
            return user;
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

export async function getToken(userObj) {
    let token = {
        exp: Math.floor(Date.now() / 1000) + (60 * 60),
        data: {
            id: userObj.id,
            roles: (userObj.roles || '').split(' '),
            admin: userObj.admin
        }
    }
    let key = getTokenKey(userObj.name);

    return jwt.sign(token, key, {algorithm: 'HS256'});
}

export function getTokenKey(userName) {
    return encode(userName, '');
}

export async function getNewToken(cookies, id) {
    if (validateCookies(cookies)) {

        let uname = cookies['_n'];
        let conn = null;
        let dbName = NestiaWeb.manifest.get('defaultDatabase');
        let userObj = null;
        try {
            conn = await DataBase.borrow(dbName);
            let rs = await DataBase.doQuery(conn, SQLS.SELECT_BY_ID, [id]);

            if (rs != null && rs.length > 0) {
                userObj = rs[0];
            }
        } catch (e) {
            NestiaWeb.logger.error('Error do query', e);
        } finally {
            if (conn) {
                DataBase.release(conn);
            }
        }


        if (!userObj || userObj.name !== uname) {
            throw new Error('Token tampered!');
        }

        let newToken = await getToken(userObj);
        return {
            user: {
                id: userObj.id,
                roles: (userObj.roles || '').split(' '),
                admin: userObj.admin
            },
            token: newToken
        }
    } else {
        throw new Error('Invalid login cookie!');
    }

}


export function getVerify(userName, t) {
    return encode(userName, t);
}


export async function validateCode(email, invite_code, retInvitation = false) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let invitations = await DataBase.doQuery(conn, SQLS.GET_INVITATION_BY_CODE, [invite_code]);
        for (const invitation of invitations) {
            if (invitation.email && invitation.email === email) {
                return retInvitation ? invitation : true;
            }
            if (!invitation.email) {
                return retInvitation ? invitation : true;
            }
        }
        return false;
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

}

export async function validateCodeAndToken(email, invite_code, token, retInvitation = false) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let invitations = await DataBase.doQuery(conn, SQLS.GET_INVITATION_BY_CODE_TOKEN, [email, invite_code, token]);
        if (invitations.length) {
            return retInvitation ? invitations[0] : true;
        } else {
            return false;
        }
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

}

export async function validateUserEmailNotExists(user, email) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let cnt;
        if (user) {
            cnt = await DataBase.doQuery(conn, SQLS.GET_COUNT_BY_USER, [user]);
            cnt = cnt[0] ['CNT'];
            if (cnt > 0) {
                return false;
            }
        }
        cnt = await DataBase.doQuery(conn, SQLS.GET_COUNT_BY_EMAIL, [email]);
        cnt = cnt[0] ['CNT'];
        return cnt <= 0;

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

}


export async function registerNewUser(email, invite_code, token, user, password) {
    if (!validateUserName(user)) {
        NestiaWeb.logger.error(`Invalid user ${user}`);
        throw new Error('Invalid parameters');
    }
    if (!validateEmail(email)) {
        NestiaWeb.logger.error(`Invalid email ${email}`);
        throw new Error('Invalid parameters');
    }
    let invitation = await validateCodeAndToken(email, invite_code, token, true);
    let valid = await validateUserEmailNotExists(user, email);
    if (!invitation || !valid) {
        throw new Error('Invalid parameters');
    }

    let passwordHash = encode(password, "");
    passwordHash = encode(passwordHash, password);
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;


    try {
        conn = await DataBase.borrow(dbName);
        //update db mail send time and send times and token
        await DataBase.doQuery(conn, SQLS.UPDATE_INVITATION_USED, [
            1,
            Date.now(),
            invitation.id
        ]);
        await DataBase.doQuery(conn, SQLS.INSERT_NEW_USER, [
            user,
            email,
            passwordHash,
            invitation.roles
        ]);

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }

}

export async function sendPasswordResetMail(email) {
    //check reset pwd send record
    //more than 3 mails in 24 hr user is invalid
    //if yesterday sent 3 mails ,today only 1 mail is allowed,and token will be changed
    // more than 10 mails in a year is invalid
    let lastResetMail = null;
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let lastYearCnt = await DataBase.doQuery(conn, SQLS.GET_PWD_RESET_MAIL_CNT, [email, Date.now() - (365 * 86400 * 1000)]);
        if (lastYearCnt && lastYearCnt.length) {
            lastYearCnt = lastYearCnt[0]['CNT'];
        }
        if (lastYearCnt && lastYearCnt >= 10) {
            return false;
        }
        lastResetMail = await DataBase.doQuery(conn, SQLS.GET_LAST_PWD_RESET_MAIL, [email]);
        if (lastResetMail && lastResetMail.length) {
            lastResetMail = lastResetMail[0];
        } else {
            lastResetMail = null;
        }
        if (lastResetMail) {
            lastResetMail.yesterday = Date.now() - lastResetMail.last_mail_sent_time > 86400000;
            if (!lastResetMail.yesterday && lastResetMail.send_mail_times >= 3) {
                return false;
            }
        }
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
    let token;
    if (!lastResetMail || (lastResetMail && lastResetMail.yesterday)) {
        token = (uuid()).replace(/[^a-z0-9]/g, '')
    } else {
        token = lastResetMail.token;
    }
    let urlRoot = NestiaWeb.manifest.get('urlRoot');
    let link = urlRoot + `/#/resetPwd?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    //send pwd reset mail
    let response = await sendMail(email, "Reset your password", 'pwdReset', {link});


    //update db

    if (response.success) {
        try {
            conn = await DataBase.borrow(dbName);
            if (lastResetMail) {
                await DataBase.doQuery(conn, SQLS.UPDATE_PWD_RESET_MAIL_INFO, [
                    token,
                    Date.now(),
                    lastResetMail.send_mail_times + 1,
                    lastResetMail.id
                ]);
            } else {
                await DataBase.doQuery(conn, SQLS.INSERT_PWD_RESET_MAIL_INFO, [
                    email,
                    token,
                    0,//used
                    Date.now(),
                    0,//used time
                    1,//mail sent times
                    Date.now() // last mail send time
                ]);
            }

        } catch (e) {
            NestiaWeb.logger.error('Error do query', e);
        } finally {
            if (conn) {
                DataBase.release(conn);
            }
        }
    }

    return response.success;
}

export async function resetPassword(email, token, password) {

    let lastResetMail = null;
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        lastResetMail = await DataBase.doQuery(conn, SQLS.GET_LAST_PWD_RESET_MAIL, [email]);
        if (lastResetMail && lastResetMail.length) {
            lastResetMail = lastResetMail[0];
        } else {
            lastResetMail = null;
        }
        if (lastResetMail) {
            lastResetMail.yesterday = Date.now() - lastResetMail.last_mail_sent_time > 86400000;
            if (!lastResetMail.yesterday && lastResetMail.send_mail_times >= 3) {
                return false;
            }
            if (lastResetMail.token !== token) {
                return false;
            }
        } else {
            return false;
        }

        let passwordHash = encode(password, "");
        passwordHash = encode(passwordHash, password);
        await DataBase.doQuery(conn, SQLS.UPDATE_PWD_RESET_USED, [
            1,
            Date.now(),
            lastResetMail.id
        ]);
        let userObj = await DataBase.doQuery(conn, SQLS.SELECT_BY_EMAIL, [
            email
        ]);
        if (!userObj || !userObj.length) {
            userObj = userObj[0];
        }
        await DataBase.doQuery(conn, SQLS.UPDATE_USER_PWD, [
            passwordHash,
            userObj.id
        ]);
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }


    return userObj;
}