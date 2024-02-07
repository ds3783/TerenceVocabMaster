import CrawlerConst from "../../CrawlerConst.mjs";
import AbstractCrawler from "../../AbstractCrawler.mjs";
import NestiaWeb from "nestia-web";
import DataBase from "../../../../db/index.mjs";
import dayjs from 'dayjs';
import {parse as parseHtml} from "node-html-parser";
import globalEvent from "../../../../misc/globalEvent.mjs";


const LOG_PREFIX = '[UPDATE_FUND_BLACKROCK_TODAY_NAV] ';


const BLACK_ROCK_MAPPING = {
    WORLD_HEALTHSCIENCE_FUND: 'https://www.blackrock.com/americas-offshore/en/products/229338/blackrock-world-healthscience-a2-usd-fund',
    WORLD_FINANCIALS_FUND: 'https://www.blackrock.com/americas-offshore/en/products/229936/blackrock-world-financials-a2-usd-fund',
}

const SQLS = {
    GET_QUOTE_HISTORY: 'SELECT * FROM quote_price_history WHERE quote_id = ? AND `date` = ?',
    INSERT_QUOTE_HISTORY: 'INSERT INTO quote_price_history(open , high , low , close , adjusted_close , volume , dividend_amount , split_coefficient , quote_id , `date`) VALUES (?,?,?,?,?,?,?,?,?,?)',
}

class BlackrockFundsTodayNav extends AbstractCrawler {
    name = CrawlerConst.UPDATE_FUND_BLACKROCK_TODAY_NAV;


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


        let url = this.replaceUrl(BLACK_ROCK_MAPPING[params.code], params);


        let data = await this.httpRequest({
            url: url,
            method: 'GET',
            resContentType: 'text'
        });
        let html = data?.data || '';
        let htmlObj = parseHtml(html, {
            comment: false,
            blockTextElements: {
                script: true,
                noscript: false,
                style: false,
                pre: false,
            }
        });


        let navDateStr = htmlObj.querySelector('#fundheaderTabs .header-nav-label');
        if (navDateStr) {
            navDateStr = navDateStr.text;
        } else {
            navDateStr = '';
        }
        let priceStr = htmlObj.querySelector('#fundheaderTabs .header-nav-data');
        if (priceStr) {
            priceStr = priceStr.text;
        } else {
            priceStr = '';
        }
        if (!navDateStr || !priceStr) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error fetch data from url:' + url);
            throw new Error(`Error quote[${params.market}:${params.code}]@${date} fund nav data!`);
        }
        //NAV as of Oct 11, 2021
        //USD 62.74
        navDateStr = navDateStr.replace(/^\s*NAV as of (\w.*\w)\s*$/, '$1');
        priceStr = priceStr.replace(/^\s*USD\s*([\d.]+)\s*$/, '$1');

        let parsedDate = dayjs(navDateStr).format('YYYY-MM-DD');

        NestiaWeb.logger.info(LOG_PREFIX, `Successful fetch data for quote[${params.market}:${params.code}]@${date}: {date:${navDateStr},price:${priceStr}}`);


        try {
            conn = await DataBase.borrow(dbName);
            let history = await DataBase.doQuery(conn, SQLS.GET_QUOTE_HISTORY, [
                params.id,
                parsedDate
            ]);
            if (!history.length) {
                let price = priceStr * 1;
                await DataBase.doQuery(conn, SQLS.INSERT_QUOTE_HISTORY, [price, price, price, price, price, -1, 0, 1, params.id, parsedDate]);
                NestiaWeb.logger.info(LOG_PREFIX, `Inserted quote[${params.market}:${params.code}]@${date} `);
                globalEvent.emit('QUOTE_HISTORY_UPDATE', {
                    quote_id: params.id,
                    date: parsedDate,
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

let instance = new BlackrockFundsTodayNav();

export default instance;