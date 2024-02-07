import CrawlerConst from "../../CrawlerConst.mjs";
import AbstractCrawler from "../../AbstractCrawler.mjs";
import NestiaWeb from "nestia-web";
import DataBase from "../../../../db/index.mjs";
import globalEvent from "../../../../misc/globalEvent.mjs";
import {CIFM_REQ_TEMPLATES} from "./consts.mjs";


const LOG_PREFIX = '[UPDATE_FUND_CIFM_TODAY_NAV] ';

const SQLS = {
    GET_QUOTE_HISTORY: 'SELECT * FROM quote_price_history WHERE quote_id = ? AND `date` = ?',
    INSERT_QUOTE_HISTORY: 'INSERT INTO quote_price_history(open , high , low , close , adjusted_close , volume , dividend_amount , split_coefficient , quote_id , `date`) VALUES (?,?,?,?,?,?,?,?,?,?)',
}

class CIFMFundsTodayNav extends AbstractCrawler {
    name = CrawlerConst.UPDATE_FUND_CIFM_TODAY_NAV;


    async execute(job) {
        let params = job;
        let date = params.date;
        let dbName = NestiaWeb.manifest.get('defaultDatabase');
        let conn = null;
        try {
            conn = await DataBase.borrow(dbName);

            let history = await DataBase.doQuery(conn, SQLS.GET_QUOTE_HISTORY, [
                params.id,
                date
            ]);

            if (history.length) {
                NestiaWeb.logger.info(LOG_PREFIX, `Quote[${params.market}:${params.code}]@${date} already in db`);
                return;
            }

        } catch (e) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error do query', e);
            throw e;
        } finally {
            if (conn) {
                DataBase.release(conn);
            }
        }

        let detailReq = JSON.parse(JSON.stringify(CIFM_REQ_TEMPLATES['detail']));
        detailReq.data.fundCode = params.code;

        let detailRes = await this.httpRequest(detailReq);
        detailRes = detailRes.data;

        let navDateStr, priceStr;
        if (detailRes.success && detailRes.data && detailRes.data.fundInfo) {
            navDateStr = detailRes.data.fundInfo.navDate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
            priceStr = detailRes.data.fundInfo.netValue;
        }


        if (!navDateStr || !priceStr) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error fetch data from CIFM:', detailReq);
            throw new Error(`Error quote[${params.market}:${params.code}]@${date} fund nav data!`);
        }


        NestiaWeb.logger.info(LOG_PREFIX, `Successful fetch data for quote[${params.market}:${params.code}]@${date}: {date:${navDateStr},price:${priceStr}}`);
        let parsedDate = navDateStr;

        try {
            conn = await DataBase.borrow(dbName);
            let history = await DataBase.doQuery(conn, SQLS.GET_QUOTE_HISTORY, [
                params.id,
                navDateStr
            ]);
            if (!history.length) {
                let price = priceStr * 1;
                await DataBase.doQuery(conn, SQLS.INSERT_QUOTE_HISTORY, [price, price, price, price, price, -1, 0, 1, params.id, parsedDate]);
                NestiaWeb.logger.info(LOG_PREFIX, `Inserted quote[${params.market}:${params.code}]@${date} `);
                globalEvent.emit('QUOTE_HISTORY_UPDATE', {
                    quote_id: params.id,
                    date: navDateStr,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    adjusted_close: price,
                });
            }
        } catch (e) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error do query', e);
            throw e;
        } finally {
            if (conn) {
                DataBase.release(conn);
            }
        }
        if (date !== parsedDate) {
            NestiaWeb.logger.warn(LOG_PREFIX, `Quote[${params.market}:${params.code}]@${date} not found, get:${parsedDate}`);
        }


    }


}

let instance = new CIFMFundsTodayNav();

export default instance;