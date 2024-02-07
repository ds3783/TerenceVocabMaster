import NestiaWeb from "nestia-web";
import Crawler, {CrawlerConst} from "../../crawler/index.mjs";
import DataBase from "../../../db/index.mjs";
import {sleep} from "../../../misc/utils.mjs";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const LOG_PREFIX = '[UPDATE_QUOTE_HISTORY] ';

const SQLS = {
    GET_US_QUOTE: 'SELECT * FROM quote WHERE (market = \'NASDAQ\' OR market = \'NYSE\') AND `type` != \'FUND\' LIMIT ?,?',
    GET_CHINA_QUOTE: 'SELECT * FROM quote WHERE (market = \'SSE\' OR market = \'SZSE\') AND `type` != \'FUND\' LIMIT ?,?',
    GET_HK_QUOTE: 'SELECT * FROM quote WHERE (market = \'SEHK\') AND `type` != \'FUND\' LIMIT ?,?',
    GET_BLACKROCK_FUNDS: 'SELECT * FROM quote WHERE (market = \'BLACKROCK\') AND `type` = \'FUND\' LIMIT ?,?',
    GET_CIFM_FUNDS: 'SELECT * FROM quote WHERE (market = \'CIFM\') AND `type` = \'FUND\' LIMIT ?,?',
    GET_ALL_QUOTE: 'SELECT * FROM quote LIMIT ?,?',
    GET_QUOTE_UPDATE_INFO: 'SELECT * FROM quote_update_info WHERE quote_id = ?',
}

