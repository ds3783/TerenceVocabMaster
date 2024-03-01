const API=require('utils/apis');

// app.js
App({
    /*globalData: {
        isLogin:false   ,
        userInfo: null
    },*/
    onLaunch() {
        /*// 展示本地存储能力
        const logs = wx.getStorageSync('logs') || []
        logs.unshift(Date.now())
        wx.setStorageSync('logs', logs)*/
        // 小程序启动时触发
        wx.login({
            success: res => {
                if (res.code) {
                    // 获取用户信息
                    console.log('login result:',res);
                    wx.request({
                        url: API('login'),
                        data: {
                            code: res.code,
                        },
                        method: 'POST',
                        success: res => {
                            console.log('login success:', res);
                        }
                    });
                } else {
                    console.log('获取用户登录凭证失败！', res.errMsg);
                }
            }
        });
    },
})
