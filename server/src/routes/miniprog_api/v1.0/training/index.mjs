import express from 'express';
import NestiaWeb from "nestia-web";
import {checkUserLogin, getUser, userLogin, updateUser} from "../../../../lib/service/user/index.mjs";
import path from "path";
import fs from "fs";
import {v4 as uuid} from "uuid";
import * as Aliyun from "../../../../lib/aliyun/index.mjs";
import {
    getAllLexicon,
    getUserLexiconList,
    getUserNextTopic, getUserPreviousTopic, getUserTrainSummary, saveUserChoice,
    setUserLexiconList, trainingStartOver
} from "../../../../lib/service/training/index.mjs";

const router = express.Router();


/* GET home page. */
router.get('/loadNextTopic', async function (req, res, ignoredNext) {
    let envString = req.query.env;
    let token = req.query.token;
    let openId = req.query.open_id;
    let currentTopicSequence = req.query.topic_sequence;
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
        let topic = await getUserNextTopic(user.id, currentTopicSequence);

        if (topic) {
            let previous = await getUserPreviousTopic(user.id, topic.sequence);
            res.send({
                topic: topic,
                hasPrevious: !!previous,
                hasNext: topic.user_choice !== null,
            })
        } else {
            //TODO get summary
            res.send({
                noMoreTopics: true
            });
        }
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }

});

router.get('/loadPreviousTopic', async function (req, res, ignoredNext) {
    let envString = req.query.env;
    let token = req.query.token;
    let openId = req.query.open_id;
    let currentTopicSequence = req.query.topic_sequence;
    if (!openId || !token || !envString || typeof currentTopicSequence === 'undefined') {
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
        let topic = await getUserPreviousTopic(user.id, currentTopicSequence);

        if (topic) {
            let previous = await getUserPreviousTopic(user.id, topic.sequence);
            res.send({
                topic: topic,
                hasPrevious: !!previous,
                hasNext: true,
            })
        } else {
            //TODO get summary
            res.send({
                topic: null,
                hasPrevious: false,
                hasNext: true,
            });
        }
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }

});

/* GET home page. */
router.post('/saveTopicChoice', async function (req, res, ignoredNext) {
    let envString = req.body.env;
    let token = req.body.token;
    let openId = req.body.open_id;
    if (!openId || !token || !envString) {
        res.status(400).send('Invalid parameters');
        return;
    }
    let topicId = req.body.topic_id;
    let choice = req.body.choice;
    if (!topicId || !choice) {
        res.status(400).send('Invalid parameters');
        return;
    }
    choice = '' + choice;
    try {
        let checked = await checkUserLogin(openId, envString, token);
        if (!checked.result) {
            res.status(401).send('Invalid user or token expired');
            return;
        }
        let user = checked.user;
        try {
            await saveUserChoice(user.id, topicId, choice);
        } catch (e) {
            NestiaWeb.logger.error('Error saveUserChoice', e);
            res.status(500).send('Internal error');
            // res.send({});
            //
            return;
        }
        res.send({});
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }
});


/* GET home page. */
router.post('/trainingStartOver', async function (req, res, ignoredNext) {
    let envString = req.body.env;
    let token = req.body.token;
    let openId = req.body.open_id;
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
        try {
            await trainingStartOver(user.id);
        } catch (e) {
            NestiaWeb.logger.error('Error saveUserChoice', e);
            res.status(500).send('Internal error');
            // res.send({});
            //
            return;
        }
        res.send({});
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }
});

/* GET home page. */
router.get('/getMySummary', async function (req, res, ignoredNext) {
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
        let summary = await getUserTrainSummary(user.id);

        res.send(summary || {});
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }
});
export default router;
