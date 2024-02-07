import CrawlerConst from "../../CrawlerConst.mjs";
import NestiaWeb from "nestia-web";
import DataBase from "../../../../db/index.mjs";
import AbstractQuoteCrawler from "./AbstractQuoteCrawler.mjs";
import {parse as parseHtml} from "node-html-parser";
import {RAPID_YAHOO} from "./consts.mjs";

const Detail_URL = 'https://www.alphavantage.co/query?function=OVERVIEW&symbol=${code}&apikey=${key}';

const TU_API = 'https://api.waditu.com';
const TU_SHARE = {
    stock_basic: {
        "api_name": "stock_basic",
        "token": "",
        "params": {"ts_code": ""},
        "fields": "ts_code,symbol,name,area,industry,fullname,enname,cnspell,market,exchange,curr_type,list_status,list_date,delist_date,is_hs"
    },
    stock_company: {
        "api_name": "stock_company",
        "token": "",
        "params": {"ts_code": ""},
        "fields": "ts_code,exchange,chairman,manager,secretary,reg_capital,setup_date,province,city,introduction,website,email,office,ann_date,business_scope,employees,main_business"
    },
    bak_basic: {
        "api_name": "bak_basic",
        "token": "",
        "params": {"ts_code": ""},
        "fields": "ts_code,name,industry,area,pe,float_share,total_share,total_assets,liquid_assets,fixed_assets,reserved,reserved_pershare,eps,bvps,pb,list_date,undp,per_undp,rev_yoy,profit_yoy,gpr,npr,holder_num"
    }
}

const INVESTING = {
    search: 'https://api.investing.com/api/search/v2/search?q=${code}',
    detail: 'https://www.investing.com${url}',
}

const REPLACE_TU_RET = function (result) {
    const LIST_STATUS = {'L': '上市', 'D': '退市', 'P': '暂停上市'}
    const IS_HS = {'N': '否', 'H': '沪股通', 'S': '深股通'}
    const PROP_MAPPING = {
        'reg_capital': 'RegisterCapital',
        'setup_date': 'SetupDate',
        'main_business': 'MainBusiness',
        'business_scope': 'BusinessScope',
        'curr_type': 'CurrencyType',
        'list_status': 'ListStatus',
        'list_date': 'ListDate',
        'delist_date': 'DelistDate',
        'is_hs': '沪深港通',
        'ts_code': 'TradeCode',
        'float_share': '流通股本（万）',
        'total_share': '总股本（万）',
        'total_assets': '总资产（万）',
        'liquid_assets': '流动资产（万）',
        'fixed_assets': '固定资产（万）',
        'reserved': '公积金',
        'reserved_pershare': '每股公积金',
        'undp': '未分配利润',
        'per_undp': '每股未分配利润',
        'rev_yoy': '收入同比（%）',
        'profit_yoy': '利润同比（%）',
        'gpr': '毛利率（%）',
        'npr': '净利润率（%）',
        'holder_num': '股东人数',
    };
    let replaceMapping = function (result, prop, map) {
        let val = result[prop];
        if (map && map[val]) {
            result[prop] = map[val];
        }
    }
    if (result['list_status']) {
        replaceMapping(result, 'list_status', LIST_STATUS);
    }
    if (result['is_hs']) {
        replaceMapping(result, 'is_hs', IS_HS);
    }
    for (let key in PROP_MAPPING) {
        if (typeof result[key] !== 'undefined') {
            result[PROP_MAPPING[key]] = result[key];
            delete result[key];
        }
    }
    return result;

};

const SQLS = {
    GET_QUOTE_DETAIL: 'SELECT * FROM quote_info WHERE id = ?',
    UPDATE_QUOTE_DETAIL: 'UPDATE quote_info SET detail = ? , last_sync_time = ? WHERE id = ?',
    CREATE_QUOTE_DETAIL: 'INSERT INTO quote_info (id,detail,last_sync_time) VALUES (?,?,?)',
}

const LOG_PREFIX = '[QUOTE_DETAIL] ';

const BLACK_ROCK_MAPPING = {
    WORLD_HEALTHSCIENCE_FUND: 'https://www.blackrock.com/americas-offshore/en/products/229338/blackrock-world-healthscience-a2-usd-fund',
    WORLD_FINANCIALS_FUND: 'https://www.blackrock.com/americas-offshore/en/products/229936/blackrock-world-financials-a2-usd-fund',
}


const flat = function (obj) {
    let result = {};
    for (let key in obj) {
        let val = obj[key];
        if (val) {
            if (typeof val === 'object') {
                Object.assign(result, flat(val));
            } else {
                result[key] = val;
            }
        }
    }
    return result;
};


class QuoteDetail extends AbstractQuoteCrawler {
    name = CrawlerConst.UPDATE_QUOTE_DETAIL;

