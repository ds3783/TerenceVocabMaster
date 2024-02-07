export const AlphaVantage_History_URL = 'https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${code}&outputsize=${outputsize}&datatype=csv&apikey=${key}';
export const AASTOCKS_History_URL = 'https://chartdata1.internet.aastocks.com/servlet/iDataServlet/getdaily?id=${code}.HK&type=24&market=1&level=1&period=69&encoding=utf8';


export const BLACK_ROCK_MAPPING = {
    WORLD_HEALTHSCIENCE_FUND: 'https://www.blackrock.com/americas-offshore/en/products/229338/blackrock-world-healthscience-a2-usd-fund/1474306011328.ajax?tab=chart&asOfDate=',
    WORLD_FINANCIALS_FUND: 'https://www.blackrock.com/americas-offshore/en/products/229936/blackrock-world-financials-a2-usd-fund/1474306011328.ajax?tab=chart&asOfDate=',
}

export const RAPID_ALPHA_VANTAGE = {
    quote_history: {
        method: 'GET',
        url: 'https://alpha-vantage.p.rapidapi.com/query',
        headers: {
            'x-rapidapi-host': 'alpha-vantage.p.rapidapi.com',
            'x-rapidapi-key': '${rapidapi-alpha-vantage-key}'
        },
        reqContentType: 'form',
        resContentType: 'text',
        data: {
            function: 'TIME_SERIES_DAILY_ADJUSTED',
            symbol: '${code}',
            outputsize: 'full',
            datatype: 'csv'
        }
    }
};
export const RAPID_YAHOO = {
    quote_detail: {
        method: 'GET',
        url: 'https://yh-finance.p.rapidapi.com/stock/v2/get-summary',
        headers: {
            'x-rapidapi-host': 'yh-finance.p.rapidapi.com',
            'x-rapidapi-key': '${rapidapi-alpha-vantage-key}'
        },
        reqContentType: 'form',
        resContentType: 'json',
        data: {
            symbol: '${code}',
            region: 'US',// US|BR|AU|CA|FR|DE|HK|IN|IT|ES|GB|SG
        }
    }
};


export const CIFM_REQ_TEMPLATES = {
    detail: {
        url: "https://app.cifm.com/one6/web/fund/queryFundDetail",
        method: 'POST',
        headers: {
            origin: 'https://m.cifm.com',
            referer: 'https://m.cifm.com',
            "Accept-Language": 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
        },
        reqContentType: 'form',
        resContentType: 'json',
        data: {
            fundCode: '${code}',
            channel: 'web',
            H5Version: '8.6.5.2',
            device: '',
            deviceId: 'null',
            channelId: 'null',
            deviceUUID: 'null',
            APP_TOKEN: 'null',
            VERSION: '5.9',
        }
    },
    history: {
        url: "https://app.cifm.com/one6/web/fund/fundAnalysis",
        method: 'POST',
        headers: {
            origin: 'https://m.cifm.com',
            referer: 'https://m.cifm.com',
            "Accept-Language": 'zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7',
        },
        reqContentType: 'form',
        resContentType: 'json',
        data: {
            fundCode: '${code}',
            begDate: '${beginDate}',
            endDate: '${endDate}',
            channel: 'web',
            H5Version: '8.6.5.2',
            device: '',
            deviceId: 'null',
            channelId: 'null',
            deviceUUID: 'null',
            APP_TOKEN: 'null',
            VERSION: '5.9',
        }
    }
}