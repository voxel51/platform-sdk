'use strict';

const debug = require('debug')('sdk-integration-server');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

const R = require('ramda');

const server = (function genServer() {
  const config = require('./config.js');
  const BASE_DIR = __dirname;
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
  };

  const getQueryFilename = (qp) => qp.split('/').pop();
  const handler = R.curry(resHandler);

  const ROUTES = [
    {
      name: 'update job state',
      regex: new RegExp('\\/v1\\/jobs\\/.*\\/state'),
      methods: ['PUT'],
      handler: updateJobState,
    },
    {
      name: 'job metadata',
      regex: new RegExp('\\/v1\\/jobs\\/.*\\/metadata'),
      methods: ['POST'],
      handler: reportJobMetadata,
    },
    {
      name: 'get task json',
      regex: new RegExp('\\/v1\\/local\\/file\\?task\\='),
      methods: ['HEAD', 'GET'],
      handler: getTaskJSON,
    },
    {
      name: 'get input(s)',
      regex: new RegExp('\\/v1\\/local\\/file\\?inputs\\='),
      methods: ['HEAD', 'GET'],
      handler: getInputFile,
    },
    {
      name: 'write output',
      regex: new RegExp('\\/v1\\/local\\/file\\?output\\='),
      methods: ['PUT', 'POST'],
      handler: writeOutput,
    },
    {
      name: 'write logfile',
      regex: new RegExp('\\/v1\\/local\\/file\\?logfile\\='),
      methods: ['PUT', 'POST'],
      handler: writeLogfile,
    },
    {
      name: 'write status',
      regex: new RegExp('\\/v1\\/local\\/file\\?status\\='),
      methods: ['PUT', 'POST'],
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
            req.url, req.method);
          res.writeHead(404, {'content-type': 'application/json'});
          res.end(JSON.stringify({
            code: 404,
            message: 'Not Found',
          }));
          return;
        }
        debug('Response handler found. Calling controller.');
        return await resHandler(req, res);
      });
      const socket = server.listen(config.PORT, 'localhost', () => {
        console.log(`Server is now listening on port ${config.PORT}.`);
      });
      socket.on('close', async () => {
        console.log('Server is closing.\n');
        await generateOutputReport();
      });
      return resolve(socket);
    });
  }

  function parsePathAndGetHandler(req) {
    return new Promise(function(resolve, reject) {
      const u = url.parse(req.url, true);
      debug('the url info', u);
      debug('the http method', req.method);
      for (const route of ROUTES) {
        if (route.regex.test(u.path)) {
          const safeMethod = req.method.toUpperCase();
          if (route.methods.some((m) => m === safeMethod)) {
            return resolve(handler(route.handler));
          }
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
        debug('The main response handler returned a controller call with:');
        debug(code, body);
        debug('Have the headers been sent?', res.headersSent);
        if (res.headersSent || (!code && !body) || req.method === 'GET') {
          debug('If yes, OR no code and no body OR it was a GET to download file, return.');
          return resolve();
        }
        if (!body || Object.keys(body).length === 0) {
          debug('If no body, just set status and return response.');
          res.statusCode = code;
          res.end();
          return resolve();
        }
        debug('Else write headers, stringify body, and send.');
        res.writeHead(code, {'content-type': 'application/json'});
        res.write(JSON.stringify(body));
        res.end();
        return resolve();
      } catch (err) {
        debug('Error caught during parsing/controller functions.');
        console.log('\n\nERROR\n\n', err);
        res.writeHead(err.code, {'content-type': 'application/json'});
        res.write(err);
        res.end();
        return resolve();
      }
    });
  }

  async function updateJobState(req, res) {
    debug('update job state handler reached.');
    const body = await readRequestBody(req);
    debug('The parsed request body is:', body);
    if (!body.state ||
      (body.state !== 'COMPLETE' &&
        body.state !== 'FAILED' &&
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
    debug('report job metadata handler reached.');
    await markEvent('reportMetadata', true);
    const body = await readRequestBody(req);
    debug('The parsed request body is:', body);
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

  async function getTaskJSON(req, res) {
    debug('get task json handler reached.');
    await markEvent('getTaskJSON', true);
    const u = await checkQuery(req, res, 'task');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['task'];
    return await createAndPipeReadStream(u, res);
  }

  async function getInputFile(req, res) {
    debug('get input file handler reached.');
    const u = await checkQuery(req, res, 'inputs');
    u.query.path = u.query['inputs'];
    if (req.method === 'HEAD') {
      const filename = getQueryFilename(u.query.path);
      debug('The proposed filename for header in HEAD request:', filename);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return {
        code: 200,
        body: {},
      };
    }
    await markEvent('getInputFile', true);
    if (u.code && u.code === 404) {
      return u;
    }
    return await createAndPipeReadStream(u, res);
  }

  async function writeOutput(req, res) {
    debug('write output handler reached.');
    await markEvent('writeOutput', true);
    const u = await checkQuery(req, res, 'output');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['output'];
    return await createAndPipeWriteStream(u, req, res);
  }

  async function writeLogfile(req, res) {
    debug('write log file handler reached.');
    await markEvent('writeLogfile', true);
    await markEvent('numLogfileWrites', eventList['numLogfileWrites'] + 1);
    const u = await checkQuery(req, res, 'logfile');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['logfile'];
    return await createAndPipeWriteStream(u, req, res);
  }

  async function writeStatus(req, res) {
    debug('write status handler reached.');
    await markEvent('numStatusWrites', eventList.numStatusWrites + 1);
    await markEvent('writeStatus', true);
    const u = await checkQuery(req, res, 'status');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['status'];
    return await createAndPipeWriteStream(u, req, res);
  }

  async function handleHeadReq(req, res) {
    return {
      code: 200,
      body: {},
    };
  }

  function readRequestBody(req) {
    debug('Reading request body.');
    return new Promise(function(resolve, reject) {
      req.setEncoding('utf8');
      var body = '';
      req.on('data', (data) => {
        body += data;
      });
      req.on('end', () => {
        debug('Raw body data', body);
        if (req.headers['content-type'] === 'application/json') {
          return resolve(JSON.parse(body));
        } else { // assume application/x-www-form-urlencoded
          return parseUrlEncodedBody(body)
            .then(resolve);
        }
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
      debug('The proposed filename for header:', filename);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.on('finish', () => {
        debug('The response stream completed.');
        debug('The response object', res);
        debug('The response headers', res.getHeaders());
      });
      rs.pipe(res);
      return resolve({code: 200});
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

  function parseUrlEncodedBody(raw) {
    return new Promise(function(resolve, reject) {
      var bodyShell = {};
      const fields = raw.split('&');
      debug('Split body fields', fields);
      for (const field of fields) {
        debug('Next field', field);
        const parts = field.split('=');
        bodyShell[parts[0]] = parts[1];
      }
      debug('The constructed body', bodyShell);
      return resolve(bodyShell);
    });
  }

  function generateOutputReport() {
    return new Promise(function(resolve, reject) {
      console.log('\n----- Test report -----\n');
      reportAssertion('Check for task JSON retrieval.',
        () => eventList.getTaskJSON,
        'Task JSON not retrieved.',
        'Use SDK function voxt.TaskManager.from_url() to retrieve the task JSON.');
      reportAssertion('Check for posting RUNNING state.',
        () => eventList.running,
        'RUNNING state not posted.',
        'Use SDK function task_manager.start() to post the state. Must be ' +
        'done PRIOR to running custom analytic logic!');
      reportAssertion('Check for input file retrieval.',
        () => eventList.getInputFile,
        'Input not retrieved.',
        'Use SDK function task_manager.download_inputs() to retrieve input file(s).');
      reportAssertion('Check for job metadata report.',
        () => eventList.reportMetadata,
        'Job metadata not reported.',
        'Use SDK function task_manger.post_job_metadata() to report job metadata. ' +
        'Failure to report job metadata violates terms of service agreement.');
      reportAssertion('Check for write of status JSON file.',
        () => eventList.writeStatus && eventList.numStatusWrites > 0,
        'Status file not written.',
        'Use SDK function task_manager.publish_status() to write status JSON file.');
      reportAssertion('Check for write of logfile.',
        () => eventList.writeLogfile && eventList.numLogfileWrites > 0,
        'Logfile not written.',
        'Use SDK function task_manager.complete() or task_manager.fail_gracefully() to write the logfile.');
      reportAssertion('Check for only one of COMPLETE or FAILED state updates.',
        () => !(eventList.complete && eventList.failed),
        'Both COMPLETE and FAILED states written.',
        'Only one of COMPLETE or FAILED should be written. This ' +
        'suggests either an analytic error or invalid use of the SDK.');
      if (eventList.failed) {
        reportAssertion('Check that if failed, failure type provided.',
          () => (eventList.failureType !== null && typeof eventList.failureType === 'string'),
          'Valid failure type not provided.',
          'Use SDK function task_manager.fail_gracefully() to write failure state and use ' +
          'one of voxt.TaskFailureType ENUM as the failure type.');
      }
      reportAssertion('Check for output write state.',
        () => eventList.writeOutput,
        'Output file not written.',
        'Use SDK function task.upload_output() to write the output file.');
      console.log('\n----- End of report -----\n');
    });

    function reportAssertion(checkMessage, pred, errMessage, instructionCall) {
      try {
        console.log(checkMessage);
        assert.ok(pred(), errMessage);
        console.log('\x1b[32mCheck passed!\x1b[39m\n');
      } catch (error) {
        console.error('\x1b[31mCheck failed.\x1b[39m\n');
        console.error(instructionCall);
      }
    }
  }
}());

module.exports = server;
