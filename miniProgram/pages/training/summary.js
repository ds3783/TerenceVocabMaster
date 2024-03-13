// pages/training/summary.js
const API = require("../../utils/apis");
Page({

    /**
     * 页面的初始数据
     */
    data: {
        words_correct: 0,
        words_total: 0,
        correct_rate: 0,
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {

    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {
        wx.showLoading({mask: true, title: '加载中...'});
        const appInstance = getApp();

        let userInfo = appInstance.globalData.userInfo;
        const envString = wx.getAccountInfoSync().miniProgram.envVersion;
        let reqData = {
            open_id: userInfo.open_id,
            token: userInfo.token,
            env: envString,
        };

        wx.request({
            url: API('getMySummary'),
            data: reqData,
            method: 'GET',
            success: res => {
                if (res.statusCode !== 200) {
                    console.log('getMySummary load fail:', res);
                    wx.hideLoading();
                    wx.showModal({
                        title: '警告',
                        content: '网络错误，请稍后再试',
                        showCancel: false, // 不显示取消按钮
                        confirmText: '确定', // 确定按钮的文字，默认为"确定"
                        success: function (res) {
                            if (res.confirm) {
                                wx.navigateBack({
                                    delta: 1
                                });
                            }
                        }
                    });
                    return;
                }
                let result = res.data;
                this.setData({
                    words_correct: result.words_correct,
                    words_total: result.words_total,
                    correct_rate: result.correct_rate,
                });
                wx.hideLoading();
            },
            fail: res => {
                console.log('loadNextTopic load  fail:', res);
                wx.showModal({
                    title: '警告',
                    content: '网络错误，请稍后再试',
                    showCancel: false, // 不显示取消按钮
                    confirmText: '确定', // 确定按钮的文字，默认为"确定"
                    success: function (res) {
                        if (res.confirm) {
                            wx.navigateBack({
                                delta: 1
                            });
                        }
                    }
                });
                wx.hideLoading();
            }
        });
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

    startOver() {
        wx.showModal({
            title: '重新开始',
            content: '将会清空当前记录，确定重新开始吗？',
            success(res) {
                if (res.confirm) {
                    wx.showLoading({mask: true, title: '加载中...'});
                    const appInstance = getApp();

                    let userInfo = appInstance.globalData.userInfo;
                    const envString = wx.getAccountInfoSync().miniProgram.envVersion;
                    let reqData = {
                        open_id: userInfo.open_id,
                        token: userInfo.token,
                        env: envString,
                    };

                    wx.request({
                        url: API('trainingStartOver'),
                        data: reqData,
                        method: 'POST',
                        success: res => {
                            if (res.statusCode !== 200) {
                                console.log('trainingStartOver load fail:', res);
                                wx.hideLoading();
                                wx.showModal({
                                    title: '警告',
                                    content: '网络错误，请稍后再试',
                                    showCancel: false, // 不显示取消按钮
                                    confirmText: '确定', // 确定按钮的文字，默认为"确定"
                                    success: function (res) {
                                       
                                    }
                                });
                                return;
                            }
                           
                            wx.hideLoading();
                            wx.navigateBack({
                                delta: 1
                            });
                        },
                        fail: res => {
                            console.log('trainingStartOver load  fail:', res);
                            wx.showModal({
                                title: '警告',
                                content: '网络错误，请稍后再试',
                                showCancel: false, // 不显示取消按钮
                                confirmText: '确定', // 确定按钮的文字，默认为"确定"
                                success: function (res) {
                                    if (res.confirm) {
                                     
                                    }
                                }
                            });
                            wx.hideLoading();
                        }
                    });
                } 
            }
        });
    }
})