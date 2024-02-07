import NestiaWeb from "nestia-web";
import {decode_base64} from "../../../misc/utils.mjs";
import * as child_process from "child_process";
import *  as path from "path";
import *  as fs from "fs";
import {pinyin, PINYIN_STYLE} from '@napi-rs/pinyin'
import ip from "ip";
import DataBase from "../../../db/index.mjs";

import {promises as dnsPromises} from 'node:dns';

const LOG_PREFIX = '[PROXY_AIRPORT_UPDATER] ';

const SQLS = {
    GET_COUNTRY_BY_IP: 'SELECT * FROM proxy_ip_country WHERE ip = ?',
    SAVE_COUNTRY_BY_IP: 'INSERT INTO proxy_ip_country (country_code, ip) VALUES (?, ?)',
}


const AIRPORTS = {
    'SSPRO': {
        tagPrefix: 'sspro-',
        haproxyPort: 1200,
        v2rayConfigFile: '/etc/v2ray/config.d/01-sspro.json',
        haproxyConfigFile: '/etc/haproxy/config.d/01-sspro.cfg',
    },
    "SPEEDCAT": {
        tagPrefix: 'speedcat-',
        haproxyPort: 1201,
        v2rayConfigFile: '/etc/v2ray/config.d/01-speedcat.json',
        haproxyConfigFile: '/etc/haproxy/config.d/01-speedcat.cfg',
        blackListStrategy: 'remark',
        blackList: ["^日本-", "^美国-", "^阿根廷-"]
    },
    "FLYINGBIRD": {
        tagPrefix: 'flybird-',
        haproxyPort: 1202,
        v2rayConfigFile: '/etc/v2ray/config.d/01-flybird.json',
        haproxyConfigFile: '/etc/haproxy/config.d/01-flybird.cfg',
        blackListStrategy: 'remark',
        blackList: ["^Japan-", "^USA-", "^Argentina-"]//Hong Kong-
    }
}

const BLACK_LIST_COUNTRY = ['HK'];


async function getIpInfo(airport, outboundHost, tag) {
    let isIp = ip.isV4Format(outboundHost) || ip.isV6Format(outboundHost);
    let result = {
        isBlackList: false,
        country: null,
        ip_address: null
    };
    if (!isIp) {
        //call dns to get ip
        const resolver = new dnsPromises.Resolver();
        resolver.setServers(['8.8.8.8']);

        let host = await resolver.resolve(outboundHost);
        if (host.length > 0) {
            result.ip_address = host[0];
        }
    } else {
        result.ip_address = outboundHost;
    }
    if (!result.ip_address) {
        NestiaWeb.logger.error(LOG_PREFIX, ` fetch ip info for ${result.ip_address} failed.`);
        return result;
    }
    //fetch geo location from database
    let dbName = NestiaWeb.manifest.get('defaultDatabase');
    let conn = null;
    try {
        conn = await DataBase.borrow(dbName);

        let countryList = await DataBase.doQuery(conn, SQLS.GET_COUNTRY_BY_IP, [result.ip_address]);
        if (countryList.length > 0) {
            result.country = countryList[0].country_code;
        }

    } catch (e) {
        NestiaWeb.logger.error(LOG_PREFIX, 'Error do query', e);
        throw e;
    } finally {
        if (conn) {
            DataBase.release(conn);
        }
    }
    if (!result.country) {
        // get outboutHost geo location
        let ipInfo = await NestiaWeb.ajax.request({
            url: 'http://ip-api.com/json/' + outboundHost, method: 'GET', timeout: 30000, resContentType: 'json'
        });
        if (ipInfo.ok) {

            result.country = ipInfo.data.countryCode;
        } else {
            NestiaWeb.logger.error(LOG_PREFIX, ` fetch ip info for ${outboundHost} failed.`, ipInfo);
            return false;
        }
        if (result.country) {
            try {
                conn = await DataBase.borrow(dbName);

                await DataBase.doQuery(conn, SQLS.SAVE_COUNTRY_BY_IP, [result.country, result.ip_address]);

            } catch (e) {
                NestiaWeb.logger.error(LOG_PREFIX, 'Error do query', e);
                throw e;
            } finally {
                if (conn) {
                    DataBase.release(conn);
                }
            }
        }
    }
    if (!result.country) {
        NestiaWeb.logger.error(LOG_PREFIX, ` fetch geo location info for ${outboundHost} failed.`);
        return result;
    }
    let airportConfig = AIRPORTS[airport];

    //check black list
    if (airportConfig) {
        if (airportConfig.blackListStrategy === 'ip') {
            result.isBlackList = BLACK_LIST_COUNTRY.includes(result.country);
        } else if (airportConfig.blackListStrategy === 'remark') {
            result.isBlackList = airportConfig.blackList.some((item) => {
                return !!tag.match(item);
            });
        }
    } else {
        NestiaWeb.logger.warn(LOG_PREFIX, ` airport ${airport} config not found.`);
    }

    return result;

}


