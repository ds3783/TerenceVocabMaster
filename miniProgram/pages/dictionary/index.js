// pages/dictionary/index.js
Page({

    /**
     * 页面的初始数据
     */
    data: {
        query_text: '',
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

    onInput(e) {
        let value = e.detail.value;
        if (value.length > 64) {
            value = value.slice(0, 64)
        }
        this.setData({
            query_text: value
        })
    },

    doQuery() {
        let query_text = this.data.query_text;
        if (query_text.length > 0) {
            wx.navigateTo({
                url: './result?type=en2zh&query_text=' + encodeURIComponent(query_text)
            });
        }
    }
})