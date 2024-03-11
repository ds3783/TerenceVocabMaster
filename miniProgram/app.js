const API = require('utils/apis');
const global = require('utils/global');

// app.js
App({
    /*globalData: {
        isLogin:false   ,
        userInfo: null
    },*/
    globalData: {
        userInfo: null,

    },
    onLaunch() {
        this.globalData.userInfo = null;

        function onNetworkFailure(){
            wx.showModal({
                title: '网络错误',
                content: '无法访问服务器，请稍后再试',
                showCancel: false, // 不显示取消按钮
                confirmText: '确定', // 确定按钮的文字，默认为"确定"
                success: function (res) {
                    if (res.confirm) {
                        wx.exitMiniProgram({
                            success: function() {
                                console.log('小程序已退出');
                            },
                            fail: function(err) {
                                console.error('退出小程序失败', err);
                            }
                        });
                    }
                }
            });
        }

        // 展示本地存储能力
        let cachedUser = wx.getStorageSync('user') || [];
        const envString = wx.getAccountInfoSync().miniProgram.envVersion;
        console.log('cachedUser', cachedUser);
        global.eventEmitter.on('userInfoUpdated', (userInfo) => {
            wx.setStorageSync('user',userInfo);
        });
        if (cachedUser) {
            if (!cachedUser.open_id || !cachedUser.token) {
                console.log('Invalid user info');
                console.log('Clear user info');
                cachedUser = null;
                wx.removeStorageSync('user');
            } else {
                wx.request({
                    url: API('checkLogin'),
                    data: {
                        open_id: cachedUser.open_id,
                        token: cachedUser.token,
                        env: envString,
                    },
                    method: 'POST',
                    success: res => {
                        if (res.statusCode !== 200) {
                            onNetworkFailure();
                            return;
                        }
                        if (!res.data.result) {
                            console.log('Invalid user info',res);
                            console.log('Clear user info');
                            cachedUser = null;
                            wx.removeStorageSync('user');
                            return;
                        }
                        console.log('login success:', res);
                        this.globalData.userInfo = cachedUser;
                        global.eventEmitter.emit('userInfoUpdated', cachedUser);
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
                                if (res.statusCode !== 200) {
                                    onNetworkFailure();
                                    return;
                                }
                                console.log('login success:', res);
                                global.eventEmitter.emit('userInfoUpdated', res.data);
                            },
                            fail: res => {
                                console.log('login fail:', res);
                                onNetworkFailure();
                            }
                        });
                    } else {
                        console.log('获取用户登录凭证失败！', res.errMsg);
                    }
                },
                fail: res => {
                    console.log('login fail:', res);
                    onNetworkFailure();
                }
            });

        }
    },
})
