import express from 'express';
import NestiaWeb from "nestia-web";
import {checkUserLogin, userLogin} from "../../../../lib/service/user/index.mjs";

const router = express.Router();


/* GET home page. */
router.post('/login', async function (req, res, ignoredNext) {
    let authorization;
    let envString = req.body.env;
    let code = req.body.code;
    if (!code || !envString) {
        res.status(400).send('Invalid parameters');
        return;
    }
    try {
        let appid = NestiaWeb.manifest.get('wx.app_id');
        let app_secert = NestiaWeb.manifest.get('wx.app_secret');
        authorization = await NestiaWeb.ajax.request({
            server: 'wx_api',
            path: '/sns/jscode2session',
            method: 'GET',
            data: {
                appid: appid,
                secret: app_secert,
                js_code: req.body.code,
                grant_type: 'authorization_code'
            },
            resContentType: 'json'
        });
        let authData = authorization.data;
        if (!authData.openid || !authData.session_key) {
            res.status(500).send('Error fetching authorization');
            return;
        }
        let userInfo = await userLogin(authData.openid, envString, authData.session_key);
        res.send(userInfo);
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }
});
/* GET home page. */
router.post('/checkLogin', async function (req, res, ignoredNext) {
    let envString = req.body.env;
    let openId = req.body.open_id;
    let token = req.body.token;
    if (!openId || !token || !envString) {
        res.status(400).send('Invalid parameters');
        return;
    }
    try {
        let checked = await checkUserLogin(openId, envString, token);
        if (!checked) {
            res.status(401).send('Invalid user or token expired');
            return;
        }
        res.send({result: true});
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }
});

export default router;
