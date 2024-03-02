import express from 'express';
import NestiaWeb from "nestia-web";
import {checkUserLogin, getUser, userLogin,updateUser} from "../../../../lib/service/user/index.mjs";
import path from "path";
import fs from "fs";
import {v4 as uuid} from "uuid";
import * as Aliyun from "../../../../lib/aliyun/index.mjs";

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


router.post('/uploadAvatar', async function (req, res) {
    let openId = req.body.open_id;
    let token = req.body.token;
    let envString = req.body.env;
    if (!openId || !token || !envString) {
        res.status(401).send('Invalid parameters');
        return;
    }
    let userInfo = await getUser(openId, envString);
    if (!userInfo || userInfo.token !== token) {
        res.status(401).send('Invalid user or token expired');
        return;
    }
    let wxFileName = req.body.filename;
    NestiaWeb.logger.info('Uploading avatar:', wxFileName);
    let cacheDir = NestiaWeb.manifest.get('cacheDir');
    let cachePath = path.join(process.cwd(), cacheDir);
    if (!fs.existsSync(cachePath)) {
        fs.mkdirSync(cachePath, {recursive: true});
    }
    if (!req.files || !Object.keys(req.files).length) {
        res.status(400).send('Invalid parameters');
        return;
    }
    let result = [];
    for (let fileKey in req.files) {
        let file = req.files[fileKey];
        let fileName = uuid().replace(/-/g, '_');
        /*
        * {name:'',size:'',encoding:'',tempFilePath:'',mometype:''}*/
        fs.renameSync(file.tempFilePath, path.join(cachePath, fileName + '.raw'));
        fs.writeFileSync(path.join(cachePath, fileName + '.info'), JSON.stringify(file));
        result.push({
            path: path.join(cachePath, fileName + '.raw'),
            file: fileName,
            size: file.size
        });
    }
    if (result.length !== 1) {
        res.status(400).send('Only 1 file is allowed to upload');
        return;
    }
    result = result[0];
    try {
        result.url = await Aliyun.uploadFile(result.path, '/vocab_master/mp/avatars/' + wxFileName);
        NestiaWeb.logger.info('File uploaded to aliyun:', result);
        delete result['path'];
        res.send(result);
    } catch (e) {
        NestiaWeb.logger.error('Error uploading avatar:', e);
        res.status(500).send('Error uploading avatar');
    }
});



router.post('/updateProfile', async function (req, res) {
    let openId = req.body.open_id;
    let token = req.body.token;
    let envString = req.body.env; 
    let name = req.body.name;
    let avatar = req.body.avatar;
    if (!openId || !token || !envString) {
        res.status(401).send('Invalid parameters');
        return;
    }
    if (!name && !avatar) {
        res.status(400).send('Invalid parameters');
        return;
    }
    let userInfo = await getUser(openId, envString);
    if (!userInfo || userInfo.token !== token) {
        res.status(401).send('Invalid user or token expired');
        return;
    }
    NestiaWeb.logger.info('aaaaaa',openId, envString, name, avatar);
    await updateUser(openId, envString, name, avatar);
    res.send({result: true});
});

export default router;
