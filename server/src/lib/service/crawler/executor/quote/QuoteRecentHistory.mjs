import CrawlerConst from "../../CrawlerConst.mjs";
import AbstractCrawler from "../../AbstractCrawler.mjs";
import NestiaWeb from "nestia-web";
import DataBase from "../../../../db/index.mjs";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import {getMarketInfo} from "../../../../misc/utils.mjs";
import globalEvent from "../../../../misc/globalEvent.mjs";

dayjs.extend(utc);


const History_URL = 'https://tvc4.investing.com/${carrier}/${now}/1/1/8/history?symbol=${symbol}&resolution=D&from=${startTime}&to=${endTime}';
const Symbol_URL = 'https://tvc4.investing.com/${carrier}/${now}/1/1/8/symbols?symbol=${marketForInvestingCom}%20%3A${code}';

const LOG_PREFIX = '[QUOTE_RECENT_HISTORY_CRAWLER] ';

const SQLS = {
    GET_QUOTE: 'SELECT * FROM quote WHERE code = ? AND market = ?',
    GET_QUOTE_HISTORY: 'SELECT * FROM quote_price_history WHERE quote_id = ? AND `date` = ?',
    INSERT_QUOTE_HISTORY: 'INSERT INTO quote_price_history(open , high , low , close , adjusted_close , volume , dividend_amount , split_coefficient , quote_id , `date`) VALUES (?,?,?,?,?,?,?,?,?,?)',
    UPDATE_QUOTE_HISTORY: 'UPDATE quote_price_history SET open = ? , high = ? , low = ? , close = ?, adjusted_close = ? , volume = ? , dividend_amount = ? , split_coefficient = ? WHERE  quote_id = ? AND `date` = ?',
    GET_QUOTE_INFO_SUMMARY: 'SELECT id, last_pricing_update_date FROM quote_info WHERE id = ?',
    UPDATE_QUOTE_LAST_PRICING_UPDATE_DATE: 'UPDATE quote_info SET last_pricing_update_date = ?  WHERE id = ?',
}

class QuoteHistory extends AbstractCrawler {
    name = CrawlerConst.UPDATE_QUOTE_RECENT_HISTORY;

    randomStr(len) {
        const charset = '0123456789abcdef'.split('');
        let result = '';
        while (result.length < len) {
            result += charset[Math.floor(Math.random() * charset.length)];
        }
        return result;
    }

    /*
    * {"name":"AAPL","exchange-traded":"NASDAQ","exchange-listed":"NASDAQ ","timezone":"America\/New_York","minmov":1,"minmov2":0,"pricescale":100,"pointvalue":1,"has_intraday":true,"has_no_volume":false,"volume_precision":3,"ticker":"6408","description":"Apple Inc, United States","type":"Stock","has_daily":true,"has_weekly_and_monthly":true,"supported_resolutions":["1","5","15","30","60","300","D","W","M","45","120","240"],"intraday_multipliers":["1","5","15","30","60","300"],"session":"2;0930-1600:23456","data_status":"streaming"}
    * */
    async getInvestingSymbol(params) {
        params.carrier = this.randomStr(32);
        params.now = Math.floor(Date.now() / 1000);
        params.marketForInvestingCom = params.market;
        params = Object.assign({}, params);
        switch (params.market) {
            case 'SZSE':
                switch (params.code) {
                    case '399001':
                        params.code = 'SZI';
                        break;

                }
                params.marketForInvestingCom = 'Shenzhen';
                break;
            case 'SSE':
                switch (params.code) {
                    case '000001':
                        params.code = 'SSEC';
                        break;

                }
                params.marketForInvestingCom = 'Shanghai';
                break;
            case 'SEHK':
                params.code = params.code.replace(/^0/, '');
                params.marketForInvestingCom = 'Hong%20Kong';
                break;
        }

        let symbolUrl = this.replaceUrl(Symbol_URL, params);
        let data = await this.browserRequest({
            url: symbolUrl,
            method: 'GET',
            type: 'COMMON_JSON',
            sync:false,
        });
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        let symbol = data?.ticker || '';
        if (!symbol) {
            throw new Error('Unable to fetch symbol, url:' + symbolUrl);
        }
        return symbol;
    }

