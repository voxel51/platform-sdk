'use strict';

const Busboy = require('busboy');
const debug = require('debug')('sdk-integration-server');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const R = require('ramda');

const server = (function genServer() {
  const BASE_DIR = __dirname;
  const PORT = process.env.PORT || 5656;
  var TASK = {};
  var eventList = {
    getTaskJSON: false,
    getInputFile: false,
    running: false,
    writeStatus: false,
    numStatusWrites: 0,
    writeLogfile: false,
    numLogfileWrites: 0,
    complete: false,
    failed: false,
    failureType: null,
    writeOutput: false,
    reportMetadata: false,
    reportTransactionUnits: false,
  };

  const getQueryFilename = (qp) => qp.split('/').pop();
  const handler = R.curry(resHandler);

  const ROUTES = [
    {
      name: 'update job state',
      regex: new RegExp('\\/v1\\/jobs\\/.*\\/state'),
      method: 'PUT',
      handler: updateJobState,
    },
    {
      name: 'job metadata',
      regex: new RegExp('\\/v1\\/jobs\\/.*\\/metadata'),
      method: 'POST',
      handler: reportJobMetadata,
    },
    {
      name: 'job transaction',
      regex: new RegExp('\\/v1\\/jobs\\/.*\\/transaction'),
      method: 'PUT',
      handler: reportJobTransaction,
    },
    {
      name: 'get task json',
      regex: new RegExp('\\/v1\\/local/file\\?task\\='),
      method: 'GET',
      handler: getTaskJSON,
    },
    {
      name: 'get input(s)',
      regex: new RegExp('\\/v1\\/local\\/file\\?input\\='),
      method: 'GET',
      handler: getInputFile,
    },
    {
      name: 'write output',
      regex: new RegExp('\\/v1\\/local\\/file\\?output\\='),
      method: 'POST',
      handler: writeOutput,
    },
    {
      name: 'write logfile',
      regex: new RegExp('\\/v1\\/local\\/file\\?logfile\\='),
      method: 'POST',
      handler: writeLogfile,
    },
    {
      name: 'write status',
      regex: new RegExp('\\/v1\\/local\\/file\\?status\\='),
      method: 'POST',
      handler: writeStatus,
    },
  ];

  return Object.freeze({spinup, markEvent});

  function spinup(task) {
    return new Promise(function(resolve, reject) {
      TASK = task;
      const server = http.createServer(async (req, res) => {
        const resHandler = await parsePathAndGetHandler(req, res)
        if (!resHandler) {
          debug('No response handler found! Occured for path:',
            req.path, req.method);
          res.setEncoding('utf8');
          res.writeHead(404, {'content-type': 'application/json'});
          res.end(JSON.stringify({
            code: 404,
            message: 'Not Found',
          }));
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
      const u = url.parse(req.url, true);
      for (const route of ROUTES) {
        if (route.regex.test(u.path) &&
          req.method.toUpperCase() === route.method) {
          return resolve(handler(route.handler));
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
        if (res.headersSent || (!code && !body)) {
          return resolve();
        }
        res.setEncoding('utf8');
        res.writeHead(code, {'content-type': 'application/json'});
        res.write(JSON.stringify(body));
        res.end();
        return resolve();
      } catch (err) {
        console.log('\n\nERROR\n\n', err);
        res.writeHead(err.code, {'content-type': 'application/json'});
        res.write(err);
        res.end();
        return resolve();
      }
    });
  }

  async function updateJobState(req, res) {
    res.setEncoding('utf8');
    res.setHeader('content-type', 'application/json');
    const body = await readRequestBody(req);
    if (!body.state ||
      (body.state !== 'COMPLETE' ||
        body.state !== 'FAILED' ||
        body.state !== 'RUNNING')) {
      return {
        code: 400,
        body: {code: 400, message: 'Invalid state provided.'},
      };
    }
    if (body.state === 'RUNNING') {
      await markEvent('running', true);
    } else if (body.state === 'COMPLETE') {
      await markEvent('complete', true);
    } else {
      await markEvent('failed', true);
      if (!body.failure_type ||
        typeof body.failure_type !== 'string') {
        return {
          code: 400,
          body: {code: 400, message: 'Failure type should be provided.'},
        };
      }
      await markEvent('failureType', body.failure_type);
    }
    return {
      code: 200,
      body: {state: body.state},
    };
  }

  async function reportJobMetadata(req, res) {
    await markEvent('reportMetadata', true);
    const body = await readRequestBody(req);
    const fields = ['frame_count', 'size_bytes', 'duration_seconds'];
    if (!fields.every((f) => existsAndNumber(body[f]))) {
      return {
        code: 400,
        body: {code: 400, message: 'All three job metadata fields should be valid numbers.'},
      };
    }
    return {
      code: 204,
      body: {},
    };
  }

  async function reportJobTransaction(req, res) {
    await markEvent('reportTransactionUnits', true);
    const body = await readRequestBody(req);
    if (!existsAndNumber(body.transaction_units)) {
      return {
        code: 400,
        body: {code: 400, message: 'Transaction units must be a valid number.'},
      };
    }
    return {
      code: 204,
      body: {},
    };
  }

  async function getTaskJSON(req, res) {
    await markEvent('getTaskJSON', true);
    const u = await checkQuery(req, res, 'task');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['task'];
    return await createAndPipeReadStream(u, res);
  }

  async function getInputFile(req, res) {
    await markEvent('getInputFile', true);
    const u = await checkQuery(req, res, 'input');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['input'];
    return await createAndPipeReadStream(u, res);
  }

  async function writeOutput(req, res) {
    await markEvent('writeOutput', true);
    const u = await checkQuery(req, res, 'output');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['output'];
    return await createAndPipeWriteStream(u, req, res);
  }

  async function writeLogfile(req, res) {
    await markEvent('writeLogfile', true);
    const u = await checkQuery(req, res, 'logfile');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['logfile'];
    return await createAndPipeWriteStream(u, req, res);
  }

  async function writeStatus(req, res) {
    await markEvent(numStatusWrites, eventList.numStatusWrites + 1);
    await markEvent(writeStatus, true);
    const u = await checkQuery(req, res, 'status');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['status'];
    return await createAndPipeWriteStream(u, req, res);
  }

  function readRequestBody(req) {
    return new Promise(function(resolve, reject) {
      req.setEncoding('utf8');
      var body = '';
      req.on('data', (data) => {
        body += data;
      });
      req.on('end', () => {
        if (req.headers['content-type'] === 'application/json') {
          return resolve(JSON.parse(body));
        }
        return resolve(body);
      });
    });
  }

  function existsAndNumber(t) {
    return t !== undefined && t !== null && typeof t === 'number';
  }

  function checkQuery(req, res, field) {
    return new Promise(function(resolve, reject) {
      const u = url.parse(req.url, true);
      if (!u.query[field]) {
        return resolve({
          code: 404,
          mesage: 'Not found. Invalid signed url format.',
        });
      }
      return resolve(u);
    });
  }

  function createAndPipeReadStream(url, res) {
    return new Promise(function(resolve, reject) {
      const rs = fs.createReadStream(url.query.path);
      rs.on('error', (err) => {
        return resolve({
          code: 400,
          body: err,
        });
      });
      const filename = getQueryFilename(url.query.path);
      res.setHeader('content-disposition', `attachment; filename=${filename}`);
      rs.pipe(res);
      return resolve({});
    });
  }

  function createAndPipeWriteStream(url, req, res) {
    return new Promise(function(resolve, reject) {
      const ws = fs.createWriteStream(url.query.path);
      ws.on('error', (err) => {
        return resolve({
          code: 400,
          body: err,
        });
      });
      ws.on('finish', () => {
        return resolve({
          code: 201,
          body: {},
        });
      });
      req.pipe(ws);
    });
  }
}());

module.exports = server;
