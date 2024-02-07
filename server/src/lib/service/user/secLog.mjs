import EventEmitter from 'events';
import NestiaWeb from "nestia-web";
import DataBase from "../../db/index.mjs";


const securityEventEmitter = new EventEmitter();

export default securityEventEmitter;

const SQLS = {
    INSERT_LOG: 'INSERT INTO users_security_log (level , type , time_str , ip , user , content , timestamp) VALUES (?,?,?,?,?,?,?)',
};

function formatDate(date) {
    let fillZero = function (str, len) {
        str += '';
        while (str.length < len) {
            str = '0' + str;
        }
        return str;
    }
    return `${fillZero(date.getFullYear(), 4)}-${fillZero(date.getMonth() + 1, 2)}-${fillZero(date.getDate(), 2)} ${fillZero(date.getHours(), 2)}:${fillZero(date.getMinutes(), 2)}:${fillZero(date.getSeconds(), 2)}.${fillZero(date.getMilliseconds(), 3)}`;
}

async function save(log) {
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    let now = new Date();
    let dateStr = formatDate(now);
    try {
        conn = await DataBase.borrow(dbName);
        await DataBase.doQuery(conn, SQLS.INSERT_LOG, [
            log.level,
            log.type,
            dateStr,
            log.ip || '',
            log.user || '',
            log.content,
            now.getTime()
        ]);
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
}

securityEventEmitter.on('login', function (user, req) {
    let log = {
        level: 'INFO',
        type: 'LOGIN',
        user: user.name,
        content: 'Success',
        ip: req.ip
    };
    process.nextTick(async function () {
        await save(log);
    })
});

securityEventEmitter.on('logout', function (user, req) {
    let log = {
        level: 'INFO',
        type: 'LOGOUT',
        user: user.user,
        content: 'Logout',
        ip: req.ip
    };
    process.nextTick(async function () {
        await save(log);
    })
});

securityEventEmitter.on('loginFail', function (user, req) {
    let log = {
        level: 'WARN',
        type: 'LOGIN',
        user: '',
        content: `Login failed [${user.user}:${user.pwd}]`,
        ip: req.ip
    };
    process.nextTick(async function () {
        await save(log);
    })
});

securityEventEmitter.on('regMailSent', function (mailInfo, req) {
    let log = {
        level: 'INFO',
        type: 'MAIL',
        user: '',
        content: `Register mail sent [${mailInfo.email}:${mailInfo.invite_code}] ${mailInfo.result ? "success" : "failed"}`,
        ip: req.ip
    };
    process.nextTick(async function () {
        await save(log);
    });
});

securityEventEmitter.on('pwdMailSent', function (mailInfo, req) {
    let log = {
        level: 'INFO',
        type: 'MAIL',
        user: '',
        content: `Password reset mail sent [${mailInfo.email}] ${mailInfo.result ? "success" : "failed"}`,
        ip: req.ip
    };
    process.nextTick(async function () {
        await save(log);
    });
});

securityEventEmitter.on('register', function (regInfo, req) {
    let log = {
        level: regInfo.result ? 'INFO' : 'WARN',
        type: 'REGISTER',
        user: regInfo.user,
        content: `Register ${regInfo.result ? "success" : "failed"} :${JSON.stringify(regInfo)} `,
        ip: req.ip
    };
    process.nextTick(async function () {
        await save(log);
    });
});

securityEventEmitter.on('resetPwd', function (regInfo, req) {
    let log = {
        level: regInfo.result ? 'INFO' : 'WARN',
        type: 'PASSWORD',
        user: regInfo.name,
        content: `Register ${regInfo.result ? "success" : "failed"} :${JSON.stringify(regInfo)} `,
        ip: req.ip
    };
    process.nextTick(async function () {
        await save(log);
    });
});