async function updateAirportConfig(airport) {
    NestiaWeb.logger.info(LOG_PREFIX, ` begin update for ${airport}.`);
    let airportConfig = NestiaWeb.manifest.get('airports.' + airport);
    let v2rayDir = NestiaWeb.manifest.get('airports.v2rayConfigDir');
    airportConfig = Object.assign({}, AIRPORTS[airport], airportConfig);

    //fetch config 
    let ssProxies = await NestiaWeb.ajax.request({
        url: airportConfig.subscribeUrl, method: 'GET', timeout: 30000, resContentType: 'text'
    });
    //decode config
    if (ssProxies.ok) {
        ssProxies = decode_base64(ssProxies.data);
    } else {
        NestiaWeb.logger.error(LOG_PREFIX, ` fetch ${airport} config failed.`, ssProxies);
        return;
    }
    let proxiesList = ssProxies.split('\n');
    let proxies = [];
    for (let proxyStr of proxiesList) {
        //for now, only support vmess
        let protocol = proxyStr.split('://')[0];
        if (['vmess', 'ss'].indexOf(protocol) === -1) {
            NestiaWeb.logger.warn(LOG_PREFIX, 'Unsupported protocol:', protocol, 'for proxy:', proxyStr)
            continue;
        }
        proxyStr = proxyStr.replace(new RegExp(`^${protocol}:\/\/`), '');
        let proxyConfig = {};

        switch (protocol) {
            case 'vmess':
                proxyConfig = decode_base64(proxyStr);
                NestiaWeb.logger.info(LOG_PREFIX, 'Resolved proxy:', proxyConfig);
                proxyConfig = JSON.parse(proxyConfig);
                break;
            case 'ss':
                let ssConfig;

                if (/#/.test(proxyStr)) {
                    let split = proxyStr.split('#');
                    proxyConfig.remarks = decodeURIComponent(split[1]);
                    proxyStr = split[0];
                }

                if (!/@/.test(proxyStr)) {
                    ssConfig = decode_base64(proxyStr)
                } else {
                    ssConfig = (proxyStr);
                }
                //ssConfig should be like chacha20-ietf-poly1305:XbUu9J@sczx.bzlxzl.com:57001
                let split = ssConfig.split('@');
                let s1 = split[0].split(':');
                let s2 = split[1].split(':');
                proxyConfig.ps = proxyConfig.remarks.replace(/[\s]/g, '');
                proxyConfig.address = s2[0];
                proxyConfig.port = s2[1] * 1;
                proxyConfig.method = s1[0];
                proxyConfig.password = s1[1];
                NestiaWeb.logger.info(LOG_PREFIX, 'Resolved proxy:', proxyConfig);
                break;
        }

        proxyConfig.protocol = protocol;
        proxies.push(proxyConfig);
    }
    //generate config json object
    let port = airportConfig.portRange.min;
    let inbounds = [], outbounds = [], routing_rules = [];
    let listeningPorts = [];

    let airportIps = [];
    if (!proxies.length) {
        NestiaWeb.logger.warn(LOG_PREFIX, 'No proxies found for airport:', airport);
        return;
    }
    for (let proxy of proxies) {
        NestiaWeb.logger.info(LOG_PREFIX, 'Processing proxy:', proxy);
        let originTag = proxy.ps;

        let tag = airportConfig.tagPrefix + originTag.replace(/[^\d\w\u4e00-\u9fa5]/g, '-');
        if (/[\u4e00-\u9fa5]/.test(tag)) {
            //if tag contains chinese, transform into pinyin
            tag = pinyin(tag, {style: PINYIN_STYLE.Plain, heteronym: false, segment: false}).join('');
        }
        let inTag = tag + '-in';
        let outTag = tag + '-out';
        let listeningPort = port++;
        let inbound = {
            "port": listeningPort, "listen": "0.0.0.0", "tag": inTag, "protocol": "http", "settings": {
                "auth": "noauth", "udp": false, "ip": "0.0.0.0"
            }, "sniffing": {
                "enabled": false
            }
        }
        let outbound, outboundHost;
        switch (proxy.protocol) {
            case 'vmess':
                outboundHost = proxy.add;
                outbound = {
                    "protocol": "vmess", "settings": {
                        "vnext": [{
                            "address": proxy.add, "port": proxy.port * 1, "users": [{
                                "id": proxy.id, "alterId": proxy.aid
                            }]
                        }]
                    }, "tag": outTag
                };
                break;
            case 'ss':
                outboundHost = proxy.address;
                outbound = {
                    "tag": outTag,
                    "protocol": "shadowsocks", "settings": {
                        "servers": [{
                            "address": proxy.address,
                            "port": proxy.port * 1,
                            "method": proxy.method,
                            "password": proxy.password,
                            "ota": false,
                            "level": 0
                        }]
                    }
                }

        }
        let ipInfo = await getIpInfo(airport, outboundHost, originTag);
        if (ipInfo.isBlackList) {
            NestiaWeb.logger.info(LOG_PREFIX, `Blacklist IP skip:[${airport}]`, outboundHost);
            continue;
        }

        if (airportIps.includes(ipInfo.ip_address + ':' + proxy.port)) {
            NestiaWeb.logger.warn(LOG_PREFIX, `Duplicate IP skip:[${airport}]`, outboundHost, proxy.port);
            continue;
        }
        airportIps.push(ipInfo.ip_address + ':' + proxy.port);
        let routing_rule = {
            "type": "field", "inboundTag": inTag, "outboundTag": outTag
        };
        listeningPorts.push(listeningPort);
        inbounds.push(inbound);
        outbounds.push(outbound);
        routing_rules.push(routing_rule);

        if (port > airportConfig.portRange.max) {
            //port range exceed, break
            break;
        }
    }
    //generate config json string
    let inboundsStr = JSON.stringify(inbounds, null, 2);
    let inboundsFile = path.join(v2rayDir, airport + '.inbound');
    NestiaWeb.logger.info(LOG_PREFIX + "Writing inbounds config to file:", inboundsFile);
    fs.writeFileSync(inboundsFile, inboundsStr);
    let outboundsStr = JSON.stringify(outbounds, null, 2);
    let outboundsFile = path.join(v2rayDir, airport + '.outbound');
    NestiaWeb.logger.info(LOG_PREFIX + "Writing outbounds config to file:", outboundsFile);
    fs.writeFileSync(outboundsFile, outboundsStr);
    let routingFile = path.join(v2rayDir, airport + '.routing');
    NestiaWeb.logger.info(LOG_PREFIX + "Writing routing to file:", routingFile);
    fs.writeFileSync(routingFile, JSON.stringify(routing_rules, null, 2));


    //generate config for haproxy
    NestiaWeb.logger.info(LOG_PREFIX, ` generate config for haproxy.`);
    let haproxyConfig = []
    haproxyConfig.push(`frontend ${airport}_in`);
    haproxyConfig.push('\tmode tcp');
    haproxyConfig.push(`\tbind 0.0.0.0:${airportConfig.haproxyPort}`);
    haproxyConfig.push('\tlog global');
    haproxyConfig.push(`\tdefault_backend ${airport}_out`);
    haproxyConfig.push('');
    haproxyConfig.push(`backend ${airport}_out`);
    haproxyConfig.push('\tmode tcp');
    haproxyConfig.push('\tbalance roundrobin');
    // haproxyConfig.push('\toption httpchk GET http://client3.google.com/generate_204 HTTP/1.1\\r\\nHost:\\ client3.google.com\\r\\nProxy-Authorization:\\ Basic\\ xxxx\\r\\nProxy-Connection:\\ Keep-Alive');
    // haproxyConfig.push('\toption log-health-checks');
    haproxyConfig.push('\thash-type consistent');
    haproxyConfig.push('\tlog global');
    haproxyConfig.push('\ttimeout connect 5s');
    haproxyConfig.push('\ttimeout server 1m');
    let idx = 0;
    for (const listeningPort of listeningPorts) {
        haproxyConfig.push(`\tserver s${++idx} 127.0.0.1:${listeningPort} check`);
    }
    haproxyConfig.push('');
    //save config
    NestiaWeb.logger.info(LOG_PREFIX + "Writing config to file:", airportConfig.haproxyConfigFile);
    fs.writeFileSync(airportConfig.haproxyConfigFile, haproxyConfig.join('\n'));

    NestiaWeb.logger.info(LOG_PREFIX, ` update for ${airport} finished.`);
}

