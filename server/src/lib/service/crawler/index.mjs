import NestiaWeb from 'nestia-web';
import Database from "../../db/index.mjs";
import {fileURLToPath} from 'url';
import path, {dirname} from "path";
import {requireFilesInPath} from "../../misc/utils.mjs";
import EventEmitter from "events";

const SQL = {
    NEW_JOB: 'INSERT INTO crawler_jobs(`type`,params,create_time,finish_time,status) VALUES (?,?,?,?,?)',
    GET_JOB_BY_STATUS: 'SELECT * FROM  crawler_jobs WHERE status = ? ORDER BY create_time LIMIT ?',
    UPDATE_JOB_STATUS: 'UPDATE  crawler_jobs SET status = ? WHERE id = ?',
    UPDATE_JOB_FINISH: 'UPDATE  crawler_jobs SET status = ? , finish_time = ? , message = ? WHERE id = ?'
}

const LOG_PREFIX = '[CRAWLER] ';

let crawlerInstances = {};

class Crawler extends EventEmitter {
    ready = false;
    running = false;

    init() {

        const __dirname = dirname(fileURLToPath(import.meta.url));

        requireFilesInPath(path.join(__dirname, 'executor'), null, (module) => {
            if (module && module.name) {
                crawlerInstances[module.name] = module;
            }
        }).then(ignore => {
        });
        this.ready = true;
        process.nextTick(async () => {
            await this.executeQueue();
        });
    }


    createCrawlerJob(type, params) {
        return {
            type: type,
            params: typeof params === 'function' ? params() : params
        };
    }


    async appendToCrawlerQueue(job) {
        if (!this.ready) {
            throw new Error('Crawler has no been init yet!');
        }

        let dbName = NestiaWeb.manifest.get('defaultDatabase');
        let conn = null;
        try {
            conn = await Database.borrow(dbName);
            await Database.doQuery(conn, SQL.NEW_JOB, [
                job.type,
                JSON.stringify(job.params),
                Date.now(),
                0,
                "INIT"
            ]);
            let id = await Database.doQuery(conn, 'SELECT LAST_INSERT_ID() AS ID', []);
            id = id[0]['ID'];
            job.id = id;
            NestiaWeb.logger.info(LOG_PREFIX, 'Crawl job appended to queue', JSON.stringify(job));
        } catch (e) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error saving crawling job', e);
        } finally {
            if (conn) {
                Database.release(conn);
            }
        }
        process.nextTick(async () => {
            await this.executeQueue();
        });

        return job;
    }

    async executeJobImmediate(job) {
        if (!this.ready) {
            throw new Error('Crawler has no been init yet!');
        }

        let dbName = NestiaWeb.manifest.get('defaultDatabase');
        let conn = null;
        try {
            conn = await Database.borrow(dbName);
            await Database.doQuery(conn, SQL.NEW_JOB, [
                job.type,
                JSON.stringify(job.params),
                Date.now(),
                0,
                "RUNNING"
            ]);
            let id = await Database.doQuery(conn, 'SELECT LAST_INSERT_ID() AS ID', []);
            id = id[0]['ID'];
            job.id = id;
            NestiaWeb.logger.info(LOG_PREFIX, 'Crawl job appended to queue', JSON.stringify(job));

            let executor = this.getExecutor(job);
            let result;
            if (executor) {
                result = await executor.execute(job.params);
                NestiaWeb.logger.info(LOG_PREFIX, 'Crawl job done', JSON.stringify(job));
            } else {
                NestiaWeb.logger.warn(LOG_PREFIX, 'Crawl NO executor for job', JSON.stringify(job));
            }
            await Database.doQuery(conn, SQL.UPDATE_JOB_STATUS, [
                "COMPLETE",
                job.id
            ]);
            return result;
        } catch (e) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error saving crawling job', e);
            return null;
        } finally {
            if (conn) {
                Database.release(conn);
            }
        }
        process.nextTick(async () => {
            await this.executeQueue();
        });
    }

    async executeQueue() {
        if (!this.ready) {
            throw new Error('Crawler has no been init yet!');
        }
        if (this.running) {
            return;
        }
        let dbName = NestiaWeb.manifest.get('defaultDatabase');
        let conn = null;
        let toCrawl;
        NestiaWeb.logger.info(LOG_PREFIX, 'Crawl queue start');
        try {
            this.running = true;
            conn = await Database.borrow(dbName);
            while (true) {
                toCrawl = await Database.doQuery(conn, SQL.GET_JOB_BY_STATUS, [
                    "INIT",
                    1
                ]);
                if (!toCrawl || !toCrawl.length) {
                    break;
                }

                let job = toCrawl[0];
                job.params = JSON.parse(job.params);

                NestiaWeb.logger.info(LOG_PREFIX, 'Crawl start job execution', JSON.stringify(job));
                try {
                    await Database.doQuery(conn, SQL.UPDATE_JOB_STATUS, [
                        "RUNNING",
                        job.id
                    ]);
                    let executor = this.getExecutor(job);
                    if (executor) {
                        try { await executor.execute(job.params);} catch (e) {
                            //job execution result should not affect job status
                            NestiaWeb.logger.info(LOG_PREFIX, 'Error happens whe executing job', JSON.stringify(job));
                            NestiaWeb.logger.info(LOG_PREFIX, e && e.message, e);
                        }
                        NestiaWeb.logger.info(LOG_PREFIX, 'Crawl job done', JSON.stringify(job));
                    } else {
                        NestiaWeb.logger.warn(LOG_PREFIX, 'Crawl NO executor for job', JSON.stringify(job));
                    }
                    await Database.doQuery(conn, SQL.UPDATE_JOB_FINISH, [
                        "COMPLETE",
                        Date.now(),
                        '',
                        job.id
                    ]);
                } catch (e) {
                    NestiaWeb.logger.error(LOG_PREFIX, 'Crawl job failed', JSON.stringify(job), e);
                    await Database.doQuery(conn, SQL.UPDATE_JOB_FINISH, [
                        "FAILED",
                        Date.now(),
                        e.message ? e.message.substr(0, 1000) : "FAILED",
                        job.id
                    ]);
                }


            }
            NestiaWeb.logger.info(LOG_PREFIX, 'Crawl queue done');
        } catch (e) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error saving crawling job', e);
        } finally {
            this.running = false;
            if (conn) {
                Database.release(conn);
            }
        }
    }

    getExecutor(job) {
        return crawlerInstances[job.type] || null;
    }
}


let instance = new Crawler();

/*NestiaWeb.on('INITED', function () {
    instance.init();
});*/

export {default as CrawlerConst} from './CrawlerConst.mjs' ;

export default instance;
