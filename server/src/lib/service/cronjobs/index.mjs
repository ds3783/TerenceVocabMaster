import Cron from 'node-cron';


import NestiaWeb from 'nestia-web';
import path, {dirname} from "path";
import {fileURLToPath} from 'url';
import fs from "fs";
import {requireFilesInPath} from "../../misc/utils.mjs";

let cronJobs = [];


export function triggerJob(name) {
    NestiaWeb.logger.info(`Triggering cron job [${name}]`);
    for (const job of cronJobs) {
        NestiaWeb.logger.info(`Checking cron job [${job.name}], equals [${job.name.replace(/\s/g, '') === name.replace(/\s/g, '')}]`);
        if (job.name.replace(/\s/g, '') === name.replace(/\s/g, '')) {
            try {
                NestiaWeb.logger.info(`Starting cron job [${job.name}]`);
                job.work();
            } catch (e) {
                NestiaWeb.logger.error(`Failed to run cron job [${job.name}]`);
                NestiaWeb.logger.error(e);
            }
            return true;
        }
    }
    return false;
}

export default function (schedule) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    (function () {
        "use strict";
        let routesRoot = path.join(__dirname, 'jobs');


        if (fs.existsSync(routesRoot)) {
            requireFilesInPath(routesRoot, null, async (module) => {
                if (Array.isArray(module)) {
                    for (const job of module) {
                        try {
                            cronJobs.push(job);
                            if (schedule) {
                                Cron.schedule(job.cron, job.work, null);
                                NestiaWeb.logger.info(`Scheduled [${job.name}]@{${job.cron}}`);
                            } else {
                                NestiaWeb.logger.info(`Registered [${job.name}]@{${job.cron}}`);
                            }

                        } catch (e) {
                            NestiaWeb.logger.error(`Failed to schedule [${job.name}]@{${job.cron}}`);
                            NestiaWeb.logger.error(e);
                        }
                    }
                }
            }).then(() => {
            });
        }
    })();
}