    async execute(params) {
        let market = await this.getMarket(params.market);
        if (!market) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Failed get market:' + params.market);
            return;
        }

        let detail;
        if (market.type === 'FUND') {
            detail = await this.fetchFundDetail(params, market);
        } else if (market.type === 'MARKET') {
            detail = await this.fetchStockDetail(params, market);
        }

        if (detail) {
            NestiaWeb.logger.info(LOG_PREFIX, 'Successful get quote detail:' + params.code);
            let dbName = NestiaWeb.manifest.get('defaultDatabase');
            let conn = null;
            try {
                conn = await DataBase.borrow(dbName);

                let detailRecord = await DataBase.doQuery(conn, SQLS.GET_QUOTE_DETAIL, [params.id]);
                if (detailRecord.length) {
                    detailRecord = detailRecord[0];
                    await DataBase.doQuery(conn, SQLS.UPDATE_QUOTE_DETAIL, [JSON.stringify(detail), new Date(), detailRecord.id]);
                } else {
                    await DataBase.doQuery(conn, SQLS.CREATE_QUOTE_DETAIL, [params.id, JSON.stringify(detail), new Date()]);
                }
                NestiaWeb.logger.info(LOG_PREFIX, 'Successful updated quote detail:' + params.code);
            } catch (e) {
                NestiaWeb.logger.error(LOG_PREFIX, 'Error do query', e);
                throw e;
            } finally {
                if (conn) {
                    DataBase.release(conn)
                }
            }
        } else {
            NestiaWeb.logger.error(LOG_PREFIX, 'Invalid quote detail response', JSON.stringify(params), JSON.stringify(detail));
        }

    }


    async fetchFundDetail(params, market) {
        switch (market.code) {
            case 'BLACKROCK':
                return await this.fetchBlackRockDetail(params);
        }
    }

    async fetchBlackRockDetail(params) {
        let url = BLACK_ROCK_MAPPING[params.code];
        let htmlReq = await this.httpRequest({
            url: url,
            method: 'GET',
            resContentType: 'text'
        });
        let html = htmlReq.data;
        let htmlObj = parseHtml(html, {
            comment: false,
            blockTextElements: {
                script: true,
                noscript: false,
                style: false,
                pre: false,
            }
        });

        let result = {};

        result['MorningstarRating'] = htmlObj.querySelector('#fundheaderTabs .morningstar-rating span').text;
        //return
        result['OneYearAnnualizedReturn'] = htmlObj.querySelector('#averageTabs .average-ann-returns tbody .oneYearAnnualized').text;
        result['ThreeYearsAnnualizedReturn'] = htmlObj.querySelector('#averageTabs .average-ann-returns tbody .threeYearAnnualized').text;
        result['FiveYearsAnnualizedReturn'] = htmlObj.querySelector('#averageTabs .average-ann-returns tbody .fiveYearAnnualized').text;
        result['TenYearsAnnualizedReturn'] = htmlObj.querySelector('#averageTabs .average-ann-returns tbody .tenYearAnnualized').text;

        //facts
        let factsTable = htmlObj.querySelector('#keyFundFacts .product-data-list');
        let facts = factsTable.querySelectorAll('div.float-left');
        for (let fact of facts) {
            let caption = fact.querySelector('.caption');
            let key = caption.text;
            key = key.replace(caption.querySelector('span').text, '');
            key = key.replace(/\s([a-z])/, ($1) => {
                return ($1 || '').toUpperCase();
            });
            key = key.replace(/\s/g, '');
            result[key] = fact.querySelector('.data').text;
        }

        for (let key in result) {
            if (result.hasOwnProperty(key)) {
                let value = result[key] || '';
                value = value.replace(/^\s+/, '');
                value = value.replace(/\s+$/, '');
                result[key] = value;
            }
        }

        return result;
    }

    async fetchStockDetail(params) {
        //params should be quote object
        if (!["NASDAQ", "NYSE"].includes(params.market)) {
            if (["SSE", "SZSE"].includes(params.market)) {
                //Big-A stock 
                return await this.fetchBigAStockDetail(params);
            } else if ('SEHK' === params.market) {
                //Hongkong stock 
                params.marketFlag = 'Hong_Kong';
                return await this.fetchInvestingStockDetail(params);
            } else {
                return {};
            }
        }
        //fetch detail from alphavantage
        params.key = NestiaWeb.manifest.get('dataSource.alphavantage.key');
        let suffix = '';
        switch (params.market) {
            /*case 'SSE':
                suffix='.SHH';
                break;
            case 'SZSE':
                suffix='.SHZ';
                break;*/
        }
        params = Object.assign({}, params, {code: params.code + suffix})
        let url = this.replaceUrl(Detail_URL, params);
        let result = await this.httpRequest({
            url: url,
            method: 'GET',
            resContentType: 'json'
        });
        //write to db:
        result = result && result.data;
        if (!result || Object.keys(result).length === 0) {
            NestiaWeb.logger.warn(LOG_PREFIX, 'Invalid result from alpha advantage:' + JSON.stringify(result));
            let options = JSON.parse(JSON.stringify(RAPID_YAHOO.quote_detail));
            options.headers['x-rapidapi-key'] = NestiaWeb.manifest.get('dataSource.rapidapi.key')
            options.data['symbol'] = params.code;
            if ('Hong_Kong' === params.marketFlag) {
                options.data['region'] = 'HK';
            }

            result = await this.httpRequest(options);
            result = result && result.data;
            if (typeof result === 'string') {
                result = JSON.parse(result);
            }
            NestiaWeb.logger.warn(LOG_PREFIX, 'Get data from yahoo(rapid api):' + JSON.stringify(result));
            if (result) {
                result = flat(result);
            }
        }
        return result;
    }

    async fetchBigAStockDetail(params) {
        let filterParam = function (template, options) {
            const MARKET_MAPPING = {
                'SSE': 'SH',
                'SZSE': 'SZ',
            };
            let result = Object.assign({}, template);
            result.token = options.token;
            result.params = result.params || {};
            result.params.ts_code = options.code + '.' + (MARKET_MAPPING[options.market] || options.market);
            return result;
        };

        let filterResult = function (data, singleRow) {
            if (!data.fields || !data.fields.length) {
                return singleRow ? {} : [];
            }
            if (Array.isArray(data.items)) {
                let result = singleRow ? {} : [];
                let fields = data.fields;
                for (const item of data.items) {
                    let transformedItem = {};
                    for (let i = 0; i < fields.length; i++) {
                        const field = fields[i];
                        if (singleRow) {
                            result[field] = item[i];
                        } else {
                            transformedItem[field] = item[i];
                        }
                    }
                    if (!singleRow) {
                        result.push(transformedItem);
                    }
                }
                return result;
            } else {
                return singleRow ? {} : [];
            }
        }


        let token = NestiaWeb.manifest.get('dataSource.tuShare.token');

        let opts;


        opts = Object.assign({}, params, {token});

        let basicResult = await this.httpRequest({
            url: TU_API,
            method: 'POST',
            reqContentType: 'json',
            resContentType: 'json',
            data: filterParam(TU_SHARE['stock_basic'], opts)
        });

        basicResult = basicResult?.data?.data || {};
        basicResult = filterResult(basicResult, true);

        opts = Object.assign({}, params, {token});

        let companyResult = await this.httpRequest({
            url: TU_API,
            method: 'POST',
            reqContentType: 'json',
            resContentType: 'json',
            data: filterParam(TU_SHARE['stock_company'], opts)
        });

        companyResult = companyResult?.data?.data;
        companyResult = filterResult(companyResult, true);


        opts = Object.assign({}, params, {token});

        let optResult = await this.httpRequest({
            url: TU_API,
            method: 'POST',
            reqContentType: 'json',
            resContentType: 'json',
            data: filterParam(TU_SHARE['bak_basic'], opts)
        });

        optResult = optResult?.data?.data;

        optResult = filterResult(optResult, true);

        let ret = Object.assign({}, basicResult, companyResult, optResult);
        return REPLACE_TU_RET(ret);

    }

    async fetchInvestingStockDetail(params) {
        let opts;
        opts = Object.assign({}, params);

        let searchResult = await this.httpRequest({
            url: this.replaceUrl(INVESTING.search, params),
            method: 'GET',
            resContentType: 'json'
        });

        searchResult = searchResult?.data?.quotes || [];
        let quote = null;
        for (const q of searchResult) {
            if (q.flag === params.marketFlag) {
                quote = q;
                break;
            }
        }
        if (!quote) {
            NestiaWeb.logger.error(LOG_PREFIX, `Unable find investing quote [${opts.market}:${opts.code}]`);
            return {};
        }
        let detailResult = await this.httpRequest({
            url: this.replaceUrl(INVESTING.detail, quote),
            method: 'GET',
            resContentType: 'text',
        });

        detailResult = detailResult?.data;

        let htmlObj = parseHtml(detailResult, {
            comment: false,
            blockTextElements: {
                script: false,
                noscript: false,
                style: false,
                pre: false,
            }
        });

        let infoTable = htmlObj.querySelector('[data-test="key-info"]');
        let infoArr = infoTable.querySelectorAll('div.flex');

        let ret = {};
        for (const info of infoArr) {
            let key = info.querySelector('dt')?.text;
            let val = info.querySelector('dd')?.text;
            if (key && val) {
                ret[key] = val;
            }
        }
        return (ret);

    }


}

let instance = new QuoteDetail();

export default instance;