async function updateAllAirportConfig() {
    let airports = NestiaWeb.manifest.get('airports.known');
    for (const airport of airports) {
        await updateAirportConfig(airport);
    }
    //merge v2ray config
    const configDir = NestiaWeb.manifest.get('airports.v2rayConfigDir');

    let files = fs.readdirSync(configDir);
    let routingRules = [];
    let inbounds = [], outbounds = [];
    for (const file of files) {
        //merge inbound file
        if (file.endsWith('.inbound')) {
            let content = fs.readFileSync(path.join(configDir, file));
            content = JSON.parse(content.toString());
            inbounds = inbounds.concat(content);
        }
        //merge outbound file
        if (file.endsWith('.outbound')) {
            let content = fs.readFileSync(path.join(configDir, file));
            content = JSON.parse(content.toString());
            outbounds = outbounds.concat(content);
        }

        // merge routing file
        if (file.endsWith('.routing')) {
            let content = fs.readFileSync(path.join(configDir, file));
            content = JSON.parse(content.toString());
            routingRules = routingRules.concat(content);
        }
    }
    //write to file
    fs.writeFileSync(path.join(configDir, '01-inbounds.json'), JSON.stringify({
        inbounds: inbounds
    }, null, 2));
    fs.writeFileSync(path.join(configDir, '02-outbounds.json'), JSON.stringify({
        outbounds: outbounds
    }, null, 2));
    fs.writeFileSync(path.join(configDir, '03-routing.json'), JSON.stringify({
        routing: {
            "rules": routingRules
        }
    }, null, 2));

    //restart v2ray
    NestiaWeb.logger.info(LOG_PREFIX, ` restart v2ray.`);
    await child_process.exec('sudo /usr/bin/restart-v2ray.sh');
    //restart haproxy
    NestiaWeb.logger.info(LOG_PREFIX, ` restart haproxy.`);
    await child_process.exec('sudo /usr/bin/restart-haproxy.sh');
}

export default [{
    name: 'Proxy Airport Updater', //update every morning 3:15
    cron: '15 3 12 * * *',
    work: updateAllAirportConfig
}];