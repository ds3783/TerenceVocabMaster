import express from 'express';
import NestiaWeb from "nestia-web";
import {checkUserLogin} from "../../../../lib/service/user/index.mjs";
import {
    getUserNextTopic, getUserPreviousTopic, getUserTrainSummary, saveUserChoice,
    trainingStartOver
} from "../../../../lib/service/training/index.mjs";

const router = express.Router();

import {default as mistakeRouter} from './mistakes.mjs';
import {clearUserMistakenTopics} from "../../../../lib/service/training/mistakes.mjs";

router.use('/mistakes', mistakeRouter);

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
router.post('/deleteMyData', async function (req, res, ignoredNext) {
    let envString = req.body.env;
    let token = req.body.token;
    let openId = req.body.open_id;
    if (!openId || !token || !envString) {
        res.status(400).send('Invalid parameters');
        return;
    }
    let deletion = req.body.deletion;
    if (!deletion) {
        res.status(400).send('Invalid parameters');
        return;
    }
    deletion = JSON.parse(deletion);
    try {
        let checked = await checkUserLogin(openId, envString, token);
        if (!checked.result) {
            res.status(401).send('Invalid user or token expired');
            return;
        }
        let user = checked.user;
        if (deletion.training_data) {
            try {
                await trainingStartOver(user.id);
            } catch (e) {
                NestiaWeb.logger.error('Error saveUserChoice', e);
                res.status(500).send('Internal error');
                // res.send({});
                //
                return;
            }
        }
        if (deletion.mistake_data) {
            //delete mistake data
            try {
                await clearUserMistakenTopics(user.id);
            } catch (e) {
                NestiaWeb.logger.error('Error saveUserChoice', e);
                res.status(500).send('Internal error');
                // res.send({});
                //
                return;
            }
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
    let full = req.query.full === 'true';
    try {
        let checked = await checkUserLogin(openId, envString, token);
        if (!checked.result) {
            res.status(401).send('Invalid user or token expired');
            return;
        }
        let user = checked.user;
        let summary = await getUserTrainSummary(user.id, full);

        res.send(summary || {});
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }
});
export default router;
