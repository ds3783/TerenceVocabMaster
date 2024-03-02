const API = require('utils/apis');

// app.js
App({
    /*globalData: {
        isLogin:false   ,
        userInfo: null
    },*/
    onLaunch() {
        // 展示本地存储能力
        let cachedUser = wx.getStorageSync('user') || [];
        const envString = wx.getAccountInfoSync().miniProgram.envVersion;
        console.log('cachedUser', cachedUser)
        if (cachedUser) {
            if (!cachedUser.open_id || !cachedUser.token) {
                console.log('Invalid user info');
                console.log('Clear user info');
                cachedUser = null;
                wx.removeStorageSync('user');
            } else{
            wx.request({
                url: API('checkLogin'),
                data: {
                    open_id: cachedUser.open_id,
                    token: cachedUser.token,
                    env: envString,
                },
                method: 'POST',
                success: res => {
                    console.log('login success:', res);
                    wx.setStorageSync('user', res.data)
                },
                fail: res => {
                    console.log('check login fail:', res);
                    console.log('Clear user info');
                    cachedUser = null;
                    wx.removeStorageSync('user');
                }
            });
            }
        }
        if (!cachedUser) {
            console.log('Begin login')
            // 小程序启动时触发
            wx.login({
                success: res => {
                    if (res.code) {
                        // 获取用户信息
                        console.log('login result:', res);
                        wx.request({
                            url: API('login'),
                            data: {
                                code: res.code,
                                env: envString,
                            },
                            method: 'POST',
                            success: res => {
                                console.log('login success:', res);
                                wx.setStorageSync('user', res.data)
                            }
                        });
                    } else {
                        console.log('获取用户登录凭证失败！', res.errMsg);
                    }
                }
            });

        }
    },
})
