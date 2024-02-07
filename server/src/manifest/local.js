module.exports = {
    data: {
        type: 'development',
        cacheDir: 'cache',
        urlRoot: 'http://127.0.0.1:3500',
        feRoot: "http://127.0.0.1:3501",
        defaultDatabase: 'HAPI_DEV',
        databases: {
            VOC_MASTER: {
                host: '127.0.0.1',
                port: 51002,
                user: 'terence',
                password: 'my_password',
                database: 'voc_master',
                charset: 'utf8mb4',
                tunnel: {
                    sshOptions: {
                        username: 'root',
                        host: 'v2.ec7.in',
                        port: 51001,
                        privateKey: process.env.HOME + '/.ssh/mac_ed25519',
                        algorithms: {
                            serverHostKey: ['ssh-ed25519'],
                            kex: {
                                //remove diffie-hellman-group-exchange-sha256 because there is a bug when one side uses arm architecture
                                //See: https://github.com/mscdex/ssh2/issues/842
                                remove: ['diffie-hellman-group-exchange-sha256']
                            },
                        },
                    },
                    forwardOptions: {
                        srcAddr: '127.0.0.1',
                        srcPort: 51002,
                        dstAddr: '127.0.0.1',
                        dstPort: 51002
                    },
                    tunnelOptions: {
                        autoClose: false,
                    },
                    serverOptions: {
                        port: 51002
                    },
                }
            },
            
        },
        server: {
        },
        user: {
            salt: 'know_thyself',
            cookieExpire: 14 * 86400,
            maxPermissionId: 10,
            
        },
        openai: {
            key: ''
        },
        
    }
};
