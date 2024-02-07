import express from 'express';
import NestiaWeb from 'nestia-web';
import path from 'path';
import fs from 'fs';
import {v4 as uuid} from 'uuid';


const router = express.Router();

router.post('/upload', function (req, res) {
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
            file: fileName,
            size: file.size
        });
    }
    res.send(result);
});


export default router;
