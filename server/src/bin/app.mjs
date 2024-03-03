import express from "express";

import cluster from 'cluster';
import path from "path";
import fs from "fs";
import os from "os";
import CookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import FileStreamRotator from "file-stream-rotator";
import Morgan from "morgan";
import IP from "ip";


import NestiaWeb from "nestia-web";
import helper from "../helpers/index.mjs";
// import {loginFilter, permissionFilter} from "../lib/misc/permissionFilter.mjs";
import CronJobs from "../lib/service/cronjobs/index.mjs";
import {requireFilesInPath} from "../lib/misc/utils.mjs";
import RegisterEvents from "../lib/service/eventRegister.mjs";
import {default as middlewareConfig} from "./middlewareConfig.mjs";


const LOG_FORMAT = ':remote-addr [:date] ":method :url HTTP/:http-version" :status ":response-time[3]" ":req[content-length]" ":res[content-length]" ":referrer" ":user-agent"  ":req[x-device-user-agent]" ":req[authorization]" ":cookieToken" ":req[x-forwarded-for]" ';

Morgan.token('date', function () {
    let date = new Date();
    let fz = function (str, len) {
        str = '' + str;
        while (str.length < len) {
            str = '0' + str;
        }
        return str;
    };
    return date.getFullYear() + '/' + fz(date.getMonth() + 1, 2) + '/' + fz(date.getDate(), 2) + ' ' + fz(date.getHours(), 2) + ':' + fz(date.getMinutes(), 2) + ':' + fz(date.getSeconds(), 2) + '.' + fz(date.getMilliseconds(), 3);
});

Morgan.token('cookieToken', function (req) {
    let cookies = req.headers['cookie'] || '';
    let result = '-', matches = cookies.match(/(^|[ ;])token=[^=; $]+/);
    if (matches) {
        matches = matches[0].match(/(^|[ ;])token=([^=; $]+)/)
        if (matches) {
            result = matches[2];
        }
    }
    return result;
});


const workPath = process.cwd();

export default async function () {

    let logDirectory = (() => {
        let logDirectory = path.resolve(path.join(workPath, 'logs', process.env.INSTANCE_ID || ''));
        try {
            fs.accessSync(logDirectory, fs.constants.W_OK);
        } catch (e) {
            fs.mkdirSync(logDirectory, {recursive: true})
        }
        return logDirectory;
    })();

    let accessLogStream = FileStreamRotator.getStream({
        date_format: 'YYYYMMDD',
        filename: path.join(logDirectory, 'access.%DATE%.log'),
        frequency: 'daily',
        verbose: false
    });


// create a rotating write stream
    let errorLogStream = FileStreamRotator.getStream({
        date_format: 'YYYYMMDD',
        filename: path.join(logDirectory, '5xx.%DATE%.log'),
        frequency: 'daily',
        verbose: false
    });
    
    middlewareConfig.log.extraZipStreams.push(accessLogStream);
    middlewareConfig.log.extraZipStreams.push(accessLogStream,errorLogStream);

    let app = express();
    middlewareConfig.common.expressApp=app;

    app.set('trust proxy', true);
    app.set('views', path.resolve(path.join(workPath, 'views')));
    app.set('view engine', 'ejs');
    // app.set('view cache', true);
    app.set('view options', {
        async: false,
        context: helper.buildRenderContext()
    });

    app.use(Morgan(LOG_FORMAT, {stream: accessLogStream}));

    // setup the logger
    app.use(Morgan(LOG_FORMAT, {
        stream: errorLogStream,
        skip: function (req, res) {
            return res.statusCode < 400
        }
    }));

    app.use(function (req, res, next) {
        res.set('X-Powered-By', 'Ds3783 Web Master');
        //reverse x-forwarded-for
        req.headers['x-forwarded-for'] = req.ips.reverse().filter(function (ip) {
            return IP.isV4Format(ip) || IP.isV6Format(ip);
        }).join(', ');
        next();
    });

    app.use(express.urlencoded({extended: false}));
    app.use(express.json());
    app.use(CookieParser());
    app.use(fileUpload({
        limits: {fileSize: 50 * 1024 * 1024},
        useTempFiles: true,
        tempFileDir: os.tmpdir(),
    }));


    NestiaWeb.on('INITED', function () {
        process.env.DEV_MODE = NestiaWeb.manifest.get('type');
        app.set('view options', {
            async: false,
            context: helper.buildRenderContext()
        });
        if (cluster.isPrimary || (cluster.worker && cluster.worker.id) === 1) {
            //init cron jobs
            CronJobs(true);
            
        }else{
            CronJobs(false);
        }

        app.use('*/healthcheck.html', express.static(path.join(__dirname, '../healthcheck.html'), {
            fallthrough: false
        }));
        
        RegisterEvents();
    });
    NestiaWeb.init(middlewareConfig);


    // app.use(loginFilter, permissionFilter);

    //Routes
    (function () {
        "use strict";
        let routesRoot = path.join(workPath, 'src', 'routes');


        requireFilesInPath(routesRoot, function (file) {
            return file === 'index.js' || file === 'index.mjs'
        }, async (module, file, dir) => {
            app.use('/' + path.relative(routesRoot, dir), module);
        }).then(() => {
        });
    })();

    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
    process.on("uncaughtException", (e) => {
        NestiaWeb.logger.fatal("Unhandled Crash Exception(Causing crash):" + e.message, e);
    });

    process.on("unhandledRejection", (e) => {
        NestiaWeb.logger.fatal("Unhandled Reject Exception(Causing crash):" + e.message, e);
    });


    process.on('exit', (ignoredCode) => {
        NestiaWeb.shutdown();
    });
    return app;
};
