import CrawlerConst from "../../CrawlerConst.mjs";
import AbstractCrawler from "../../AbstractCrawler.mjs";
import NestiaWeb from "nestia-web";
import DataBase from "../../../../db/index.mjs";


import {parse as parseHtml} from "node-html-parser";
import {translateAndSave} from "../../../geek/HackerNewsList.mjs";


const LOG_PREFIX = '[Hacker News List Crawler] ';
const DB_NAME = 'WP_NEWS';
const PAGE_LIMIT = 20;

const SQLS = {
    GET_LATEST_NEWS: 'SELECT * FROM sync_status  ORDER BY sync_time DESC LIMIT 1',
};

const ROOT_URL = 'https://news.ycombinator.com/newest';

async function getLatestNews() {
    let conn = null;
    try {
        conn = await DataBase.borrow(DB_NAME);

        let rs = await DataBase.doQuery(conn, SQLS.GET_LATEST_NEWS, []);
        if (rs.length) {
            return rs[0];
        }
        return null;
    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
        throw e;
    } finally {
        if (conn) {
            DataBase.release(conn)
        }
    }
}


class HackerNewsListCrawler extends AbstractCrawler {

    name = CrawlerConst.SYNC_WP_NEWS;

    /*
    * {"name":"AAPL","exchange-traded":"NASDAQ","exchange-listed":"NASDAQ ","timezone":"America\/New_York","minmov":1,"minmov2":0,"pricescale":100,"pointvalue":1,"has_intraday":true,"has_no_volume":false,"volume_precision":3,"ticker":"6408","description":"Apple Inc, United States","type":"Stock","has_daily":true,"has_weekly_and_monthly":true,"supported_resolutions":["1","5","15","30","60","300","D","W","M","45","120","240"],"intraday_multipliers":["1","5","15","30","60","300"],"session":"2;0930-1600:23456","data_status":"streaming"}
    * */
    async getNewsList(latestNews) {

    }

    async execute(lastSyncRecord) {
        NestiaWeb.logger.info(LOG_PREFIX + 'Loading news...');
        let latestNews = await getLatestNews();
        NestiaWeb.logger.info(LOG_PREFIX + 'Latest news: ' + JSON.stringify(latestNews));

        NestiaWeb.logger.info(LOG_PREFIX + 'Scanning news...');
        let newsList = [], moreLink = null, found = false;
        for (let i = 1; i <= PAGE_LIMIT; i++) {
            let url = moreLink || ROOT_URL;

            let data = null;
            try {
                data = await this.httpRequest({
                    url: url,
                    method: 'GET',
                    resContentType: 'text'
                });
            } catch (e) {
                NestiaWeb.logger.error(LOG_PREFIX + 'Error loading news: ' + e.message);
                continue;
            }
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
            let rows = htmlObj.querySelectorAll('#hnmain tr.athing');
            for (let row of rows) {
                let aLink = row.querySelector('span.titleline a');
                let title = ('' + aLink.text).trim();
                let link = aLink.getAttribute('href');
                if (!/^http/.test(link)) {
                    link = 'https://news.ycombinator.com/' + link;
                }
                if (title === lastSyncRecord?.title) {
                    NestiaWeb.logger.info(LOG_PREFIX + 'Found last sync record: ' + JSON.stringify(lastSyncRecord));
                    found = true;
                    break;
                }
                //remove duplicate
                for (let news of newsList) {
                    if (news.url === link) {
                        continue;
                    }
                }
                newsList.push({
                    title: title,
                    url: link,
                });

            }
            if (found) {
                break;
            }
            let more = htmlObj.querySelector('#hnmain a.morelink');
            if (more) {
                moreLink = more.getAttribute('href');
                if (!/^http/.test(moreLink)) {
                    moreLink = 'https://news.ycombinator.com/' + moreLink;
                }
            }
        }

        NestiaWeb.logger.info(LOG_PREFIX + 'Found ' + newsList.length + ' news.');
        NestiaWeb.logger.info(LOG_PREFIX + 'Translating news synchronously...');
        let newsLen = newsList.length;
        let sessionId = new Date().toString();
        translateAndSave(newsList,sessionId).then(() => {

            NestiaWeb.logger.info(LOG_PREFIX + '[' + sessionId + ']Translated ' + newsLen + ' news.');
        });

    }


}

let instance = new HackerNewsListCrawler();

export default instance;