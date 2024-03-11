const global = require('../../utils/global');

const PREFETCH_RESOURCES = [
    'https://ec7-fun.oss-rg-china-mainland.aliyuncs.com/vocab_master/mp/default_background.jpg',
    'https://ec7-fun.oss-rg-china-mainland.aliyuncs.com/vocab_master/mp/plate.png',
    ];

// pages/index/home.js
Page({

    /**
     * 页面的初始数据
     */
    data: {
        userInfo: null,

        moduleList: [],
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        const appInstance = getApp();

        this.setData({userInfo: appInstance.globalData.userInfo});
        console.log('userInfo', appInstance.globalData.userInfo);
        global.eventEmitter.on('userInfoUpdated', (userInfo) => {
            console.log('userInfo update', userInfo);
            this.setData({userInfo});
        });

        let moduleList = this.data.moduleList;
        moduleList.push({
            name: "设置",
            url: '/pages/settings/index',
        })
        this.setData({'moduleList': moduleList});
        console.log(this.data.moduleList)
        wx.loadFontFace({
            family: 'Handwriting',
            source: 'url("https://ec7-fun.oss-rg-china-mainland.aliyuncs.com/vocab_master/mp/fonts/Handwriting.ttf")',
            global: true,
            success: console.log
        });
        //START: prefetch resources
        for (let url of PREFETCH_RESOURCES) {
            wx.getImageInfo({
                src:url,
                success: function (res) {
                    console.log('prefetch success', res);
                }
            });
        }
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {
       /* wx.getSetting({
            success(res) {
                console.log(11, res.authSetting)
            }
        })*/
    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh() {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom() {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage() {

    },

    onAuthorizeClick() {
        // scope.userInfo
        wx.getUserProfile({
            withCredentials: true,
            lang: 'zh_CN', // 'en' 'zh_CN' 'zh_TW'
            desc: '需要获得您的头像和昵称信息',

            success: function (userRes) {
                var userInfo = userRes.userInfo;
                var avatarUrl = userInfo.avatarUrl; // 用户头像
                var nickName = userInfo.nickName; // 用户昵称
                console.log('用户信息', userRes)
                // 可以将 code 和用户信息发送到服务器进行进一步处理
                // 服务器可以通过 code 获取 openid、unionid、session key
            },
            fail: function (err) {
                // 用户拒绝授权，可以引导用户打开设置页面开启授权
                console.log('getUserProfile fail', err);
            }
        });
    },

    goProfile(e) {
        if (!this.data.userInfo){
            console.log('Please wait for user info loaded.');
            wx.showToast({
                title: '请稍等用户信息加载完成',
                icon: 'fail',
                duration: 2000,
                mask: true
            });
            return;
        }
        wx.navigateTo({
            url: '/pages/index/profile',
        })
    },

    goModule(e) {
        console.log('goModule', this.data.userInfo);
        if (!this.data.userInfo){
            console.log('Please wait for user info loaded.');
            wx.showToast({
                title: '请稍等用户信息加载完成',
                icon: 'fail', 
                duration: 2000, 
                mask: true 
            });
            return;
        }
        const {url} = e.currentTarget.dataset
        console.log(url);
        wx.navigateTo({
            url,
        })
    }
})