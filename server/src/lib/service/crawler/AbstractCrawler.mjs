import NestiaWeb from "nestia-web";
import globalEvent from "../../misc/globalEvent.mjs";
import {v4} from "uuid";

const DefaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36',
    'sec-ch-ua': '"Google Chrome";v="93", " Not;A Brand";v="99", "Chromium";v="93"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en',
}

export default class AbstractCrawler {
    name = 'DEFAULT_CRAWLER';

    async httpRequest(request) {
        request.headers = Object.assign({timeout: 30000}, DefaultHeaders, request.headers || {});
        let proxy = NestiaWeb.manifest.get('dataSource.proxy.default', true);
        if (proxy && !request.proxy) {
            request.proxy = proxy;
        }
        return await NestiaWeb.ajax.request(request);
    }

    async browserRequest(request) {
        //WARN: only support GET method
        let proxy = NestiaWeb.manifest.get('dataSource.proxy.default', true);
        let params = {
            url: request.url,
            type: request.type,
            sync: typeof request.sync !== 'undefined' ? !!request.sync : true
        };
        if (proxy || request.proxy) {
            let proxyUrl = new URL(proxy || request.proxy);
            params.proxy_host = proxyUrl.hostname;
            params.proxy_port = proxyUrl.port;
        }
        return new Promise((resolve, reject) => {
            if (!params.sync) {
                // register callback
                let uuidVal = v4().toUpperCase();
                params.callback = NestiaWeb.manifest.get('urlRoot') + '/callback?type=POST&id=' + uuidVal;
                globalEvent.once('CALLBACK_' + uuidVal, async function (msg) {
                    if (typeof msg === "string") {
                        msg = JSON.parse(msg);
                    }
                    NestiaWeb.logger.info('Callback result:', msg);
                    let crawlerData = msg;
                    if (crawlerData.result) {
                        resolve(crawlerData.data);
                    } else {
                        reject(crawlerData.message);
                    }
                });
            }
            NestiaWeb.ajax.request({
                url: NestiaWeb.manifest.get('webCrawler.url'),
                method: 'POST',
                reqContentType: 'json',
                resContentType: 'json',
                data: params
            }).then(data => {
                if (params.sync) {
                    let crawlerData = data.data;
                    if (crawlerData.result) {
                        resolve(crawlerData.data);
                    } else {
                        reject(crawlerData.message);
                    }
                }
            });
            setTimeout(function () {
                NestiaWeb.logger.error(`WebCrawler job timeout: `, JSON.stringify(params));
                reject(new Error("WebCrawler timeout"));
            }, 30000);
        });

    }


    replaceUrl(url, params) {
        params = params || {};
        let result = '' + url;
        for (const [key, value] of Object.entries(params)) {
            result = result.replace(new RegExp('\\$\\{' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\}', 'g'), '' + value);
        }
        return result;
    }

    async execute() {
        return {};
    }
}