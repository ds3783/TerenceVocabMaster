import crypto from "crypto";
import path from "path";
import fs from "fs";


const workPath = process.cwd();
let logDirectory = (() => {
    let logDirectory = path.resolve(path.join(workPath, 'logs', process.env.INSTANCE_ID || ''));
    try {
        fs.accessSync(logDirectory, fs.constants.W_OK);
    } catch (e) {
        fs.mkdirSync(logDirectory, {recursive: true})
    }
    return logDirectory;
})();

export default {
    cache: {
        impl: 'memory',
    },
    log: {
        path: logDirectory,
        level: process.env.MANIFEST === 'prod' ? 'info' : 'debug',
        extraZipStreams: [],
        takeOverConsole: true,
    },
    ajax: {
        timeout: 10000,
        slowThreshold: 3000,
        defaultHeaders: {
            "X-Requested-With": "Get rich for ds3783"
        },
        agentOptions: {
            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
        }
    },
    manifest: {
        path: path.join(workPath, 'src', 'manifest'),
        name: process.env.MANIFEST || 'local',
    },
    monitor: {
        prefix: '',
        suffix: '',
        mem: true,
        cpu: true,
        req404: true,
        req5xx: true,
    },
    common: {
        expressApp: null,
        listenHostname: '0.0.0.0',
        listenPort: 3000,
    }
}