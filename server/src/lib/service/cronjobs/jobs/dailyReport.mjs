import NestiaWeb from "nestia-web";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {userDailyReport} from "../../market/quote/query.mjs";

dayjs.extend(utc);
dayjs.extend(timezone);

const LOG_PREFIX = '[DAILY_REPORT] ';


export default [
    {
        //update us market funds daily prices
        name: 'Send quote daily movement mail',
        cron: '15 7 * * tue-sat',
        work: async function () {
            NestiaWeb.logger.info(LOG_PREFIX, 'Generating daily report.');
            await userDailyReport();
            NestiaWeb.logger.info(LOG_PREFIX, 'All daily report sent.');
        }
    },
]