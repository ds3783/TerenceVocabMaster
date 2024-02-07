module.exports = {
    extends: 'local',
    data: {
        type: 'production',
        port: 3100,
        urlRoot: 'https://getrich.ds3783.com',
        feRoot: "/static/fe",
        defaultDatabase: 'HAPI',
        databases: {
            VOC_MASTER: {
                host: '127.0.0.1',
                port: 51002,
                user: 'terence',
                password: 'my_password',
                database: 'voc_master',
                charset: 'utf8mb4',
            },
        },
        
    }
};