    async execute(params) {
        //params should be quote object
        // get investing.com symbol
        let symbol = await this.getInvestingSymbol(params);
        let today = dayjs(new Date());
        today = today.utc().set('h', 0).set('m', 0).set('s', 0).set('ms', 0);
        params.startTime = Math.floor(today.add(-10, 'd').toDate().getTime() / 1000);
        params.endTime = Math.floor(today.toDate().getTime() / 1000);
        params.carrier = this.randomStr(32);
        params.now = Math.floor(Date.now() / 1000);
        params.symbol = symbol;
        params.marketInfo = getMarketInfo(params.market);

        let url = this.replaceUrl(History_URL, params);


        let data = await this.browserRequest({
            url: url,
            method: 'GET',
            type: 'COMMON_JSON',
            sync: false,
        });

        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        if (!data || data.s !== 'ok') {
            throw new Error('History fetch failure, url:' + url);
        }

        /*
        * data sample:
        * {"t":[1631491200,1631577600,1631664000,1631750400,1631836800,1632096000,1632182400,1632268800,1632355200],"c":[149.55000305176,148.11999511719,149.0299987793,148.78999328613,146.05999755859,142.94000244141,143.42999267578,145.85000610352,146.83000183105],"o":[150.63000488281,150.35000610352,148.55999755859,148.44000244141,148.82000732422,143.80000305176,143.92999267578,144.44999694824,146.64999389648],"h":[151.41999816895,151.07000732422,149.44000244141,148.9700012207,148.82000732422,144.83999633789,144.60000610352,146.42999267578,147.08000183105],"l":[148.75,146.91000366211,146.36999511719,147.22099304199,145.75999450684,141.27000427246,142.7799987793,143.70010375977,145.63999938965],"v":[97785000,108412000,81631000,67882000,129869000,123040000,75168000,76404000,64513000],"vo":[0,0,0,0,0,0,0,0,0],"s":"ok"}
        * */

        for (let [idx, t] of data.t.entries()) {
            let entry = {
                quote_id: params.id,
                date: dayjs(new Date(t * 1000)).utc().format('YYYY-MM-DD'),
                open: data.o[idx],
                high: data.h[idx],
                low: data.l[idx],
                close: data.c[idx],
                adjusted_close: data.c[idx],
                volume: data.v[idx],
            };
            //force update last 2 day's movements
            await this.doIt(entry, idx >= data.t.length - 2);
            if (params.marketInfo.expectingDate === entry.date && params.marketInfo.shouldBeClosed) {
                //check db for event fired, if not fire quote price day movement update event 
                let shouldFireEvent = await this.updateQuoteInfo(entry.quote_id, entry.date);
                NestiaWeb.logger.info('Quote pricing event should fire:' + shouldFireEvent, entry);
                if (shouldFireEvent) {
                    globalEvent.emit('QUOTE_HISTORY_UPDATE', entry);
                }
            }
        }


    }

    async updateQuoteInfo(quote_id, updateDate) {
        //write to db:
        let dbName = NestiaWeb.manifest.get('defaultDatabase');
        let conn = null;
        try {
            conn = await DataBase.borrow(dbName);

            let info = await DataBase.doQuery(conn, SQLS.GET_QUOTE_INFO_SUMMARY, [quote_id]);
            if (!info.length) {
                NestiaWeb.logger.error('No info for quote id:' + quote_id);
                return false;
            }
            info = info[0];
            if (info['last_pricing_update_date'] === updateDate) {
                return false;
            }
            await DataBase.doQuery(conn, SQLS.UPDATE_QUOTE_LAST_PRICING_UPDATE_DATE, [updateDate, quote_id]);
            return true;

        } catch (e) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error do query', e);
            throw e;
        } finally {
            if (conn) {
                DataBase.release(conn);
            }
        }
    }

    async doIt(entry, forceUpdate) {
        NestiaWeb.logger.info(LOG_PREFIX, 'Get entry:', JSON.stringify(entry));
        //write to db:
        let dbName = NestiaWeb.manifest.get('defaultDatabase');
        let conn = null;
        try {
            conn = await DataBase.borrow(dbName);

            let history = await DataBase.doQuery(conn, SQLS.GET_QUOTE_HISTORY, [entry.quote_id, entry.date]);

            if (history.length) {
                if (!forceUpdate) {
                    NestiaWeb.logger.info(LOG_PREFIX, 'already in db, ignore');
                    return;
                }
                await DataBase.doQuery(conn, SQLS.UPDATE_QUOTE_HISTORY, [
                    entry.open,
                    entry.high,
                    entry.low,
                    entry.close,
                    entry.adjusted_close,
                    entry.volume,
                    0,
                    1,
                    entry.quote_id,
                    entry.date
                ]);
                NestiaWeb.logger.info(LOG_PREFIX, 'updated to db.');
            } else {
                await DataBase.doQuery(conn, SQLS.INSERT_QUOTE_HISTORY, [
                    entry.open,
                    entry.high,
                    entry.low,
                    entry.close,
                    entry.adjusted_close,
                    entry.volume,
                    0,
                    1,
                    entry.quote_id,
                    entry.date
                ]);
                NestiaWeb.logger.info(LOG_PREFIX, 'saved to db.');
            }

        } catch (e) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error do query', e);
            throw e;
        } finally {
            if (conn) {
                DataBase.release(conn);
            }
        }

    }

}

let instance = new QuoteHistory();

export default instance;