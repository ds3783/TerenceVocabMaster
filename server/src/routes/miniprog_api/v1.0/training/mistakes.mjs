import express from 'express';
import NestiaWeb from "nestia-web";
import {checkUserLogin} from "../../../../lib/service/user/index.mjs";

import {
    getUserTrainSummary, saveUserChoice, trainingStartOver
} from "../../../../lib/service/training/index.mjs";
import {
    getUserNextMistakeTopic, getUserNextRandomMistakeTopic,
    getUserPreviousMistakeTopic,
    saveBoosterChoice
} from "../../../../lib/service/training/mistakes.mjs";

const router = express.Router();


/* GET home page. */
router.get('/loadNextMistakeTopic', async function (req, res, ignoredNext) {
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
        let topic = await getUserNextMistakeTopic(user.id, currentTopicSequence);

        if (topic) {
            let previous = await getUserPreviousMistakeTopic(user.id, topic.sequence);
            let next = await getUserNextMistakeTopic(user.id, topic.sequence);
            res.send({
                topic: topic,
                hasPrevious: !!previous,
                hasNext: !!next,
            })
        } else {
            res.send({
                noMoreTopics: true
            });
        }
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }

});

router.get('/loadPreviousMistakeTopic', async function (req, res, ignoredNext) {
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
        let topic = await getUserPreviousMistakeTopic(user.id, currentTopicSequence);

        if (topic) {
            let previous = await getUserPreviousMistakeTopic(user.id, topic.sequence);
            res.send({
                topic: topic,
                hasPrevious: !!previous,
                hasNext: true,
            })
        } else {
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



router.get('/loadNextBoostingTopic', async function (req, res, ignoredNext) {
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
        let topic = await getUserNextRandomMistakeTopic(user.id);

        if (topic) {
            res.send({
                topic: topic,
            })
        } else {
            res.send({
                noMoreTopics: true
            });
        }
    } catch (e) {
        NestiaWeb.logger.error('Error fetch authorization', e);
    }

});



/* GET home page. */
router.post('/saveBoostingTopicChoice', async function (req, res, ignoredNext) {
    let envString = req.body.env;
    let token = req.body.token;
    let openId = req.body.open_id;
    if (!openId || !token || !envString) {
        res.status(400).send('Invalid parameters');
        return;
    }
    let topicId = req.body.topic_id;
    let choice = req.body.choice;
    let shuffle = req.body.shuffle;
    if (!topicId || !choice||!shuffle) {
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
            await saveBoosterChoice(user.id, topicId, choice,shuffle);
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
export default router;
