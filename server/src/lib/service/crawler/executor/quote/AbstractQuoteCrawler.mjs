import AbstractCrawler from "../../AbstractCrawler.mjs";
import NestiaWeb from "nestia-web";
import DataBase from "../../../../db/index.mjs";


const SQLS = {
    GET_MARKET: 'SELECT * FROM quote_market WHERE code = ?',
};

class AbstractQuoteCrawler extends AbstractCrawler {

    async getMarket(code) {
        //params should be quote object

        let dbName = NestiaWeb.manifest.get('defaultDatabase');
        let conn = null;
        try {
            conn = await DataBase.borrow(dbName);
            let detailRecord = await DataBase.doQuery(conn, SQLS.GET_MARKET, [code]);
            if (detailRecord.length) {
                return detailRecord[0];
            } else {
                return null;
            }
        } catch (e) {
            NestiaWeb.logger.error('Error do query', e);
            throw e;
        } finally {
            if (conn) {
                DataBase.release(conn)
            }
        }

    }

}


export default AbstractQuoteCrawler;