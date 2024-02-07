import CrawlerConst from "../../CrawlerConst.mjs";
import NestiaWeb from "nestia-web";
import DataBase from "../../../../db/index.mjs";
import stream from "stream";
import path from "path";
import fs from "fs";
import readline from "readline";
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';

import AbstractQuoteCrawler from "./AbstractQuoteCrawler.mjs";
import {AASTOCKS_History_URL, BLACK_ROCK_MAPPING, CIFM_REQ_TEMPLATES, RAPID_ALPHA_VANTAGE} from "./consts.mjs";

dayjs.extend(utc);
dayjs.extend(customParseFormat);


const SQLS = {
    GET_QUOTE: 'SELECT * FROM quote WHERE code = ? AND market = ?',
    GET_QUOTE_HISTORY: 'SELECT * FROM quote_price_history WHERE quote_id = ? AND `date` = ?',
    UPDATE_QUOTE_HISTORY: 'UPDATE quote_price_history SET open = ? , high = ? , low = ? , close = ? , adjusted_close = ? , volume = ? , dividend_amount = ? , split_coefficient = ?  WHERE id = ?',
    INSERT_QUOTE_HISTORY: 'INSERT INTO quote_price_history(open , high , low , close , adjusted_close , volume , dividend_amount , split_coefficient , quote_id , `date`) VALUES (?,?,?,?,?,?,?,?,?,?)',
    GET_QUOTE_UPDATE_INFO: 'SELECT * FROM quote_update_info WHERE quote_id = ?',
    UPDATE_QUOTE_UPDATE_TIME: 'UPDATE quote_update_info SET last_history_update = ? WHERE quote_id = ?',
    INSERT_QUOTE_UPDATE_TIME: 'INSERT INTO quote_update_info (quote_id,last_history_update) VALUES  (?,?)',
}

const LOG_PREFIX = '[QUOTE_HISTORY] ';

class QuoteHistory extends AbstractQuoteCrawler {
    name = CrawlerConst.UPDATE_QUOTE_HISTORY;

    async execute(params) {
        let market = await this.getMarket(params.market);
        if (!market) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Failed get market:' + params.market);
            return;
        }

        if (market.type === 'FUND') {
            await this.fetchFundHistory(params, market);
        } else if (market.type === 'MARKET') {
            await this.fetchStockHistory(params, market);
        }

