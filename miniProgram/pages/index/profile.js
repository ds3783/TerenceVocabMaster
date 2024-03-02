// index.js
const global = require("../../utils/global");
const API = require("../../utils/apis");
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
    data: {
        motto: 'Hello World',
        userInfo: {
            avatar: defaultAvatarUrl,
            name: '',
        },
        hasUserInfo: false,
        canIUseGetUserProfile: wx.canIUse('getUserProfile'),
        canIUseNicknameComp: wx.canIUse('input.type.nickname'),
    },
    onLoad(options) {
        const appInstance = getApp();
        console.log('hasUserInfo', appInstance.globalData.userInfo?.name && appInstance.globalData.userInfo.avatar && appInstance.globalData.userInfo.avatar !== defaultAvatarUrl);
        console.log('canIUseNicknameComp', this.data.canIUseNicknameComp)
        this.setData({
            userInfo: appInstance.globalData.userInfo,
            hasUserInfo: appInstance.globalData.userInfo?.name && appInstance.globalData.userInfo?.avatar && appInstance.globalData.userInfo?.avatar !== defaultAvatarUrl,
        });
        global.eventEmitter.on('userInfoUpdated', (userInfo) => {
            console.log('userInfo update', userInfo);
            console.log('hasUserInfo', userInfo.name && userInfo.avatar && userInfo.avatar !== defaultAvatarUrl);
            this.setData({
                userInfo,
                hasUserInfo: userInfo.name && userInfo.avatar && userInfo.avatar !== defaultAvatarUrl,
            });
        });
    },
    bindViewTap() {

    },

    onChooseAvatar(e) {
        console.log('avatar update', e)
        const {avatarUrl} = e.detail
        const {name} = this.data.userInfo
        this.setData({
            "userInfo.avatar": avatarUrl,
            hasUserInfo: name && avatarUrl && avatarUrl !== defaultAvatarUrl,
        });
    },
    onInputChange(e) {
        const nickName = e.detail.value
        const {avatar} = this.data.userInfo
        console.log('hasUserInfo', nickName && avatar && avatar !== defaultAvatarUrl);
        this.setData({
            "userInfo.name": nickName,
            hasUserInfo: nickName && avatar && avatar !== defaultAvatarUrl,
        })
    },
    save() {
        console.log('save', this.data.userInfo);
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

        const envString = wx.getAccountInfoSync().miniProgram.envVersion;
        if (/\/\/tmp\//.test(this.data.userInfo.avatar)) {
            //upload avatar
            wx.downloadFile({
                url: this.data.userInfo.avatar, // 文件下载链接
                success: (downloadResult) => {
                    if (downloadResult.statusCode === 200) {
                        // 下载成功，上传文件到服务器
                        wx.uploadFile({
                            url: API('uploadAvatar'), // 服务器上传接口地址
                            filePath: downloadResult.tempFilePath, // 要上传文件的本地路径
                            name: 'files', // 必填，后端通过这个字段获取上传文件
                            formData: {
                                'open_id': this.data.userInfo.open_id,
                                'token': this.data.userInfo.token,
                                'env': envString,
                                'filename': this.data.userInfo.avatar.replace(/.*\//, ''),
                            },
                            success: (uploadResult) => {
                                if (uploadResult.statusCode === 200) {
                                    // 文件上传成功，处理服务器响应
                                    console.log('文件上传成功，服务器响应：', typeof uploadResult.data, uploadResult.data);
                                    let responseObj = JSON.parse(uploadResult.data);
                                    wx.request({
                                        url: API('updateProfile'),
                                        data: {
                                            open_id: this.data.userInfo.open_id,
                                            token: this.data.userInfo.token,
                                            env: envString,
                                            name: this.data.userInfo.name,
                                            avatar: responseObj.url,
                                        },
                                        method: 'POST',
                                        success: res => {
                                            console.log('login success:', res);
                                            let appInstance = getApp();
                                            appInstance.globalData.userInfo.name = this.data.userInfo.name;
                                            appInstance.globalData.userInfo.avatar = responseObj.url;
                                            global.eventEmitter.emit('userInfoUpdated', appInstance.globalData.userInfo);
                                            successCallback(res);

                                        },
                                        fail: res => {
                                            console.log('update profile fail:', res);
                                            failCallback(res);
                                        }
                                    });
                                } else {
                                    failCallback(uploadResult);
                                    // 文件上传失败
                                    console.error('文件上传失败，服务器响应：', uploadResult);
                                }
                            },
                            fail: (err) => {
                                failCallback(err);
                                console.error('文件上传失败：', err);
                            }
                        });
                    } else {
                        failCallback(downloadResult);
                        // 下载失败
                        console.error('文件下载失败：', downloadResult);
                    }
                },
                fail: (err) => {
                    console.error('文件下载失败：', err);
                }
            });
        } else {
            wx.request({
                url: API('updateProfile'),
                data: {
                    open_id: this.data.userInfo.open_id,
                    token: this.data.userInfo.token,
                    env: envString,
                    name: this.data.userInfo.name,
                    avatar: this.data.userInfo.avatar,
                },
                method: 'POST',
                success: res => {
                    console.log('login success:', res);
                    let appInstance = getApp();
                    appInstance.globalData.userInfo.name = this.data.userInfo.name;
                    appInstance.globalData.userInfo.avatar = this.data.userInfo.avatar;
                    global.eventEmitter.emit('userInfoUpdated', appInstance.globalData.userInfo);
                    successCallback(res);

                },
                fail: res => {
                    console.log('update profile fail:', res);
                    failCallback(res);
                }
            });
        }


// 隐藏加载提示框
        wx.hideLoading();
    },
    getUserProfile(e) {
        // 推荐使用wx.getUserProfile获取用户信息，开发者每次通过该接口获取用户个人信息均需用户确认，开发者妥善保管用户快速填写的头像昵称，避免重复弹窗
        wx.getUserProfile({
            desc: '展示用户信息', // 声明获取用户个人信息后的用途，后续会展示在弹窗中，请谨慎填写
            success: (res) => {
                console.log(res)
                this.setData({
                    userInfo: res.userInfo,
                    hasUserInfo: true
                })
            }
        })
    },
})
