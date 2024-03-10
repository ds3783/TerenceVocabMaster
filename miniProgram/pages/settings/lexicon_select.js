// pages/settings/lexicon_select.js
const API = require("../../utils/apis");
// const global = require("../../utils/global");
Page({

    /**
     * 页面的初始数据
     */
    data: {
        lexiconList: [],
        selectedAll: false,
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        const appInstance = getApp();

        let userInfo = appInstance.globalData.userInfo;
        const envString = wx.getAccountInfoSync().miniProgram.envVersion;
        console.log('userInfo',userInfo,appInstance)
        wx.request({
            url: API('getUserLexiconList'),
            data: {
                open_id: userInfo.open_id,
                token: userInfo.token,
                env: envString,
            },
            method: 'GET',
            success: res => {
                if (res.statusCode !== 200) {
                    console.log('UserLexiconList load fail:', res);
                    wx.showModal({
                        title: '警告',
                        content: '未能获取用户当前词库列表，请稍后再试',
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
                let list = res.data;
                let selectedAll = true;
                for (let lexicon of list) {
                    if (!lexicon.selected)
                        selectedAll = false;
                }
                this.setData({
                    lexiconList: list,
                    selectedAll: selectedAll
                });

            },
            fail: res => {
                console.log('UserLexiconList load  fail:', res);

            }
        });
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

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

    onLexiconSelect(event) {
        let list = this.data.lexiconList;
        let selected = event.detail.value;
        let selectedAll = true;
        for (let lexicon of list) {
            let found = false;
            for (const selectedElement of selected) {
                if (lexicon.code === selectedElement) {
                    found = true;
                }
            }
            lexicon.selected = found;
            if (!found) {
                selectedAll = false;
            }
        }

        this.setData({
            lexiconList: list,
            selectedAll: selectedAll
        });
    },


    onSelectAll(event) {
        let selectedAll = event.detail.value.length > 0;
        let list = this.data.lexiconList;
        for (let lexicon of list) {
            lexicon.selected = selectedAll;
        }
        this.setData({
            lexiconList: list,
            selectedAll: selectedAll
        });
    },

    onSave() {
        const appInstance = getApp();
        let userInfo = appInstance.globalData.userInfo;
        const envString = wx.getAccountInfoSync().miniProgram.envVersion;

        let selected = [];
        for (let lexicon of this.data.lexiconList) {
            if (lexicon.selected)
                selected.push(lexicon.code);
        }
        console.log('save', selected);
        wx.showLoading({
            title: '加载中...',
            mask: true // 显示透明蒙层，防止触摸穿透
        });
        let successCallback = (res) => {
            console.log('save success', res);
            wx.hideLoading();
            wx.showToast({
                title: '保存成功',
                icon: 'success',
                duration: 2000,

            });

            setTimeout(() => {
                wx.navigateBack({
                    delta: 1
                });
            }, 2000);
        }
        let failCallback = (res) => {
            console.log('save fail', res);
            wx.hideLoading();
            wx.showToast({
                title: '保存失败,请稍后再试',
                icon: 'none',
                duration: 2000
            });
        }

        wx.request({
            url: API('setUserLexiconList'),
            data: {
                open_id: userInfo.open_id,
                token: userInfo.token,
                env: envString,

                lexicons: JSON.stringify(selected),
            },
            method: 'POST',
            success: res => {
                if (res.statusCode !== 200) {
                    console.log('UserLexiconList updated fail:', res);
                    failCallback(res);
                    return;
                }
                console.log('UserLexiconList updated success:', res);
                successCallback(res);

            },
            fail: res => {
                console.log('update profile fail:', res);
                failCallback(res);
            }
        });
    }


})