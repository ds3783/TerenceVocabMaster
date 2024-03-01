import fs from "fs";
import path from "path";
import {createRequire} from 'module';
import dayjs from "dayjs";

const require = createRequire(import.meta.url)

export async function sleep(timeout) {
    return new Promise((resolve => {
        setTimeout(() => {
            resolve();
        }, timeout);
    }))
}

export async function requireFilesInPath(dir, fileFilter, callback) {
    let files = fs.readdirSync(dir);
    fileFilter = fileFilter || function (ignoredFile, ignoredDir) {
        return true;
    }

    for (let file of files) {
        let fileFullPath = path.resolve(path.join(dir, file));
        let fState = fs.lstatSync(fileFullPath);
        if (fState.isDirectory()) {
            await requireFilesInPath(fileFullPath, fileFilter, callback);
        } else if (fState.isFile() && fileFilter(file, dir)) {
            let module;
            if (/\.mjs$/.test(file)) {
                try {
                    module = await import(path.join(dir, file));
                } catch (e) {
                    console.error('Error parsing module file:' + file, e);
                    continue;
                }
                module = module.default;
            } else {
                module = require(path.join(dir, file));
            }
            callback(module, file, dir);
        }
    }
}

export function getMarketInfo(market) {
    let result = {
        expectingDate: '',
        shouldBeClosed: false
    };
    let now = dayjs(new Date());
    switch (market) {
        case 'SZSE':
        case 'SSE':
            result.expectingDate = now.format('YYYY-MM-DD');
            result.shouldBeClosed = (now.valueOf() - dayjs(result.expectingDate + ' 15:00:00 GMT+0800')) > 300000;
            break;
        case 'SEHK':
            result.expectingDate = now.format('YYYY-MM-DD');
            result.shouldBeClosed = (now.valueOf() - dayjs(result.expectingDate + ' 16:00:00 GMT+0800')) > 300000;
            break
        case 'NYSE':
        case 'NASDAQ':
            let expectingDate = now.add(-1, 'day');
            let weekOfMonth = Math.ceil((expectingDate.date() - expectingDate.day()) / 7) + 1;
            //夏令时开始于每年3月的第二个周日凌晨，人们需要将时间调早 (顺时针) 1个小时；
            // 夏令时结束于每年11月的第一个周日凌晨，人们需要将时间调晚 (逆时针) 1个小时。
            let isDayLightSavingTime = (now.month() > 2 && now.month() < 10) || (now.month() === 2 && weekOfMonth > 2) || (now.month() === 10 && weekOfMonth < 2);
            result.expectingDate = now.add(-1, 'day').format('YYYY-MM-DD');
            result.shouldBeClosed = (now.valueOf() - dayjs(result.expectingDate + ' 15:00:00 ' + (isDayLightSavingTime ? 'EDT' : 'EST'))) > 300000;
            break;
    }
    return result;
}


export const decode_base64 = function (encodeStr) {
    let buffer = Buffer.from(encodeStr, 'base64');
    return buffer.toString('utf8');
}

export const randomProxy = function (proxies) {
    let seed = Math.random();
    let defaultResult = '';
    let baseWeight = 0;
    for (const proxy of proxies) {
        if (proxy.default) {
            defaultResult = proxy.url;
        }
        if (seed < baseWeight + proxy.weight) {
            return proxy.url;
        }
        baseWeight += proxy.weight;
    }
    return defaultResult;
}