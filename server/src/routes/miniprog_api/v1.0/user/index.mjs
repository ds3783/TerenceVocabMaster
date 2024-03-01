import express from 'express';
import NestiaWeb from "nestia-web";
import {userLogin} from "../../../../lib/service/user/index.mjs";
const router = express.Router();


/* GET home page. */
router.post('/login', async function (req, res, ignoredNext) {
    let authorization;
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
        let userInfo = await userLogin(authData.openid, authData.session_key);
        res.send(userInfo);
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }
});

export default router;
