import NestiaWeb from 'nestia-web';
import express from 'express';
import {generateNewInvitations, getInvitations, getUsers, setUserRoles} from "../../../lib/service/user/admin.mjs";
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import {discordLogin} from "../../../lib/service/user/oauth.mjs";
import {getToken, getVerify} from "../../../lib/service/user/index.mjs";
import {v4 as uuid} from "uuid";

dayjs.extend(customParseFormat);

const router = express.Router();


router.get('/getOauthParameters', async function (req, res) {
    let result = [];
    let discord = NestiaWeb.manifest.get('user.oauth.discord', true);
    let token = uuid();
    res.cookie('oauth-token', token, {path: '/', httpOnly: true})
    if (discord) {

        /*
        * https://discord.com/api/oauth2/authorize?response_type=code&
        client_id=157730590492196864&
        scope=identify%20guilds.join&
        state=15773059ghq9183habn&
        redirect_uri=https%3A%2F%2Fnicememe.website&
        prompt=consent
        */

        let discordParam = {
            name: 'discord',
            logo: discord.logo,
            url: '',
        };
        let retUrl = discord.oauth_url;
        let scope = ['identify', 'email', 'guilds.join'];
        if (req.query['inviteBots']) {
            scope.push('bot');
        }
        let params = new URLSearchParams({
            response_type: 'code',
            prompt: 'consent',
            scope:scope.join(' '),
            redirect_uri: retUrl,
            state: token,
            client_id: discord.client_id
        });
        discordParam.url = discord.url + '?' + params.toString();
        result.push(discordParam);
    }
    res.send(result);
});


router.post('/login', async function (req, res) {
    let {type, code, state} = req.body;
    if (state !== req.cookies['oauth-token']) {
        res.send({
            success: false,
            message: 'Invalid parameters!'
        });
        return;
    }
    let userObj = null;
    try {
        switch (type) {
            case 'discord':
                userObj = await discordLogin(code);
                break;
        }
    } catch (e) {
        res.send({
            success: false,
            message: e.message || 'Login failed'
        });
        return;
    }
    res.clearCookie('state');
    if (userObj) {
        let t = "" + Math.floor(Date.now() / 1000);

        let vCode = getVerify(userObj.name, t);
        let token = await getToken(userObj);
        res.cookie("_n", userObj.name, {path: '/'});
        res.cookie("_t", t, {path: '/'});
        res.cookie("_v", vCode, {path: '/', httpOnly: true});
        res.cookie("token", token, {path: '/', httpOnly: true});
    }
    res.send({
        success: true,
    });
});

router.post('/setUserRoles', async function (req, res) {
    let uid = req.body.id;
    let roles = req.body.roles;

    try {
        await setUserRoles(uid, roles, req);
    } catch (e) {
        NestiaWeb.logger.fatal(`Error update user roles ${JSON.stringify({user: uid, roles: roles})}`, e);
        res.status(400).send('Something wrong happened, please contact administrator.');
        return;
    }
    res.send({
        result: true
    });
});

router.post('/generateInvitations', async function (req, res) {
    let type = req.body.type;
    let amount = req.body.amount;
    let emailList = req.body.email_list;
    let roles = req.body.roles;

    let newInvitations = [];
    try {
        newInvitations = await generateNewInvitations(type, amount, emailList, roles);
    } catch (e) {
        NestiaWeb.logger.fatal(`Error generate new tokens ${JSON.stringify({
            type: type,
            amount: amount,
            emailList: emailList
        })}`, e);
        res.status(400).send('Something wrong happened, please contact administrator.');
        return;
    }
    res.set('Content-Type', 'text/plain;charset=utf-8');
    res.send(newInvitations.join('\n'));
});


router.get('/userList', async function (req, res) {
    try {
        let conditions = [];
        if (req.query.name) {
            conditions.push({
                column: 'name',
                operator: '=',
                value: req.query.name
            });
        }
        if (req.query.email) {
            conditions.push({
                column: 'email',
                operator: '=',
                value: req.query.email
            });
        }
        if (req.query.id) {
            conditions.push({
                column: 'id',
                operator: '=',
                value: req.query.id * 1
            });
        }
        if (!conditions.length) {
            conditions = null;
        }

        let result = await getUsers(conditions, req.query.offset, req.query.limit, req.query.sort, req.query.order);
        res.set('X-Total-Count', '' + (result.count || 0));
        res.send(result.data);
    } catch (e) {
        NestiaWeb.logger.error(e);
        res.status(500).send(e.message || 'Unknown error');
    }
});

router.get('/invitationList', async function (req, res) {
    try {
        let conditions = [];
        if (req.query.code) {
            conditions.push({
                column: 'code',
                operator: '=',
                value: req.query.code
            });
        }
        if (req.query.email) {
            conditions.push({
                column: 'email',
                operator: '=',
                value: req.query.email
            });
        }
        if (req.query.min_date) {
            conditions.push({
                column: 'create_time',
                operator: '>=',
                value: dayjs(req.query.min_date, 'DD/MM/YYYY')
            });
        }
        if (req.query.max_date) {
            conditions.push({
                column: 'create_time',
                operator: '>=',
                value: dayjs(req.query.max_date, 'DD/MM/YYYY')
            });
        }
        if (!conditions.length) {
            conditions = null;
        }

        let result = await getInvitations(conditions, req.query.offset, req.query.limit, req.query.sort, req.query.order);
        res.set('X-Total-Count', '' + (result.count || 0));
        res.send(result.data);
    } catch (e) {
        NestiaWeb.logger.error(e);
        res.status(500).send(e.message || 'Unknown error');
    }
});


export default router;
