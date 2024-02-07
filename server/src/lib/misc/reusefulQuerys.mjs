import NestiaWeb from "nestia-web";
import DataBase from "../db/index.mjs";

const LEGAL_OPERATOR = ['=', '>', '>=', '!=', '<', '<=', 'like', 'in', 'is null', 'is not null'];


export async function getListByConditionsAndOrderWithPagination(sql, conditions = [], offset = 0, limit = 10, $sort = '') {
    let $condition = '', params = [];
    let conditionArr = []
    conditions = conditions || [];
    for (let condition of conditions) {
        if (!LEGAL_OPERATOR.includes(condition.operator)) {
            throw new Error('Illegal operator: ' + condition.operator);
        }

        let value = condition.value;
        let queryPart;
        if (typeof condition.value === 'undefined') {
            queryPart = '';
        } else if (Array.isArray(value)) {
            queryPart = `(${new Array(value.length).fill('?').join(',')})`;
        } else {
            queryPart = '?';
        }

        conditionArr.push(` ${condition.column} ${condition.operator} ${queryPart}`);
        if (typeof condition.value !== 'undefined') {
            if (Array.isArray(value)) {
                params = params.concat(value);
            } else {
                params.push(value);
            }
        }
    }

    if (conditionArr.length) {
        $condition = ` WHERE ${conditionArr.join(' AND ')} `;
    }

    let countParams = Array.from(params);
    params.push(offset * 1 || 0);
    params.push(limit * 1 || 10);
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);
        let querySql = sql.replace(/\${CONDITION}/g, $condition).replace(/\${SORT}/g, $sort);
        let countSql = sql.replace(/\${CONDITION}/g, $condition).replace(/\${SORT}/g, '').replace(/^\s*select .* (?=from)/i, 'SELECT COUNT(*) AS CNT ').replace(/\sorder\s+by\s.*$/i, '');

        let data = await DataBase.doQuery(conn, querySql, params);
        let countData = await DataBase.doQuery(conn, countSql, countParams);

        return {
            data,
            count: countData[0]['CNT']
        };

    } catch (e) {
        NestiaWeb.logger.error('Error do query', e);
        throw e;
    } finally {
        if (conn) {
            DataBase.release(conn)
        }
    }
}