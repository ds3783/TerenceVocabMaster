import NestiaWeb from 'nestia-web';
import express from 'express';
import {
    checkPwd,
    getToken,
    getVerify,
    registerNewUser,
    resetPassword,
    sendEmailWithToken,
    sendPasswordResetMail,
    validateCode,
    validateCodeAndToken,
    validateCookies,
    validateUserEmailNotExists
} from '../../../lib/service/user/index.mjs';
import admin from './admin.mjs';
import oauth from './oauth.mjs';

import {getPermissions} from '../../../lib/data/user/menus.mjs';
import {validateEmail, validateUserName} from "../../../lib/misc/inputValidators.mjs";
import securityEventEmitter from "../../../lib/service/user/secLog.mjs";

const router = express.Router();

router.use('/admin', admin);
router.use('/oauth', oauth);

/* GET users listing. */
router.get('/checkLogin', function (req, res) {
    let ok = validateCookies(req.cookies);
    if (!ok) {
        res.clearCookie('_n', {path: '/'});
        res.clearCookie('_t', {path: '/'});
        res.clearCookie('_v', {path: '/'});
        res.clearCookie('token', {path: '/'});
    }
    res.send({result: ok});
});

router.post('/login', async function (req, res) {
    let {user, pwd} = req.body;
    let userObj = await checkPwd(user, pwd);


    if (!userObj) {
        securityEventEmitter.emit('loginFail', {user: user, pwd: pwd}, req);
        res.status(403).send({result: false});
        return;
    }

    let t = "" + Math.floor(Date.now() / 1000);

    let vCode = getVerify(user, t);
    let token = await getToken(userObj);
    res.cookie("_n", userObj.name, {path: '/'});
    res.cookie("_t", t, {path: '/'});
    res.cookie("_v", vCode, {path: '/', httpOnly: true});
    res.cookie("token", token, {path: '/', httpOnly: true});
    securityEventEmitter.emit('login', userObj, req);
    res.send({result: true});
});

router.post('/logout', async function (req, res) {
    let user = req.cookies['_n'];

    res.clearCookie('_n', {path: '/'});
    res.clearCookie('_t', {path: '/'});
    res.clearCookie('_v', {path: '/'});
    res.clearCookie('token', {path: '/'});
    securityEventEmitter.emit('logout', {user}, req);
    res.send({result: true});
});

router.get('/permissions', async function (req, res) {
    let user = req.user;
    if (!user) {
        res.status(403).send('Not logged in!');
    }
    let menus;
    try {
        menus = getPermissions(user.roles);
    } catch (e) {
        NestiaWeb.logger.error('Error get permissions', e);
        res.status(400).send('Error get permissions, please contact Administrator');
    }
    res.send(menus);
});

router.post('/signUp', async function (req, res) {
    let {email, invite_code} = req.body;
    email = (email || '').toLowerCase();
    if (!validateEmail(email)) {
        res.status(400).send('Invalid email address');
        securityEventEmitter.emit('regMailSent', {email: email, invite_code: invite_code, result: false}, req);
        return;
    }

    let valid = await validateCode(email, invite_code);
    if (!valid) {
        res.status(400).send('Invalid invitation code');
        securityEventEmitter.emit('regMailSent', {email: email, invite_code: invite_code, result: false}, req);
        return;
    }

    try {
        let sendResult = await sendEmailWithToken(email, invite_code);
        securityEventEmitter.emit('regMailSent', {email: email, invite_code: invite_code, result: sendResult}, req);
        res.send({result: sendResult});
    } catch (e) {
        securityEventEmitter.emit('regMailSent', {email: email, invite_code: invite_code, result: false}, req);
        NestiaWeb.logger.error('Error send register mail', e);
        res.status(500).send('Internal error');
    }

});

router.post('/validateUser', async function (req, res) {
    let {email, invite_code, token, user} = req.body;
    if (!email || !invite_code || !token) {
        res.send({result: false});
        return;
    }

    if (!validateEmail(email)) {
        res.send({result: false});
        return;
    }

    if (!validateUserName(user)) {
        res.send({result: false});
        return;
    }

    let valid = await validateCodeAndToken(email, invite_code, token);
    if (!valid) {
        res.send({result: false});
        return;
    }

    valid = await validateUserEmailNotExists(user || null, email);
    if (!valid) {
        res.send({result: false});
        return;
    }
    res.send({result: true});

});

