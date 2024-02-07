#!/usr/bin/env node --experimental-modules

import {instanceWebServer} from './web.mjs';
import cluster from 'cluster';
import OS from 'os';
import {default as nestiaConfig} from "./middlewareConfig.mjs";
import NestiaWeb from "nestia-web";
import globalEvent from "../lib/misc/globalEvent.mjs";


if (cluster.isMaster || cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`);


    // Count requests
    /*function messageHandler(msg) {
        if (msg.cmd && msg.cmd === 'notifyRequest') {
            numReqs += 1;
        }
    }*/

    // Start workers and listen for messages containing notifyRequest
    const CPUs = OS.cpus();
    let numCPUs = CPUs.length;

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    /*for (const id in cluster.workers) {
        cluster.workers[id].on('message', messageHandler);
    }*/
    NestiaWeb.init(nestiaConfig);
    globalEvent.initEventDispatcher();

} else {
    console.log(`Starting worker ${process.pid}`)
    instanceWebServer().then(() => {
    });
}

