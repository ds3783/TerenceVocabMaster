import CrawlerConst from "../../CrawlerConst.mjs";
import AbstractCrawler from "../../AbstractCrawler.mjs";
import NestiaWeb from "nestia-web";


const LOG_PREFIX = '[Hacker News SEO Enhancer] ';


import {searchAndClick} from "../../../geek/HackerNewsClick.mjs";


const indexUrl = 'https://www.ds3783.com/pages_indexed.txt';

class HackerNewsClicker extends AbstractCrawler {

    name = CrawlerConst.CLICK_WP_NEWS;


    async execute(lastSyncRecord) {
        NestiaWeb.logger.info(LOG_PREFIX + 'Begin enhance news SEO for Hacker News...');
        NestiaWeb.logger.info(LOG_PREFIX + 'Fetch indexed pages...');
        let retry = 3;
        let idxTxt = null;
        while (retry > 0) {
            try {
                //direct request
                idxTxt = await NestiaWeb.ajax.request({
                    url: indexUrl,
                    method: 'GET',
                    timeout: 60000,
                    responseType: 'text',
                    headers: {
                        'User-Agent': 'Mozilla/5.0 getrich.ds3783.com',
                    }
                });
                break;
            } catch (e) {
                NestiaWeb.logger.error(LOG_PREFIX + 'Error fetching indexed pages: ' + e);
                retry--;
            }
        }

        let pages = (idxTxt?.data || '').split('\n');
        if (!pages.length) {
            NestiaWeb.logger.error(LOG_PREFIX + 'No indexed pages found.');
            return;
        }
        pages = pages.map((page) => {
            return page.replace(/^(.*),[^,]+$/, "$1").trim()
        });
        NestiaWeb.logger.info(LOG_PREFIX + 'Do it asynchronous...');
        searchAndClick(pages).then(() => {
            NestiaWeb.logger.info(LOG_PREFIX + 'Done.');
        });
    }


}

let instance = new HackerNewsClicker();

export default instance;