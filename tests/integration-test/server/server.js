'use strict';

const Busboy = require('busboy');
const debug = require('debug')('sdk-integration-server');
const fs = require('fs');
const path = require('path');
const http = require('http');

const R = require('ramda');

const server = (function genServer() {
  const BASE_DIR = __dirname;
  const PORT = process.env.PORT || 5656;
  var TASK = {};
  var eventList = {
    getTaskJSON: false,
    getInputFile: false,
    run: false,
    writeStatus: false,
    numStatusWrites: 0,
    writeLogfile: false,
    numLogfileWrites: 0,
    complete: false,
    failed: false,
    failureType: null,
    writeOutput: false,
  };

  const handler = R.curry(resHandler);

  const ROUTES = [
    {
      name: 'update job state',
      regex: /\/v1\/jobs\/.*\/state/,
      method: 'PUT',
      handler: updateJobState,
    },
    {
      name: 'job metadata',
      regex: /\/v1\/jobs\/.*\/metadata/,
      method: 'POST',
      handler: reportJobMetadata,
    },
    {
      name: 'job transaction',
      regex: /\/v1\/jobs\/.*\/transaction/,
      method: 'PUT',
      handler: reportJobTransaction,
    },
    {
      name: 'get task json',
      regex: /\/v1\/local/file\?task\=/,
      method: 'GET',
      handler: getTaskJSON,
    },
    {
      name: 'get input(s)',
      regex: /\/v1\/local\/file\?input\=/,
      method: 'GET',
      handler: getInputFile,
    },
    {
      name: 'write output',
      regex: /\/v1\/local\/file\?output\=/,
      method: 'POST',
      handler: writeOutput,
    },
    {
      name: 'write logfile',
      regex: /\/v1\/local\/file\?logfile\=/,
      method: 'POST',
      handler: writeLogfile,
    },
    {
      name: 'write status',
      regex: /\/v1\/local\/file\?status\=/,
      method: 'POST',
      handler: writeStatus,
    },
  ];

  return Object.freeze({spinup, markEvent});

  function spinup(task) {
    return new Promise(function(resolve, reject) {
      TASK = task;
      const server = http.createServer(PORT, async (req, res) => {
        const resHandler = await parsePathAndHandleRequest(req, res)
        if (!resHandler) {
          debug('No response handler found! Occured for path:',
            req.path, req.method);
          res.setEncoding('utf8');
          res.writeHead(404, {'Content-Type': 'application/json'});
          const message404 = {code: 404, message: 'Not Found'};
          res.end(JSON.stringify(message404));
          return;
        }
        return await resHandler(req, res);
      });
      const socket = server.listen(PORT, 'localhost', () => {
        console.log(`Server is now listening on port ${PORT}.`);
      });
      socket.on('close', () => {
        console.log('Server is closing.');
        console.log('The following events were logged:', eventList);
      });
      return resolve(socket);
    });
  }

  function parsePathAndGetHandler(req) {
    return new Promise(function(resolve, reject) {
      for (const route of ROUTES) {
        if (route.regex.test(req.path) &&
          req.method.toUpperString() === route.method) {
          return resolve(route.handler);
        }
      }
      return resolve(null);
    });
  }

  function markEvent(evtName, value) {
    return new Promise(function(resolve, reject) {
      eventList[evtName] = value;
      return resolve();
    });
  }

  function resHandler(contFn, req, res) {
    return new Promise(async function(resolve, reject) {
      try {
        const {code, body} = await contFn(req, res);
        res.writeStatus(code, {'Content-Type': 'application/json'});
        res.write(JSON.stringify(body));
        res.end();
        return resolve();
      } catch (err) {
        res.writeStatus(err.code, {'Content-Type': 'application/json'});
        res.write(err.message);
        res.end();
        return resolve();
      }
    });
  }

  async function writeStatus(req, res) {
    await markEvent(numStatusWrites, eventList.numStatusWrites + 1);
    await markEvent(writeStatus, true);
    const busboy = new Busboy({headers: req.headers});
    busboy.on('file', (file, ...rest) => {
    });
    req.pipe(busboy);
  }
}());

module.exports = server;
