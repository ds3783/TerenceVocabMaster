import * as EventEmitter2 from 'eventemitter2';
import NestiaWeb from "nestia-web";
import cluster from "node:cluster";

let eventListeners = {};
let workerHandled = {};

let globalEmitter = new EventEmitter2.default.EventEmitter2({
    newListener: true,
    ignoreErrors: false,
    verboseMemoryLeak: true
});

globalEmitter.on('error', function (err) {
    NestiaWeb.logger.error(`Event error: ${err.message}`, err);
});

const eventLogger = function (ignoredEvent) {
    let eventName = this.event;
    let listeners = eventListeners[eventName];
    if (listeners) {
        listeners = listeners.map((listener) => {
            return listener.name;
        });
    }
    listeners = listeners || [];
    console.log(`Event[${eventName}] triggered, listeners:[${listeners.join(',')}]`)
    NestiaWeb.logger.info(`Event[${eventName}] triggered, listeners:[${listeners.join(',')}]`);
}

let loggedEvents = [];

globalEmitter.on('newListener', function (evtName, listener) {
    if (listener === eventLogger) {
        return;
    }

    if (evtName === 'removeListener') {
        return;
    }

    NestiaWeb.logger.info('New listener:', evtName, listener.name);
    if (!eventListeners[evtName]) {
        eventListeners[evtName] = [];
    }
    eventListeners[evtName].push(listener);
    if (loggedEvents.indexOf(evtName) < 0) {
        globalEmitter.on(evtName, eventLogger);
    }
});

globalEmitter.on('removeListener', function (evtName, listener) {
    if (listener === eventLogger) {
        return;
    }
    do {
        if (eventListeners[evtName]) {
            let idx = eventListeners[evtName].indexOf(listener);
            if (idx >= 0) {
                eventListeners[evtName].splice(idx, 1);
                if (eventListeners.length === 0) {
                    delete eventListeners[evtName];
                    let idx2 = loggedEvents.indexOf(evtName);
                    if (idx2 >= 0) {
                        loggedEvents.splice(idx2, 1);
                    } else {
                        globalEmitter.off(evtName, eventLogger);
                    }
                }
            }
        }

    } while (eventListeners[evtName] && eventListeners[evtName].indexOf(listener) >= 0);

});

let messageHandler = function (msg) {
    if ('GLOBAL_EVENT' === msg?.cmd) {
        for (const worker of Object.values(cluster.workers)) {
            worker.send({
                cmd: "GLOBAL_EVENT_DISPATCH",
                event: msg?.event
            });
        }
    }
}

globalEmitter.initEventDispatcher = function () {
    let reg = function (worker, messageHandler) {
        if (!workerHandled['pid-' + worker.process.pid]) {
            worker.on('message', messageHandler);
            workerHandled['pid-' + worker.process.pid] = true;
        }
    }
    for (const worker of Object.values(cluster.workers)) {
        reg(worker, messageHandler);
    }
    cluster.on('online', function (worker) {
        reg(worker, messageHandler);
    });
}


function createProxy(obj, funcName) {
    let _func = obj[funcName];
    obj[funcName] = function (eventName, eventData) {
        if ('newListener' === eventName) {
            _func.apply(this, arguments);
            return;
        }
        if (cluster.isWorker) {
            process.send({
                cmd: 'GLOBAL_EVENT',
                event: {
                    eventName,
                    eventData
                },
            });

        } else {
            _func.apply(this, arguments);
        }
    }

    obj['_' + funcName] = _func;

}

createProxy(globalEmitter, 'emit');
createProxy(globalEmitter, 'emitAsync');


process.on('message', function (msg) {
    if ('GLOBAL_EVENT_DISPATCH' === msg?.cmd && msg.event) {
        //dispatch event locally
        globalEmitter['_emit'](msg.event.eventName, msg.event.eventData);
    }
});

export default globalEmitter;