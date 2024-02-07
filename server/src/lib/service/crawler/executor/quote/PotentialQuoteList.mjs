import CrawlerConst from "../../CrawlerConst.mjs";
import AbstractCrawler from "../../AbstractCrawler.mjs";


const Search_URL = 'https://www.investing.com/search/service/searchTopBar';

// const LOG_PREFIX = '[QUOTE_POTENTIAL_LIST_CRAWLER] ';

class PotentialQuoteList extends AbstractCrawler {
    name = CrawlerConst.FETCH_POTENTIAL_QUOTES;

    randomStr(len) {
        const charset = '0123456789abcdef'.split('');
        let result = '';
        while (result.length < len) {
            result += charset[Math.floor(Math.random() * charset.length)];
        }
        return result;
    }


    async execute(code) {
        //params should be quote object
        // get investing.com symbol

        let url = Search_URL;


        let data = await this.httpRequest({
            url: url,
            method: 'POST',
            reqContentType: 'form',
            resContentType: 'json',
            data: {
                search_text: code,
            } ,
            headers:{
                'authority':'www.investing.com',
                'X-Requested-With':'XMLHttpRequest',
                'origin':'https://www.investing.com',
            }
        });
        data = data?.data;

        if (!data || !data.total) {
            throw new Error('History fetch failure, url:' + url);
        }
        return data.quotes;
    }


}

let instance = new PotentialQuoteList();

export default instance;