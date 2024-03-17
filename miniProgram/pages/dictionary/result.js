// pages/dictionary/result.js
const API = require("../../utils/apis");
Page({

    /**
     * 页面的初始数据
     */
    data: {
        query_type: '',
        query_text: '',
        result: '',
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        console.log(options)
        this.setData({query_type: options.type, query_text: decodeURIComponent(options.query_text || '').trim()});
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {
        wx.showLoading({mask: true, title: '加载中...'});
        const appInstance = getApp();

        let userInfo = appInstance.globalData.userInfo;
        if (!userInfo) {
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
        const envString = wx.getAccountInfoSync().miniProgram.envVersion;
        let reqData = {
            open_id: userInfo.open_id,
            token: userInfo.token,
            env: envString,
            type: this.data.query_type,
            text: this.data.query_text,
        };

        wx.request({
            url: API('getDictionaryDetail'),
            data: reqData,
            method: 'GET',
            success: res => {
                if (res.statusCode !== 200) {
                    console.log('getDictionaryDetail load fail:', res);
                    wx.hideLoading();
                    wx.showModal({
                        title: '警告',
                        content: '未找到相关词条： '+this.data.query_text,
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
                if (result === null) {
                    wx.showModal({
                        title: '错误',
                        content: '未找到相关词条： '+this.data.query_text +' 请检查输入',
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
                } else {
                    result.translation = (result.translation || '').split('\n');
                    result.explanation = (result.explanation || '').split('\n');
                    result.example = (result.example || '').split('\n');
                    this.setData({
                        result: result,
                    });
                }
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
    goBack() {
        wx.navigateBack({
            delta: 1
        });
    }
})