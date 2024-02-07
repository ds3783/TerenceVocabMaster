#!/usr/bin/env node

/**
 * Module dependencies.
 */

import app from './app.mjs';
import http from 'http';

/**
 * Get port from environment and store in Express.
 */

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
    let port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}

/**
 * Event listener for HTTP server "listening" event.
 */

export async function instanceWebServer() {
    let port = normalizePort(process.env.PORT || '3500');
    console.log('Starting app on port:' + port);
    let application = await app();
    application.set('port', port);

    /**
     * Create HTTP server.
     */

    let server = http.createServer(application);

    function onListening() {
        let addr = server.address();
        let bind = typeof addr === 'string'
            ? 'pipe ' + addr
            : 'port ' + addr.port;
        console.log('Listening on ' + bind);
    }


    function onError(error) {
        if (error.syscall !== 'listen') {
            throw error;
        }

        let bind = typeof port === 'string'
            ? 'Pipe ' + port
            : 'Port ' + port;

        // handle specific listen errors with friendly messages
        switch (error.code) {
            case 'EACCES':
                console.error(bind + ' requires elevated privileges');
                process.exit(1);
                break;
            case 'EADDRINUSE':
                console.error(bind + ' is already in use');
                process.exit(1);
                break;
            default:
                throw error;
        }
    }


    /**
     * Listen on provided port, on all network interfaces.
     */

    server.listen(port);
    server.on('error', onError);
    server.on('listening', onListening);
    return server;

}



export default {
    instanceWebServer,
}
