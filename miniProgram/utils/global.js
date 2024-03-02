const EventEmitter = {
    events: {}, // 存储事件监听器的对象

    // 注册事件监听器
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    },

    // 触发事件
    emit(event, ...args) {
        if (this.events[event]) {
            this.events[event].forEach(listener => listener(...args));
        }
    },

    // 移除事件监听器
    off(event, listener) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(l => l !== listener);
        }
    }
};

// 导出全局对象
module.exports = {
    eventEmitter: EventEmitter
};