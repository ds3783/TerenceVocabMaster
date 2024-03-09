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
    {
        name: 'checkLogin',
        type: 'api',
        path: '${api}/miniprog_api/${api_version}/user/checkLogin',
    },
    {
        name: 'uploadAvatar',
        type: 'api',
        path: '${api}/miniprog_api/${api_version}/user/uploadAvatar',
    },
    {
        name: 'updateProfile',
        type: 'api',
        path: '${api}/miniprog_api/${api_version}/user/updateProfile',
    },
    {
        name: 'getUserLexiconList',
        type: 'api',
        path: '${api}/miniprog_api/${api_version}/lexicon/getUserLexiconList',
    },
    {
        name: 'setUserLexiconList',
        type: 'api',
        path: '${api}/miniprog_api/${api_version}/lexicon/setUserLexiconList',
    },
    
];


let ENV = 'prod';

const envString = wx.getAccountInfoSync().miniProgram.envVersion;
console.log('ENV:', envString);
if (envString === 'develop') {
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