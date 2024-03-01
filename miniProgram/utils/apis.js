const API_ROOT = {
    local: {
        api: 'http://local.ec7.fun',
        api_version: 'v1.0',
    }
    , prod: {
        api: 'https://www.ec7.fun',
        api_version: 'v1.0',
    }
};

const APIS = [
    {
        name: 'login',
        type: 'api',
        path: '${api}/miniprog_api/${api_version}/user/login',
    },
    
];


let ENV = 'prod';

const version = wx.getAccountInfoSync().miniProgram.envVersion;
console.log('version:', version);
if (version === 'develop') {
    ENV = 'local';
}

let apiCache = {};

for (let api of APIS) {
    let root = API_ROOT[ENV];
    let path = api.path;
    for (let key in root) {
        path = path.replace(new RegExp('\\${' + key + '}', 'g'), root[key]);
    }
    apiCache[api.name] = path;
}

module.exports = function (name, params) {
    let url = apiCache[name];

    if (!url) {
        throw new Error('Invalid API name:' + name);
    }
    if (typeof params === 'object') {
        for (let key in params) {
            if (params.hasOwnProperty(key)) {
                url = url.replace(new RegExp('\\${' + key + '}', 'g'), params[key]);
            }
        }
    }
    return url;
};