router.post('/register', async function (req, res) {
    let {email, invite_code, token, user, password, repeat_password} = req.body;
    if (!email || !invite_code || !token || !user || !password || !repeat_password) {
        res.status(400).send('Invalid parameters');
        securityEventEmitter.emit('register', {
            email,
            invite_code,
            token,
            user,
            password,
            repeat_password,
            result: false
        }, req);
        return;
    }
    if (password.length < 7 || password !== repeat_password) {
        res.status(400).send('Invalid parameters');
        securityEventEmitter.emit('register', {
            email,
            invite_code,
            token,
            user,
            password,
            repeat_password,
            result: false
        }, req);
        return;
    }

    let valid = await validateCodeAndToken(email, invite_code, token);
    if (!valid) {
        res.status(400).send('Invalid parameters');
        securityEventEmitter.emit('register', {
            email,
            invite_code,
            token,
            user,
            password,
            repeat_password,
            result: false
        }, req);
        return;
    }

    valid = await validateUserEmailNotExists(user, email);
    if (!valid) {
        res.status(400).send('Invalid parameters');
        securityEventEmitter.emit('register', {
            email,
            invite_code,
            token,
            user,
            password,
            repeat_password,
            result: false
        }, req);
        return;
    }

    try {
        await registerNewUser(email, invite_code, token, user, password);
        securityEventEmitter.emit('register', {
            email,
            invite_code,
            token,
            user,
            password,
            repeat_password,
            result: true
        }, req);
        res.send({result: true});
    } catch (e) {
        NestiaWeb.logger.error('Error send register mail', e);
        res.status(500).send('Internal error');
    }

});

router.post('/sendResetPwdEmail', async function (req, res) {
    let {email, email_confirm} = req.body;
    if (!email || !email_confirm) {
        res.status(400).send('Invalid parameters');
        securityEventEmitter.emit('pwdMailSent', {email: email, result: false}, req);
        return;
    }
    if (email !== email_confirm) {
        res.status(400).send('Invalid parameters');
        securityEventEmitter.emit('pwdMailSent', {email: email, result: false}, req);
        return;
    }

    let valid = await validateUserEmailNotExists('', email);
    if (valid) {
        //user not exists
        //avoid  email Spying , return true
        NestiaWeb.logger.error('Email spying detected:' + email);
        securityEventEmitter.emit('pwdMailSent', {email: email, result: false}, req);
        setTimeout(function () {
            res.send({result: true});
        }, 1500);
        return;
    }


    try {
        let result = await sendPasswordResetMail(email);
        securityEventEmitter.emit('pwdMailSent', {email: email, result: true}, req);
        res.send({result: result});
    } catch (e) {
        securityEventEmitter.emit('pwdMailSent', {email: email, result: false}, req);
        NestiaWeb.logger.error('Error send register mail', e);
        res.status(500).send('Internal error');
    }

});

router.post('/resetPwd', async function (req, res) {
    let {email, token, password, repeat_password} = req.body;
    if (!email || !token || !password || !repeat_password) {
        res.status(400).send('Invalid parameters');
        securityEventEmitter.emit('resetPwd', {
            email, token, password, repeat_password,
            result: false
        }, req);
        return;
    }
    if (password.length < 7 || password !== repeat_password) {
        res.status(400).send('Invalid parameters');
        securityEventEmitter.emit('resetPwd', {
            email, token, password, repeat_password,
            result: false
        }, req);
        return;
    }


    try {
        let result = await resetPassword(email, token, password);
        if (result) {
            securityEventEmitter.emit('resetPwd', {
                name: result.name, email, token,
                result: true
            }, req);
            res.send({result: true});
        } else {
            securityEventEmitter.emit('resetPwd', {
                email, token, password, repeat_password,
                result: false
            }, req);
            res.send({result: false});
        }

    } catch (e) {
        securityEventEmitter.emit('resetPwd', {
            email, token, password, repeat_password,
            result: false
        }, req);
        NestiaWeb.logger.error('Error send register mail', e);
        res.status(500).send('Internal error');
    }

});


export default router;
