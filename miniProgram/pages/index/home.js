const global = require('../../utils/global');

const PREFETCH_RESOURCES = ['https://ec7-fun.oss-rg-china-mainland.aliyuncs.com/vocab_master/mp/default_background.jpg', 'https://ec7-fun.oss-rg-china-mainland.aliyuncs.com/vocab_master/mp/plate.png',];

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
    onLoad() {
        const appInstance = getApp();

        this.setData({userInfo: appInstance.globalData.userInfo});
        console.log('userInfo', appInstance.globalData.userInfo);
        global.eventEmitter.on('userInfoUpdated', (userInfo) => {
            console.log('userInfo update', userInfo);
            this.setData({userInfo});
        });

        let moduleList = this.data.moduleList;
        moduleList.push({
            name: "背单词", url: '/pages/training/index',
        });
        moduleList.push({
            name: "错题集", url: '/pages/training/collected_mistakes',
        });
        moduleList.push({
            name: "强化训练", url: '/pages/training/boosting_exercise',
        });
        moduleList.push({
            name: "查辞典", url: '/pages/dictionary/index',
        });
        moduleList.push({
            name: "设置", url: '/pages/settings/index',
        });
        this.setData({'moduleList': moduleList});
        console.log(this.data.moduleList)
        //START: prefetch resources
        for (let url of PREFETCH_RESOURCES) {
            wx.getImageInfo({
                src: url, success: function (res) {
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
            withCredentials: true, lang: 'zh_CN', // 'en' 'zh_CN' 'zh_TW'
            desc: '需要获得您的头像和昵称信息',

            success: function (userRes) {
                console.log('用户信息', userRes)
            }, fail: function (err) {
                console.log('getUserProfile fail', err);
            }
        });
    },

    goProfile() {
        if (!this.data.userInfo) {
            console.log('Please wait for user info loaded.');
            wx.showToast({
                title: '请稍等用户信息加载完成', icon: 'fail', duration: 2000, mask: true
            });
            return;
        }
        wx.navigateTo({
            url: '/pages/index/profile',
        })
    },

    goModule(e) {
        console.log('goModule', this.data.userInfo);
        if (!this.data.userInfo) {
            console.log('Please wait for user info loaded.');
            wx.showToast({
                title: '请稍等用户信息加载完成', icon: 'fail', duration: 2000, mask: true
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