        let dbName = NestiaWeb.manifest.get('defaultDatabase');
        let conn = null;
        try {
            conn = await DataBase.borrow(dbName);
            let lastUpdate = await DataBase.doQuery(conn, SQLS.GET_QUOTE_UPDATE_INFO, [params.id]);
            let updateTime = dayjs().format('YYYY-MM-DD HH:mm:ss');
            if (lastUpdate.length) {
                await DataBase.doQuery(conn, SQLS.UPDATE_QUOTE_UPDATE_TIME, [updateTime, params.id]);
            } else {
                await DataBase.doQuery(conn, SQLS.INSERT_QUOTE_UPDATE_TIME, [params.id, updateTime]);
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

    async fetchStockHistory(params) {

        async function doIt(params, line) {
            if (!/^[\d-]+,[\d.]+,[\d.]+,[\d.]+,[\d.]+,[\d.]+,[\d.]+,[\d.]+,[\d.]+$/.test(line)) {
                NestiaWeb.logger.warn(LOG_PREFIX, 'Ignore invalid line:' + line);
                return;
            }
            //write to db:
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let conn = null;
            try {
                let parsedLine = line.split(',');
                conn = await DataBase.borrow(dbName);
                if (!params.id) {
                    let quote = await DataBase.doQuery(conn, SQLS.GET_QUOTE, [params.code, params.market]);
                    if (quote && quote[0]) {
                        params.id = quote[0].id;
                    }
                }
                let date = parsedLine[0];
                let history = await DataBase.doQuery(conn, SQLS.GET_QUOTE_HISTORY, [params.id, date]);
                let dbParams = parsedLine.splice(1);
                dbParams = dbParams.map((v) => {
                    return 1 * v;
                });
                if (history.length) {
                    dbParams.push(history[0].id);
                    await DataBase.doQuery(conn, SQLS.UPDATE_QUOTE_HISTORY, dbParams);
                    NestiaWeb.logger.info(LOG_PREFIX, `${params.code}@${date} updated!`);
                } else {
                    dbParams.push(params.id);
                    dbParams.push(date);
                    await DataBase.doQuery(conn, SQLS.INSERT_QUOTE_HISTORY, dbParams);
                    NestiaWeb.logger.info(LOG_PREFIX, `${params.code}@${date} created!`);
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

        let fileName;
        let cacheDir = path.join(process.cwd(), NestiaWeb.manifest.get('cacheDir'));
        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, {recursive: true});
        }
        if (params.market === 'SEHK') {
            //AASTOCKS_History_URL

            fileName = path.join(cacheDir, `${params.code}_${params.market}_history.csv`);
            let writeStream = fs.createWriteStream(fileName, {flags: 'w'});
            let data = await this.httpRequest({
                url: this.replaceUrl(AASTOCKS_History_URL, params),
                method: 'GET',
                resContentType: 'stream'
            });
            await (async function () {
                return new Promise((resolve, reject) => {
                    data.raw.on('end', function () {
                        writeStream.end('', 'utf-8', () => {
                            resolve();
                        });
                    });
                    data.raw.on('error', reject);
                    let cache = '';
                    data.raw.on('data', function (content) {
                        if (content instanceof Buffer) {
                            content = content.toString('utf-8');
                        }
                        content = cache + content;
                        cache = '';
                        let arr = content.split('|');
                        for (let i = 0; i < arr.length; i++) {
                            let string = arr[i];
                            if (i === arr.length - 1) {
                                cache = string;
                                break;
                            }
                            if (/^\d\d\/\d\d\/\d{4};[\d.]+;[\d.]+;[\d.]+;[\d.]+;[\d.]+;[\d.]+$/.test(string)) {
                                //from: date;o h l c vol(k) turn
                                //to:timestamp,open,high,low,close,adjusted_close,volume,dividend_amount,split_coefficient
                                let match = string.match(/^(\d\d)\/(\d\d)\/(\d{4});([\d.]+);([\d.]+);([\d.]+);([\d.]+);([\d.]+);([\d.]+)$/);
                                let result = `${match[3]}-${match[1]}-${match[2]},${match[4]},${match[5]},${match[6]},${match[7]},${match[7]},${Math.round(match[8] * 1000)},0,1.0`;
                                writeStream.write(result + '\n', 'utf-8');
                            } else {
                                NestiaWeb.logger.warn(LOG_PREFIX, 'Ignore line:' + string);
                            }
                        }

                    });
                });
            })();

            NestiaWeb.logger.info(LOG_PREFIX, fileName, ' is written to cache dir');
        } else {
            //params should be quote object
            // params.key = NestiaWeb.manifest.get('dataSource.alphavantage.key');
            params.outputsize = params.full ? 'full' : 'compact';
            let suffix = '';
            switch (params.market) {
                case 'SSE':
                    suffix = '.SHH';
                    break;
                case 'SZSE':
                    suffix = '.SHZ';
                    break;
            }
            // params = Object.assign({}, params, {code: params.code + suffix})
            // let url = this.replaceUrl(AlphaVantage_History_URL, params);
            fileName = path.join(cacheDir, `${params.code}_history.csv`);
            let writeStream = fs.createWriteStream(fileName, {flags: 'w'});

            let options = JSON.parse(JSON.stringify(RAPID_ALPHA_VANTAGE.quote_history));
            options.headers['x-rapidapi-key'] = NestiaWeb.manifest.get('dataSource.rapidapi.key')
            options.data['symbol'] = params.code + suffix;
            options.resContentType = 'stream';

            let data = await this.httpRequest(options);
            await (async function () {
                return new Promise((resolve, reject) => {
                    data.raw.on('end', function () {
                        resolve();
                    });
                    data.raw.on('error', reject);
                    data.raw.pipe(writeStream);
                });
            })();

            NestiaWeb.logger.info(LOG_PREFIX, fileName, ' is written to cache dir');
        }


        const fileStream = fs.createReadStream(fileName);
        // let $this = this;
        const rl = readline.createInterface({
            input: fileStream
        });

        for await (const line of rl) {
            await doIt(params, line);
        }


    }

    async fetchFundHistory(quote) {
        switch (quote.market) {
            case 'BLACKROCK':
                return await this.fetchBlackrockHistory(quote);
            case 'CIFM':
                return await this.fetchCIFMHistory(quote);
            default:
                throw new Error('Unsupported fund market:' + quote.market);
        }
    }


    async fetchBlackrockHistory(quote) {
        let url = BLACK_ROCK_MAPPING[quote.code];
        let htmlReq = await this.httpRequest({
            url: url,
            method: 'GET',
            resContentType: 'text'
        });
        let html = htmlReq.data;
        let lines = html.split('\n');
        let navHistoryStr = '';
        for (const line of lines) {
            if (/^var navData =/.test(line)) {
                navHistoryStr = line.replace(/^var navData = /, '');
                navHistoryStr = navHistoryStr.replace(/;\s*$/, '');
            }
        }
        if (navHistoryStr) {
            //write to db:
            let navHistory = navHistoryStr.split('},{');
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let conn = null;
            try {
                conn = await DataBase.borrow(dbName);
                for (const historyStr of navHistory) {
                    let matches = historyStr.match(/^\[?{?x:Date.UTC\((\d{4}),(\d{1,2}),(\d{1,2})\),y:Number\(\(([\d.]+)\).toFixed\(2\)\),formattedX:.*$/);

                    let dateStr = dayjs(Date.UTC(matches[1] * 1, matches[2] * 1, matches[3] * 1)).utc().format('YYYY-MM-DD');
                    let value = matches[4] * 1;
                    let dbParams = [value, value, value, value, value, -1, 0, 1];
                    let history = await DataBase.doQuery(conn, SQLS.GET_QUOTE_HISTORY, [quote.id, dateStr]);
                    if (history.length) {
                        dbParams.push(history[0].id);
                        await DataBase.doQuery(conn, SQLS.UPDATE_QUOTE_HISTORY, dbParams);
                        NestiaWeb.logger.info(LOG_PREFIX, `${quote.code}@${dateStr} updated!`);
                    } else {
                        dbParams.push(quote.id);
                        dbParams.push(dateStr);
                        await DataBase.doQuery(conn, SQLS.INSERT_QUOTE_HISTORY, dbParams);
                        NestiaWeb.logger.info(LOG_PREFIX, `${quote.code}@${dateStr} created!`);
                    }
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

    async fetchCIFMHistory(quote) {
        let detailReq = JSON.parse(JSON.stringify(CIFM_REQ_TEMPLATES['detail']));
        detailReq.data.fundCode = quote.code;

        let detailRes = await this.httpRequest(detailReq);
        detailRes = detailRes.data;
        if (detailRes.success && detailRes.data && detailRes.data.fundInfo) {
            let beginDate = detailRes.data.fundInfo.setUpDate;
            let endDate = detailRes.data.fundInfo.navDate;

            let historyReq = JSON.parse(JSON.stringify(CIFM_REQ_TEMPLATES['history']));
            historyReq.data.fundCode = quote.code;
            historyReq.data.begDate = beginDate;
            historyReq.data.endDate = endDate;
            let historyRes = await this.httpRequest(historyReq);
            historyRes = historyRes.data;
            if (historyRes.success && historyRes.data && historyRes.data.nav && Array.isArray(historyRes.data.nav)) {
                let dbName = NestiaWeb.manifest.get('defaultDatabase');
                let conn = null;
                try {
                    conn = await DataBase.borrow(dbName);
                    for (const navHistory of historyRes.data.nav) {
                        let dateStr = navHistory.date.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');

                        let value = navHistory.netValue;
                        let dbParams = [value, value, value, value, value, -1, 0, 1];
                        let history = await DataBase.doQuery(conn, SQLS.GET_QUOTE_HISTORY, [quote.id, dateStr]);
                        if (history.length) {
                            dbParams.push(history[0].id);
                            await DataBase.doQuery(conn, SQLS.UPDATE_QUOTE_HISTORY, dbParams);
                            NestiaWeb.logger.info(LOG_PREFIX, `${quote.code}@${dateStr} updated!`);
                        } else {
                            dbParams.push(quote.id);
                            dbParams.push(dateStr);
                            await DataBase.doQuery(conn, SQLS.INSERT_QUOTE_HISTORY, dbParams);
                            NestiaWeb.logger.info(LOG_PREFIX, `${quote.code}@${dateStr} created!`);
                        }
                    }


                } catch (e) {
                    NestiaWeb.logger.error(LOG_PREFIX, 'Error do query', e);
                    throw e;
                } finally {
                    if (conn) {
                        DataBase.release(conn);
                    }
                }
            } else {
                NestiaWeb.logger.error('Error fetch CIFM fund history', historyRes);
            }
        } else {
            NestiaWeb.logger.error('Error fetch CIFM fund detail', detailRes);
        }
    }


}

let instance = new QuoteHistory();

export default instance;