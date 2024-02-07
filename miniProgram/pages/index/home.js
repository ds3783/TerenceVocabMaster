// pages/index/home.js
Page({

    /**
     * 页面的初始数据
     */
    data: {
        moduleList: [],
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
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
        })
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

    goModule(e) {
        const {url} = e.currentTarget.dataset
        wx.navigateTo({
            url,
        })
    }
})