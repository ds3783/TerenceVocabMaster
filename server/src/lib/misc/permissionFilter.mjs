import NestiaWeb from 'nestia-web';
import jwt from "jsonwebtoken";
import rolePermissions from "../data/user/rolePathPermissions.mjs";

const PathWhiteList = [
    '/api/user/checkLogin',
    '/api/user/login',
    '/api/user/logout',
    '/api/user/signUp',
    '/api/user/validateUser',
    '/api/user/register',
    '/api/user/sendResetPwdEmail',
    '/api/user/resetPwd',
    '/api/user/oauth/getOauthParameters',
    '/api/user/oauth/login',
];

export async function loginFilter(req, res, next) {
    let ok = validateCookies(req.cookies);
    if (!ok) {
        //reduce query part
        let originUrl = req.originalUrl.replace(/\?.*$/, '');
        //replace start with //
        originUrl = originUrl.replace(/^(\/)+/, '/');
        //reduce "/" at tail
        originUrl = originUrl.replace(/(\/)?(\?.*)?$/, '');
        if (/^\/api\//.test(originUrl)) {
            if (PathWhiteList.includes(originUrl)) {
                //in white-list
                next();
                return;
            }
        } else {
            next();
            return;
        }

        res.clearCookie('_n', {path: '/'});
        res.clearCookie('_t', {path: '/'});
        res.clearCookie('_v', {path: '/'});
        res.clearCookie('token', {path: '/'});
        res.status(401).send('Not login!');
    } else {
        let token = req.cookies.token;
        let _n = req.cookies._n;
        try {
            let key = getTokenKey(_n);
            let tokenObj = jwt.verify(token, key);
            req.user = tokenObj.data;
        } catch (err) {
            if (err.name === 'TokenExpiredError') {

            }
            //wrong token
            let decoded;
            try {
                decoded = jwt.decode(token);
            } catch (e) {
                NestiaWeb.logger.error('Unable to decode token', e);
                res.clearCookie('_n', {path: '/'});
                res.clearCookie('_t', {path: '/'});
                res.clearCookie('_v', {path: '/'});
                res.clearCookie('token', {path: '/'});
                res.status(401).send('Not login!');
                return;
            }
            try {
                let newToken = await getNewToken(req.cookies, decoded.data.id);
                res.cookie("token", newToken.token, {path: '/', httpOnly: true});
                req.user = newToken.user;
            } catch (e) {
                if ('Token tampered!' === e.message) {
                    let logObj = {
                        cookies: req.cookies,
                        ip: req.ip,
                        ua: req.headers['user-agent'],
                        forwarded_ip: req.headers['x-forwarded-for']
                    }
                    NestiaWeb.logger.fatal(`Someone tamper the token ${JSON.stringify(logObj, null, '\t')}`)
                }
                NestiaWeb.logger.error(e);
                res.clearCookie('_n', {path: '/'});
                res.clearCookie('_t', {path: '/'});
                res.clearCookie('_v', {path: '/'});
                res.clearCookie('token', {path: '/'});
                res.status(401).send('Not login!');
                return;
            }
        }

        next();
    }
}


export async function permissionFilter(req, res, next) {
    let roles = [];
    if (req.user) {
        roles = req.user.roles || [];
    }
    roles.push('anonymous');
    let block = function (res, reason) {
        res.status(403).send(reason || 'Access Denied');
    }
    let pass = false;
    let originUrl = req.originalUrl.replace(/\?.*$/, '');
    //replace start with //
    originUrl = originUrl.replace(/^(\/)+/, '/');
    //reduce "/" at tail
    originUrl = originUrl.replace(/(\/)?(\?.*)?$/, '');
    for (const role of roles) {
        let permissions = rolePermissions[role];
        if (!permissions) {
            NestiaWeb.logger.fatal('No permission config for role:' + role);
            return block(res);
        }
        for (const permission of permissions) {
            let match = false, methodMatch = true;
            if (permission.pattern) {
                match = match || !!(permission.pattern.match(originUrl));
            }
            if (permission.url) {
                match = match || permission.url === originUrl;
            }
            if (permission.method) {
                methodMatch = permission.method.split(',').includes(req.method);
            }
            pass = match && methodMatch;
            if (pass) {
                break;
            }
        }
        if (pass) {
            break;
        }
    }

    if (pass) {
        next();
    } else {
        return block(res, 'Not Allow');
    }
}