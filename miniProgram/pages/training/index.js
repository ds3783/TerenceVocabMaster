// pages/training/index.js
const API = require("../../utils/apis");
Page({

    /**
     * 页面的初始数据
     */
    data: {
        hasPrevious: false,
        hasNext: false,
        topic: null,
        busy: false,
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
        this.loadNext(true);
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

    loadNext(firstLoad = false) {
        wx.showLoading({mask: true, title: '题目加载中...'});
        const appInstance = getApp();

        let userInfo = appInstance.globalData.userInfo;
        const envString = wx.getAccountInfoSync().miniProgram.envVersion;
        let reqData = {
            open_id: userInfo.open_id,
            token: userInfo.token,
            env: envString,
        };
        if (!firstLoad && this.data.topic) {
            reqData.topic_sequence = this.data.topic.sequence;
        }
        wx.request({
            url: API('loadNextTopic'),
            data:reqData,
            method: 'GET',
            success: res => {
                if (res.statusCode !== 200) {
                    console.log('loadNextTopic load fail:', res);
                    wx.hideLoading();
                    wx.showModal({
                        title: '警告',
                        content: '网络错误，请稍后再试',
                        showCancel: false, // 不显示取消按钮
                        confirmText: '确定', // 确定按钮的文字，默认为"确定"
                        success: function (res) {
                            if (res.confirm) {
                                if (firstLoad) {
                                    wx.navigateBack({
                                        delta: 1
                                    });
                                }
                            }
                        }
                    });
                    return;
                }
                let result = res.data;
                if (result.noMoreTopics){
                    wx.navigateTo({
                        url: '/pages/training/summary',
                    });
                }else{
                    this.setData({
                        topic: result.topic,
                        hasPrevious: result.hasPrevious,
                        hasNext: result.hasNext,
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
                            if (firstLoad) {
                                wx.navigateBack({
                                    delta: 1
                                });
                            }
                        }
                    }
                });
                wx.hideLoading();
            }
        });
    },

    chooseOption(e) {
        if (this.data.busy || this.data.topic.user_choice !== null) {
            console.log('Ignore duplicate click');
            return;
        }
        let {choice} = e.currentTarget.dataset
        choice = '' + choice;
        console.log(choice);
        let topic = this.data.topic;
        topic.user_choice = choice;
        this.setData({busy: true, topic: topic}, () => {
            //send choice to server
            const appInstance = getApp();

            let userInfo = appInstance.globalData.userInfo;
            const envString = wx.getAccountInfoSync().miniProgram.envVersion;
            const $this = this;
            setTimeout(() => {
                if ($this.data.busy) {
                    $this.setData({busy: false}, () => {
                        $this.loadNext();
                    });
                }else{
                    $this.loadNext();
                }
            }, 1500);
            wx.request({
                url: API('saveTopicChoice'),
                data: {
                    open_id: userInfo.open_id,
                    token: userInfo.token,
                    env: envString,
                    topic_id: this.data.topic.id,
                    choice: choice,
                },
                method: 'POST',
                success: res => {
                    console.log('save user choice:', res);
                    if (res.statusCode !== 200) {
                        wx.showModal({
                            title: '警告',
                            content: '网络错误，请稍后再试',
                            showCancel: false, // 不显示取消按钮
                            confirmText: '确定', // 确定按钮的文字，默认为"确定"
                            success: function (res) {
                                if (res.confirm) {
                                    if ($this.data.busy) {
                                        $this.setData({busy: false}, () => {
                                            // $this.loadNext();
                                        });
                                    }
                                }
                            }
                        });

                        return;
                    }


                    if ($this.data.busy) {
                        $this.setData({busy: false}, () => {
                            // $this.loadNext();
                        });
                    }
                },
                fail: res => {
                    console.log('saveTopicChoice  fail:', res);
                    wx.showModal({
                        title: '警告',
                        content: '网络错误，请稍后再试',
                        showCancel: false, // 不显示取消按钮
                        confirmText: '确定', // 确定按钮的文字，默认为"确定"
                        success: function (res) {
                            if (res.confirm) {
                                if ($this.data.busy) {
                                    $this.setData({busy: false}, () => {
                                        // $this.loadNext();
                                    });
                                }
                            }
                        }
                    });
                }
            });

        });
    },

    goPrevious() {
        if (!this.data.hasPrevious) {
            //do nothing
            return;
        }
        wx.showLoading({mask: true, title: '题目加载中...'});
        const appInstance = getApp();

        let userInfo = appInstance.globalData.userInfo;
        const envString = wx.getAccountInfoSync().miniProgram.envVersion;
        wx.request({
            url: API('loadPreviousTopic'),
            data: {
                open_id: userInfo.open_id,
                token: userInfo.token,
                env: envString,
                topic_sequence: this.data.topic.sequence,
            },
            method: 'GET',
            success: res => {
                if (res.statusCode !== 200) {
                    console.log('loadPreviousTopic load fail:', res);
                    wx.hideLoading();
                    wx.showModal({
                        title: '警告',
                        content: '网络错误，请稍后再试',
                        showCancel: false, // 不显示取消按钮
                        confirmText: '确定', // 确定按钮的文字，默认为"确定"

                    });
                    return;
                }
                let result = res.data;

                this.setData({
                    topic: result.topic,
                    hasPrevious: result.hasPrevious,
                    hasNext: result.hasNext,
                });
                wx.hideLoading();
            },
            fail: res => {
                console.log('loadPreviousTopic load  fail:', res);
                wx.showModal({
                    title: '警告',
                    content: '网络错误，请稍后再试',
                    showCancel: false, // 不显示取消按钮
                    confirmText: '确定', // 确定按钮的文字，默认为"确定"

                });
                wx.hideLoading();
            }
        });
    },

    goNext() {
        if (!this.data.hasNext) {
            //do nothing
            return;
        }
        this.loadNext(false)
    }
})