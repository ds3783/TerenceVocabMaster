// pages/settings/clear_data.js
const API = require("../../utils/apis");
Page({

    /**
     * 页面的初始数据
     */
    data: {
        training_data_selected: false, mistake_data_selected: false, selectedAll: false,
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
        let training_data_selected = false;
        let mistake_data_selected = false;
        for (const selectedElement of selected) {
            if ('TRAIN_DATA' === selectedElement) {
                training_data_selected = true;
            } else if ('MISTAKE_DATA' === selectedElement) {
                mistake_data_selected = true;
            }
        }


        this.setData({
            training_data_selected: training_data_selected,
            mistake_data_selected: mistake_data_selected,
            selectedAll: training_data_selected && mistake_data_selected,
        });
    },

    onSelectAll(event) {
        let selectedAll = event.detail.value.length > 0;
        this.setData({
            training_data_selected: selectedAll, mistake_data_selected: selectedAll, selectedAll: selectedAll
        });
    },

    onSave() {
        if (!this.data.training_data_selected && !this.data.mistake_data_selected) {
            wx.showToast({
                title: '请选择要删除的数据', icon: 'none', duration: 1000
            });
            return;
        }
        let $this=this;
        wx.showModal({
            title: '确认删除', content: '删除后的数据就再也找不回来哦？', confirmText: '删除', success(res) {
                if (res.confirm) {
                    const appInstance = getApp();
                    let userInfo = appInstance.globalData.userInfo;
                    const envString = wx.getAccountInfoSync().miniProgram.envVersion;

                    wx.showLoading({
                        title: '加载中...', mask: true // 显示透明蒙层，防止触摸穿透
                    });
                    let successCallback = (res) => {
                        console.log('save success', res);
                        wx.hideLoading();
                        wx.showToast({
                            title: '数据已删除', icon: 'success', duration: 2000,

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
                            title: '保存失败,请稍后再试', icon: 'none', duration: 2000
                        });
                    }
                    let deleteData = {
                        training_data: $this.data.training_data_selected, mistake_data: $this.data.mistake_data_selected,
                    }

                    wx.request({
                        url: API('deleteMyData'), data: {
                            open_id: userInfo.open_id, token: userInfo.token, env: envString,

                            deletion: JSON.stringify(deleteData),
                        }, method: 'POST', success: res => {
                            if (res.statusCode !== 200) {
                                console.log('UserLexiconList delete fail:', res);
                                failCallback(res);
                                return;
                            }
                            console.log('UserLexiconList delete success:', res);
                            successCallback(res);

                        }, fail: res => {
                            console.log('update profile fail:', res);
                            failCallback(res);
                        }
                    });
                } else if (res.cancel) {

                }
            }
        });
    }
})