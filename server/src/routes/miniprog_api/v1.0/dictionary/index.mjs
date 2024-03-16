import express from 'express';
import NestiaWeb from "nestia-web";
import {checkUserLogin} from "../../../../lib/service/user/index.mjs";

import {getDictionaryForEng2Chi} from "../../../../lib/service/dictionary/index.mjs";

const router = express.Router();


/* GET home page. */
router.get('/getDictionaryDetail', async function (req, res, ignoredNext) {
    let envString = req.query.env;
    let token = req.query.token;
    let openId = req.query.open_id;
    if (!openId || !token || !envString) {
        res.status(400).send('Invalid parameters');
        return;
    }
    let type = req.query.type;
    let text = req.query.text;
    if (!type || !text) {
        res.status(400).send('Invalid parameters');
        return;
    }
    try {
        let checked = await checkUserLogin(openId, envString, token);
        if (!checked.result) {
            res.status(401).send('Invalid user or token expired');
            return;
        }
        switch (type) {
            case 'en2zh':
                let result = await getDictionaryForEng2Chi(text);
                res.status(200).json(result);
                break;
            default:
                res.status(400).send('Invalid type');
        }

    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }

});


export default router;