export default [
    {
        //update US stocks daily prices
        name: 'US Stock daily pricing update',
        cron: '20 4,5 * * tue-sat',
        work: async function () {
            NestiaWeb.logger.info(LOG_PREFIX, 'Fetch quotes for daily price update.');
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let conn = null;
            try {
                conn = await DataBase.borrow(dbName);

                let quotes, offset = 0, limit = 200;
                do {
                    quotes = await DataBase.doQuery(conn, SQLS.GET_US_QUOTE, [offset, limit]);
                    for (const quote of quotes) {
                        NestiaWeb.logger.info(LOG_PREFIX, ` create daily price update job for quote[${quote.market}:${quote.code}].`);
                        let historyJob = Crawler.createCrawlerJob(CrawlerConst.UPDATE_QUOTE_RECENT_HISTORY, {...quote});
                        await Crawler.appendToCrawlerQueue(historyJob);
                    }
                    offset += limit;
                } while (quotes && quotes.length > 0);

            } catch (e) {
                NestiaWeb.logger.error('Error do query', e);
                throw e;
            } finally {
                if (conn) {
                    DataBase.release(conn)
                }
            }

        }
    },
    {
        //update Big-A stocks daily prices
        name: 'Big-A Stock daily pricing update',
        cron: '20 15 * * mon-fri',
        work: async function () {
            NestiaWeb.logger.info(LOG_PREFIX, 'Fetch quotes for daily price update.');
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let conn = null;
            try {
                conn = await DataBase.borrow(dbName);

                let quotes, offset = 0, limit = 200;
                do {
                    quotes = await DataBase.doQuery(conn, SQLS.GET_CHINA_QUOTE, [offset, limit]);
                    for (const quote of quotes) {
                        NestiaWeb.logger.info(LOG_PREFIX, ` create daily price update job for quote[${quote.market}:${quote.code}].`);
                        let historyJob = Crawler.createCrawlerJob(CrawlerConst.UPDATE_QUOTE_RECENT_HISTORY, {...quote});
                        await Crawler.appendToCrawlerQueue(historyJob);
                    }
                    offset += limit;
                } while (quotes && quotes.length > 0);

            } catch (e) {
                NestiaWeb.logger.error('Error do query', e);
                throw e;
            } finally {
                if (conn) {
                    DataBase.release(conn)
                }
            }

        }
    },
    {
        //update Hong Kong stocks daily prices
        name: 'HK Stock daily pricing update',
        cron: '20 16 * * mon-fri',
        work: async function () {
            NestiaWeb.logger.info(LOG_PREFIX, 'Fetch quotes for daily price update.');
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let conn = null;
            try {
                conn = await DataBase.borrow(dbName);

                let quotes, offset = 0, limit = 200;
                do {
                    quotes = await DataBase.doQuery(conn, SQLS.GET_HK_QUOTE, [offset, limit]);
                    for (const quote of quotes) {
                        NestiaWeb.logger.info(LOG_PREFIX, ` create daily price update job for quote[${quote.market}:${quote.code}].`);
                        let historyJob = Crawler.createCrawlerJob(CrawlerConst.UPDATE_QUOTE_RECENT_HISTORY, {...quote});
                        await Crawler.appendToCrawlerQueue(historyJob);
                    }
                    offset += limit;
                } while (quotes && quotes.length > 0);

            } catch (e) {
                NestiaWeb.logger.error('Error do query', e);
                throw e;
            } finally {
                if (conn) {
                    DataBase.release(conn)
                }
            }

        }
    },
    {
        //update all stocks history prices
        name: 'Stock long period daily pricing update',
        cron: '30 5 * * *',
        work: async function () {
            NestiaWeb.logger.info(LOG_PREFIX, 'Fetch quotes for full history update.');
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let conn = null;
            try {
                conn = await DataBase.borrow(dbName);

                let quotes, offset = 0, limit = 200;
                do {
                    quotes = await DataBase.doQuery(conn, SQLS.GET_ALL_QUOTE, [offset, limit]);
                    for (const quote of quotes) {

                        let updateInfo = await DataBase.doQuery(conn, SQLS.GET_QUOTE_UPDATE_INFO, [quote.id]);
                        updateInfo = updateInfo[0];
                        let shouldUpdate = true;
                        if (updateInfo) {
                            let updateTime = updateInfo['last_history_update'];
                            if ((Date.now() - updateTime) / 86400000 < 10) {
                                //only update more than 10 days
                                shouldUpdate = false;
                            }
                        }
                        if (shouldUpdate) {
                            NestiaWeb.logger.info(LOG_PREFIX, ` create full history update job for quote[${quote.market}:${quote.code}].`);
                            let historyJob = Crawler.createCrawlerJob(CrawlerConst.UPDATE_QUOTE_HISTORY, {...quote});
                            await Crawler.appendToCrawlerQueue(historyJob);
                            //sleep 30 seconds
                            //We are pleased to provide free stock API service for our global community of users for up to 5 API requests per minute and 500 requests per day. 
                            await sleep(30000);
                        } else {
                            NestiaWeb.logger.info(LOG_PREFIX, ` full history updated recently for quote[${quote.market}:${quote.code}], skip.`);
                        }

                    }
                    offset += limit;
                } while (quotes && quotes.length > 0);

            } catch (e) {
                NestiaWeb.logger.error('Error do query', e);
                throw e;
            } finally {
                if (conn) {
                    DataBase.release(conn)
                }
            }

        }
    },
    {
        //update us market funds daily prices
        name: 'Blackrock funds daily nav update',
        cron: '35,45,55 1,2 * * tue-sat',
        work: async function () {
            NestiaWeb.logger.info(LOG_PREFIX, 'Fetch funds of US market.');
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let date = dayjs(new Date()).tz("Europe/London").format('YYYY-MM-DD');

            let conn = null;
            try {
                conn = await DataBase.borrow(dbName);

                let quotes, offset = 0, limit = 200;
                do {
                    quotes = await DataBase.doQuery(conn, SQLS.GET_BLACKROCK_FUNDS, [offset, limit]);
                    for (const quote of quotes) {

                        NestiaWeb.logger.info(LOG_PREFIX, ` create daily price update job for quote[${quote.market}:${quote.code}].`);
                        let historyJob = Crawler.createCrawlerJob(CrawlerConst.UPDATE_FUND_BLACKROCK_TODAY_NAV, {
                            ...quote,
                            date: date
                        });
                        await Crawler.appendToCrawlerQueue(historyJob);
                    }
                    offset += limit;
                } while (quotes && quotes.length > 0);

            } catch (e) {
                NestiaWeb.logger.error('Error do query', e);
                throw e;
            } finally {
                if (conn) {
                    DataBase.release(conn)
                }
            }

        }
    },
    {
        //update china market funds daily prices
        name: 'CIFM funds daily nav update',
        cron: '05,35 15-23 * * mon-fri',
        work: async function () {
            NestiaWeb.logger.info(LOG_PREFIX, 'Fetch funds of US market.');
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let date = dayjs(new Date()).tz("Asia/Shanghai").format('YYYY-MM-DD');

            let conn = null;
            try {
                conn = await DataBase.borrow(dbName);

                let quotes, offset = 0, limit = 200;
                do {
                    quotes = await DataBase.doQuery(conn, SQLS.GET_CIFM_FUNDS, [offset, limit]);
                    for (const quote of quotes) {

                        NestiaWeb.logger.info(LOG_PREFIX, ` create daily price update job for quote[${quote.market}:${quote.code}].`);
                        let historyJob = Crawler.createCrawlerJob(CrawlerConst.UPDATE_FUND_CIFM_TODAY_NAV, {
                            ...quote,
                            date: date
                        });
                        await Crawler.appendToCrawlerQueue(historyJob);
                    }
                    offset += limit;
                } while (quotes && quotes.length > 0);

            } catch (e) {
                NestiaWeb.logger.error('Error do query', e);
                throw e;
            } finally {
                if (conn) {
                    DataBase.release(conn)
                }
            }

        }
    },
]