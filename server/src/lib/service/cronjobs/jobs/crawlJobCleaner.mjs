import NestiaWeb from "nestia-web";
import Database from "../../../db/index.mjs";
import dayjs from "dayjs";

const LOG_PREFIX = '[CRAWLER_JOB_CLEANER] ';

const SQLS = {
    GET_SUCCESS_CRONJOB_SUMMARY: 'SELECT min(id) AS MIN, max(id) AS MAX, count(id) AS TOTAL FROM crawler_jobs WHERE status = \'COMPLETE\' AND create_time < ?',
    DELETE_SUCCESS_CRONJOB_SUMMARY: 'DELETE FROM crawler_jobs WHERE status = \'COMPLETE\' AND create_time < ?',
    GET_ALL_CRONJOB_SUMMARY: 'SELECT min(id) AS MIN, max(id) AS MAX, count(id) AS TOTAL FROM crawler_jobs WHERE create_time < ?',
    DELETE_ALL_CRONJOB_SUMMARY: 'DELETE FROM crawler_jobs WHERE  create_time < ?',
}
export default [
    {
        name: 'Crawler jobs Cleaner',
        cron: '15 1 * * sun',
        work: async function () {
            let today = dayjs(new Date());
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let conn = null;
            try {
                conn = await Database.borrow(dbName);
                let _3MonthsAgo = today.add(-3, 'M').valueOf();
                let _6MonthsAgo = today.add(-6, 'M').valueOf();
                let successSummary = await Database.doQuery(conn, SQLS.GET_SUCCESS_CRONJOB_SUMMARY, [
                    _3MonthsAgo
                ]);
                successSummary = successSummary[0];
                NestiaWeb.logger.info(LOG_PREFIX, `Crawl job success summary min_id:${successSummary.MIN} max_id:${successSummary.MAX} total:${successSummary.TOTAL}, deleting...`);
                await Database.doQuery(conn, SQLS.DELETE_SUCCESS_CRONJOB_SUMMARY, [
                    _3MonthsAgo
                ]);
                NestiaWeb.logger.info(LOG_PREFIX, 'Done.');
                let summary = await Database.doQuery(conn, SQLS.GET_ALL_CRONJOB_SUMMARY, [
                    _6MonthsAgo
                ]);
                summary = summary[0];
                NestiaWeb.logger.info(LOG_PREFIX, `Crawl job success summary min_id:${summary.MIN} max_id:${summary.MAX} total:${summary.TOTAL}, deleting...`);
                await Database.doQuery(conn, SQLS.DELETE_ALL_CRONJOB_SUMMARY, [
                    _6MonthsAgo
                ]);
                NestiaWeb.logger.info(LOG_PREFIX, 'Crawler job cleaning done.');
            } catch (e) {
                NestiaWeb.logger.error(LOG_PREFIX, 'Error cleaning crawling job', e);
            } finally {
                if (conn) {
                    Database.release(conn);
                }
            }


        }
    }
]