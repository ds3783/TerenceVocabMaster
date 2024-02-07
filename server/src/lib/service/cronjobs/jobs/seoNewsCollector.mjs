import NestiaWeb from "nestia-web";
import Crawler, {CrawlerConst} from "../../crawler/index.mjs";

const LOG_PREFIX = '[NEWS_COLLECTOR] ';

export default [
    {
        name: 'Seo News Collector',
        cron: '15 4,7,19,23 * * *',
        work: async function () {

            NestiaWeb.logger.info(LOG_PREFIX, ` create news sync job.`);
            let historyJob = Crawler.createCrawlerJob(CrawlerConst.SYNC_WP_NEWS, {});
            await Crawler.appendToCrawlerQueue(historyJob);


        }
    },
    {
        name: 'Seo News Clicker',
        cron: '00 23 */2 * * *',
        work: async function () {

            NestiaWeb.logger.info(LOG_PREFIX, ` create news click job.`);
            let historyJob = Crawler.createCrawlerJob(CrawlerConst.CLICK_WP_NEWS, {});
            await Crawler.appendToCrawlerQueue(historyJob);


        }
    }
]