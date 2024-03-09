import express from 'express';
import NestiaWeb from "nestia-web";
import {checkUserLogin, getUser, userLogin, updateUser} from "../../../../lib/service/user/index.mjs";
import path from "path";
import fs from "fs";
import {v4 as uuid} from "uuid";
import * as Aliyun from "../../../../lib/aliyun/index.mjs";
import {getAllLexicon, getUserLexiconList, setUserLexiconList} from "../../../../lib/service/training/index.mjs";

const router = express.Router();


/* GET home page. */
router.get('/getUserLexiconList', async function (req, res, ignoredNext) {
    let envString = req.query.env;
    let token = req.query.token;
    let openId = req.query.open_id;
    if (!openId || !token || !envString) {
        res.status(400).send('Invalid parameters');
        return;
    }
    try {
        let checked = await checkUserLogin(openId, envString, token);
        if (!checked.result) {
            res.status(401).send('Invalid user or token expired');
            return;
        }
        let user = checked.user;
        let result = await getUserLexiconList(user.id);
        res.send(result);
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }
});

/* GET home page. */
router.post('/setUserLexiconList', async function (req, res, ignoredNext) {
    let envString = req.body.env;
    let token = req.body.token;
    let openId = req.body.open_id;
    if (!openId || !token || !envString) {
        res.status(400).send('Invalid parameters');
        return;
    }
    let lexiconList = req.body.lexicons;
    if (!lexiconList) {
        res.status(400).send('Invalid parameters');
        return;
    }
    try {
        lexiconList = JSON.parse(lexiconList);
    } catch (e) {
        NestiaWeb.logger.error('Error parse lexiconList', lexiconList, e);
        res.status(400).send('Invalid parameters');
        return;
    }
    if (!Array.isArray(lexiconList)) {
        res.status(400).send('Invalid parameters');
        return;
    }
    try {
        let checked = await checkUserLogin(openId, envString, token);
        if (!checked.result) {
            res.status(401).send('Invalid user or token expired');
            return;
        }
        let user = checked.user;
        let allLexicon = await getAllLexicon();
        for (const lexicon of lexiconList) {
            let found = false;
            for (const lexiconInDb of allLexicon) {
                if (lexiconInDb.code === lexicon) {
                    found = true;
                }
            }
            if (!found) {
                res.status(400).send('Invalid lexicon code:' + lexicon);
                return;
            }
        }
        let result = await setUserLexiconList(user.id, lexiconList);
        res.send(result);
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }
});
export default router;
