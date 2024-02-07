import express from 'express';
import globalEvent from "../lib/misc/globalEvent.mjs";
import NestiaWeb from "nestia-web";

const router = express.Router();


/* GET home page. */
router.get('/', function (req, res, ignoredNext) {
    res.render('index.ejs', {});
});

router.use('/callback', function (req, res, next) {
    let data = {};
    if (req.query.type === 'GET') {
        data = req.query;
    } else if (req.query.type === 'POST') {
        data = req.body;
    } else {
        next();
        return;
    }
    NestiaWeb.logger.info('Received callback:', data);
    let id = req.query.id;
    globalEvent.emit("CALLBACK_" + id, data);
    res.send('ok');
});


router.use('/static', express.static('resources', {index: false}));

router.get('/robots.txt', function (req, res, ignoredNext) {
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});

export default router;
