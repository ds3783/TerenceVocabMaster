import UrlPattern from 'url-pattern';

let rolePermissions = {};

export const roles = [
    'anonymous',
    'user',
    'investor',
    'analytics',
    'admin',
    'stansberrymember',
];
export const systemRoles = [
    'anonymous',
    'user',
    'admin',
];

//roles

for (const role of roles) {
    rolePermissions[role] = [];
}

/*
*  {
*     pattern:new UrlPattern('/api/users(/:id)'),
*     url:'',
*     method:'GET,POST'
*  }
* 
* */
//permissions
rolePermissions['anonymous'] = rolePermissions['anonymous'].concat(
    [
        {
            pattern: new UrlPattern(/^(?!\/api\/?).*/),
        },
        {
            url: '/api/user/checkLogin'
        },
        {
            url: '/api/user/login'
        },
        {
            url: '/api/user/logout'
        },
        {
            url: '/api/user/signUp'
        },
        {
            url: '/api/user/validateUser'
        },
        {
            url: '/api/user/register'
        },
        {
            url: '/api/user/sendResetPwdEmail'
        },
        {
            url: '/api/user/resetPwd'
        },
        {
            url: '/api/user/oauth/getOauthParameters'
        },
        {
            url: '/api/user/oauth/login'
        },
    ]
);


rolePermissions['user'] = rolePermissions['user'].concat([
        {
            url: '/api/user/permissions'
        },
        {
            url: '/api/market/quote/getAllMarketsAndFunds'
        },
        {
            url: '/api/article/getArticleList'
        },
        {
            url: '/api/article/getArticle'
        },
        {
            url: '/api/article/getArticleContent'
        },
        {
            url: '/api/common/upload'
        },
        {
            url: '/api/market/quote/getQuoteList'
        },
        {
            url: '/api/market/quote/getQuoteInfo'
        },
        {
            url: '/api/market/quote/getQuoteHistory'
        },
        {
            url: '/api/market/quote/getWatchList'
        },
        {
            url: '/api/market/quote/queryForCode'
        },
        {
            url: '/api/market/quote/saveMyWatchList'
        },
        {
            url: '/api/market/quote/addTrackRequest'
        },
        {
            url: '/api/virtualAccount/getMyAccounts'
        },
        {
            url: '/api/virtualAccount/newAccount'
        },
        {
            url: '/api/virtualAccount/checkDeleteAccount'
        },
        {
            url: '/api/virtualAccount/deleteAccount'
        },
        {
            url: '/api/virtualAccount/getAccountOperations'
        },
        {
            url: '/api/virtualAccount/newTrade'
        },
        {
            url: '/api/virtualAccount/deleteTrading'
        },
        {
            url: '/api/virtualAccount/purgeAccount'
        },
        {
            url: '/api/virtualAccount/recalculateAccount'
        },
        {
            url: '/api/virtualAccount/getAccessibleAccounts'
        },
        {
            url: '/api/virtualAccount/getAccountInfo'
        },
        {
            url: '/api/virtualAccount/getAccountNav'
        },
    ]
);


rolePermissions['admin'] = rolePermissions['admin'].concat([
        {
            pattern: new UrlPattern('/api/user/admin/*'),
        },
        {
            pattern: new UrlPattern('/api/article/newArticle'),
        },
        {
            pattern: new UrlPattern('/api/article/deleteArticle'),
        },
        {
            pattern: new UrlPattern('/api/market/quote/newQuote'),
        },
        {
            pattern: new UrlPattern('/api/market/quote/delQuote'),
        },
        {
            url: '/api/admin/startCrawler'
        },
        {
            url: '/api/admin/startSchedular'
        },
        {
            pattern: new UrlPattern('/api/admin/sendMessage'),
        }
    ]
);


export default rolePermissions;