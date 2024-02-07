import MySql from 'mysql2';
import fs from 'fs';
import net from 'net';
import path from 'path';
import NestiaWeb from 'nestia-web';

import sshTunnel, {createTunnel} from 'tunnel-ssh';

const LOG_PREFIX = '[DATABASE] ';
let pools = {};

let closePool = function (name, err) {
    let pool = pools[name];
    delete pools[name];
    if (err) {
        NestiaWeb.logger.error(LOG_PREFIX, 'Error when pinging conn pool[' + (pool ? JSON.stringify(pool.config) : '') + ']: ' + err.message, err);
    }
    if (!pool) {
        return;
    }

    NestiaWeb.logger.error(LOG_PREFIX, 'Closing conn pool[' + JSON.stringify(pool.config) + ']: ');
    pool.instance.end(function (err2) {
        if (err2) {
            NestiaWeb.logger.error(LOG_PREFIX, 'Error when close conn pool[' + JSON.stringify(pool.config) + ']: ' + err2.message, err2);
        }
    });
    if (pool.sshTunnel) {
        pool.sshTunnel.server.close();
        pool.sshTunnel.client.end();
    }
}

setInterval(function () {
    for (let key in pools) {
        let pool = pools[key];
        if (pool) {
            try {
                pool.instance.query('select 1 from dual', function (err, ignoredResults, ignoredFields) {
                    if (err) {
                        closePool(key, err)
                    }
                });
            } catch (err) {
                NestiaWeb.logger.error(LOG_PREFIX, 'Error when pinging conn pool[' + JSON.stringify(pool.config) + ']: ' + err.message, err);
            }
        }
    }
}, 30000);

NestiaWeb.on('SHUTDOWN', function () {
    for (let key in pools) {
        let pool = pools[key];
        if (pool) {
            closePool(key)
        }
    }

});


const initializePool = async function (name) {
    if (pools[name]) {
        return pools[name];
    }
    let config = NestiaWeb.manifest.get('databases.' + name);
    let poolObj = {
        config: config,
        sshTunnel: null,
        instance: null
    };

    config = JSON.parse(JSON.stringify(config));

    if (config.tunnel) {
        let tunnelExists = false;
        try {
            await new Promise(((resolve, reject) => {
                const client = net.createConnection(Object.assign({
                    host: '127.0.0.1',
                    port: config.tunnel.serverOptions.port
                }), () => {
                    resolve();
                    client.end();
                });
                client.on('error', function () {
                    reject();
                });
            }));
            tunnelExists = true;

        } catch (e) {
        }

        if (tunnelExists) {
            NestiaWeb.logger.info(LOG_PREFIX, 'SSH tunnel exists, reuse it.')
            delete config['tunnel'];
        } else {
            NestiaWeb.logger.info(LOG_PREFIX, 'SSH tunnel not exists creating.')
            try {
                if (config.tunnel.sshOptions?.privateKey) {
                    NestiaWeb.logger.info(LOG_PREFIX, 'Will use SSH tunnel privateKey file: ' + config.tunnel.sshOptions.privateKey);
                    config.tunnel.sshOptions.privateKey = fs.readFileSync(path.normalize(config.tunnel.sshOptions.privateKey));
                }
                let [server, client] = await createTunnel(config.tunnel.tunnelOptions, config.tunnel.serverOptions, config.tunnel.sshOptions, config.tunnel.forwardOptions);
                poolObj.sshTunnel = {
                    server: server,
                    client: client
                };
                delete config['tunnel'];
            } catch (e) {
                NestiaWeb.logger.error(LOG_PREFIX, 'Error create ssh tunnel:' + e.message, e);
                return;
            }
        }

    }
    try {
        poolObj.instance = MySql.createPool(config);
        pools[name] = poolObj;
    } catch (e) {
        NestiaWeb.logger.error(LOG_PREFIX, "Error create database pool", e);
    }


    return poolObj;
}


export default {
    borrow: async function (name) {
        let pool = await initializePool(name);
        return new Promise((resolve, reject) => {
            pool.instance.getConnection(function (err, connection) {
                if (err) {
                    closePool(name, err)
                    reject(err);
                    return;
                }
                resolve(connection);
            });
        });
    },

    release: function (conn) {
        // conn._pool.releaseConnection(conn);
        conn.release();
    },
    doQuery: async function (conn, query, params) {
        return new Promise((resolve, reject) => {
            let params4Debug = [];
            for (const param of params) {
                if (param instanceof Buffer) {
                    params4Debug.push(`Buffer(${param.size})`);
                } else if (typeof param === 'string') {
                    params4Debug.push(param.length > 100 ? param.substr(0, 97) + '...' : param);
                } else {
                    params4Debug.push(param);
                }
            }
            NestiaWeb.logger.debug(LOG_PREFIX, 'Exec query: ' + query + ' params:' + JSON.stringify(params4Debug));

            conn.query(query, params, function (err, results, ignoredFields) {
                if (err) {
                    NestiaWeb.logger.error(LOG_PREFIX, 'Error exec query: ' + query + ' params:' + JSON.stringify(params) + ' error:' + (err && err.message), err);
                    reject(err);
                    return;
                }
                NestiaWeb.logger.debug(LOG_PREFIX, 'Exec query: ' + query + ' successful');
                resolve(results);

            });
        });
    }
};