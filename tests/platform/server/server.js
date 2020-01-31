/**
 * Local testing server.
 *
 * Copyright 2017-2019, Voxel51, Inc.
 * voxel51.com
 */
'use strict';

const debug = require('debug')('server');
const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const Busboy = require('busboy');
const R = require('ramda');
const uuid4 = require('uuid/v4');

const config = require('./config.js');

const server = (function makeServer() {
  var TASK = {};

  var eventList = {
    getTaskJSON: false,
    getInputURL: false,
    getStatusURL: false,
    getLogfileURL: false,
    getOutputURL: false,
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
      name: 'job output data',
      regex: new RegExp('\\/v1\\/jobs\\/.*\\/data'),
      methods: ['POST'],
      handler: uploadJobData,
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
      name: 'get signed url',
      regex: new RegExp('\\/v1\\/jobs\\/.*\\/url/.*'),
      methods: ['GET'],
      handler: getSignedUrl,
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

  const SIGNED_URL_TO_TASK_KEY = {
    data: 'inputs',
    log: 'logfile',
  };

  const SIGNED_URL_TO_EVENT = {
    data: 'getInputURL',
    status: 'getStatusURL',
    output: 'getOutputURL',
    log: 'getLogfileURL',
  };

  return Object.freeze({spinup, recordEvent});

  function spinup(task, port=config.PORT) {
    return new Promise(function(resolve, reject) {
      TASK = task;
      const server = http.createServer(async (req, res) => {
        const resHandler = await parsePathAndGetHandler(req, res)
        if (!resHandler) {
          debug(
            'No response handler found! Occured for path:', req.url,
            req.method);
          res.writeHead(404, {'content-type': 'application/json'});
          res.end(JSON.stringify({
            error: {
              code: 404,
              message: 'Not Found',
            },
          }));
          return;
        }
        debug('Response handler found. Calling controller.');
        return await resHandler(req, res);
      });
      const socket = server.listen(port, 'localhost', () => {
        console.log(`Server is listening on port ${port}`);
      });
      socket.on('close', async () => {
        await generateTestReport();
      });
      return resolve(socket);
    });
  }

  function parsePathAndGetHandler(req) {
    return new Promise(function(resolve, reject) {
      const u = url.parse(req.url, true);
      debug('The url info', u);
      debug('The http method', req.method);
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

  function recordEvent(eventName, value) {
    eventList[eventName] = value;
  }

  function resHandler(contFn, req, res) {
    return new Promise(async function(resolve, reject) {
      try {
        const {code, body} = await contFn(req, res);
        debug('The main response handler returned a controller call with:');
        debug(code, body);
        debug('Have the headers been sent?', res.headersSent);
        if (res.headersSent || (!code && !body) ||
            (req.method === 'GET' && req.url.includes('/local/file'))) {
          debug(
            'If yes, OR no code and no body OR it was a GET to download ' +
            'file, return.');
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
        console.error(err);
        res.writeHead(err.code, {'content-type': 'application/json'});
        res.write(err);
        res.end();
        return resolve();
      }
    });
  }

  async function updateJobState(req, res) {
    debug('Updating job state.');
    const body = await readRequestBody(req);
    debug('The parsed request body is:', body);
    if (!body.state ||
      (body.state !== 'COMPLETE' &&
        body.state !== 'FAILED' &&
        body.state !== 'RUNNING')) {
      return {
        code: 400,
        body: {
          error: {
            code: 400,
            message: 'Invalid state provided.',
          },
        },
      };
    }
    if (body.state === 'RUNNING') {
      recordEvent('running', true);
    } else if (body.state === 'COMPLETE') {
      recordEvent('complete', true);
    } else {
      recordEvent('failed', true);
      if (!body.failure_type ||
        typeof body.failure_type !== 'string') {
        return {
          code: 400,
          body: {
            error: {
              code: 400,
              message: '`failure_type` must be provided.',
            },
          },
        };
      }
      recordEvent('failureType', body.failure_type);
    }
    return {
      code: 200,
      body: {state: body.state},
    };
  }

  async function reportJobMetadata(req, res) {
    debug('Reporting job metadata.');
    recordEvent('reportMetadata', true);
    const body = await readRequestBody(req);
    debug('The parsed request body is:', body);
    const fields = ['frame_count', 'size_bytes', 'duration_seconds'];
    if (!fields.every((f) => existsAndNumber(body[f]))) {
      return {
        code: 400,
        body: {
          error: {
            code: 400,
            message: 'All three job metadata fields should be valid numbers.',
          },
        },
      };
    }
    return {
      code: 204,
      body: {},
    };
  }

  async function uploadJobData(req, res) {
    debug('Uploading job output as data.');
    recordEvent('uploadData', true);
    const data_id = uuid4();
    saveMultipartUpload(req, 'out');
    return {
      code: 200,
      body: {
        data: {
          data_id,
        },
      },
    };
  }

  async function getTaskJSON(req, res) {
    debug('Getting task JSON.');
    recordEvent('getTaskJSON', true);
    const u = await checkQuery(req, res, 'task');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['task'];
    return await createAndPipeReadStream(u, res);
  }

  async function getInputFile(req, res) {
    debug('Getting input file.');
    const u = await checkQuery(req, res, 'inputs');
    u.query.path = u.query['inputs'];
    if (req.method === 'HEAD') {
      const filename = getQueryFilename(u.query.path);
      debug('The proposed filename for header in HEAD request:', filename);
      res.setHeader(
        'Content-Disposition', `attachment; filename="${filename}"`);
      return {
        code: 200,
        body: {},
      };
    }
    recordEvent('getInputFile', true);
    if (u.code && u.code === 404) {
      return u;
    }
    return await createAndPipeReadStream(u, res);
  }

  function getSignedUrl(req, res) {
    const key = req.url.split('/').pop();
    recordEvent(SIGNED_URL_TO_EVENT[key], true);
    return {
      code: 200,
      body: TASK[SIGNED_URL_TO_TASK_KEY[key] || key],
    };
  }

  async function writeOutput(req, res) {
    debug('Writing task output.');
    recordEvent('writeOutput', true);
    const u = await checkQuery(req, res, 'output');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['output'];
    return await createAndPipeWriteStream(u, req, res);
  }

  async function writeLogfile(req, res) {
    debug('Writing logfile.');
    recordEvent('writeLogfile', true);
    recordEvent('numLogfileWrites', eventList['numLogfileWrites'] + 1);
    const u = await checkQuery(req, res, 'logfile');
    if (u.code && u.code === 404) {
      return u;
    }
    u.query.path = u.query['logfile'];
    return await createAndPipeWriteStream(u, req, res);
  }

  async function writeStatus(req, res) {
    debug('Writing task status.');
    recordEvent('numStatusWrites', eventList.numStatusWrites + 1);
    recordEvent('writeStatus', true);
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
        } else {
          // Assume application/x-www-form-urlencoded
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
          mesage: 'Not found. Invalid signed URL format.',
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
      res.setHeader(
        'Content-Disposition', `attachment; filename="${filename}"`);
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

  function saveMultipartUpload(req, outDir) {
    var busboy = new Busboy({
      headers: req.headers,
    });
    busboy.on('file', function(field, file, filename) {
      const filePath = path.join(outDir, filename);
      file.pipe(fs.createWriteStream(filePath));
    });
    return req.pipe(busboy);
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

  function generateTestReport() {
    var reportStr = '';
    var expectedTestPasses = 0;
    var testsPassed = 0;

    return new Promise(async function(resolve, reject) {
      log('**************** Test report ****************');
      log(Date(Date.now()).toLocaleString());
      log('');

      reportTestResult(
        'Checking that task JSON was downloaded...',
        eventList.getTaskJSON,
        'Task JSON was not downloaded',
        'Build a task manager via `voxt.TaskManager.from_url()`');

      reportTestResult(
        'Checking that RUNNING state was posted...',
        eventList.running,
        'RUNNING state was not posted',
        'Use `TaskManager.start()` to mark the task as running.');

      reportTestResult(
        'Checking that the input URLs were requested...',
        eventList.getOutputURL,
        'The input signed URLs were not requested',
        'Use TaskManager.get_job_data_urls() to retrieve these signed URLs');

      reportTestResult(
        'Checking that input files were downloaded...',
        eventList.getInputFile,
        'Inputs were not downloaded',
        'Use `TaskManager.download_inputs()` to download inputs');

      reportTestResult(
        'Checking that job metadata was reported...',
        eventList.reportMetadata,
        'Job metadata was not reported',
        'Use `TaskManager.post_job_metadata()` to report job metadata');

      reportTestResult(
        'Checking that the status file URL was requested...',
        eventList.getOutputURL,
        'The status file signed URL was not requested',
        'Use TaskManager.get_job_status_url() to retrieve this signed URL');

      reportTestResult(
        'Checking that task status file was published at least once...',
        eventList.writeStatus && eventList.numStatusWrites > 0,
        'Task status file was not published',
        'Use `TaskManager.publish_status()` to publish task status');

      reportTestResult(
        'Checking that the logfile file URL was requested...',
        eventList.getOutputURL,
        'The logfile file signed URL was not requested',
        'Use TaskManager.get_job_log_url() to retrieve this signed URL');

      reportTestResult(
        'Checking that logfile was posted...',
        eventList.writeLogfile && eventList.numLogfileWrites > 0,
        'Logfile was not posted',
        'Use `TaskManager.complete()` or `TaskManager.fail_gracefully()`' +
          'to finalize the task');

      reportTestResult(
        'Checking that COMPLETE state was posted...',
        eventList.complete,
        'COMPLETE state was not posted',
        'Use `TaskManager.complete()` to complete a successful task');

      if (eventList.failed) {
        reportTestResult(
          'Checking that failure type is provided for failed jobs...',
          (eventList.failureType !== null &&
            typeof eventList.failureType === 'string'),
          'Failure type was not provided',
          'Use `TaskManager.fail_gracefully()` to report failure and use ' +
            '`TaskFailureType` to specify failure type');
      }

      // @todo analytics do not necessarily need to post an output; they may
      // only post outputs as data
      if (!eventList.uploadData) {
        reportTestResult(
          'Checking that the output URL was requested...',
          eventList.getOutputURL,
          'The output signed URL was not requested',
          'Use TaskManager.get_job_output_url() to retrieve this signed URL');
      }

      reportTestResult(
        'Checking that output was uploaded...',
        eventList.writeOutput || eventList.uploadData,
        'No output files were posted',
        'Use `TaskManager.upload_output()` or ' +
        '`TaskManager.upload_output_as_data()` to upload task output(s)');

      let success = testsPassed === expectedTestPasses;
      log(
        `${testsPassed}/${expectedTestPasses} tests passed (` +
        `${100 * testsPassed / expectedTestPasses}%)`, !success, true);
      log('*********************************************');

      // Write test report
      fs.writeFileSync(config.TEST_REPORT_PATH, reportStr);
      console.log(`\nTest report written to ${config.TEST_REPORT_PATH}\n`);

      console.log(`To cleanup, run:\n\ntest-platform --clean\n`);

      return resolve();
    });

    function reportTestResult(testMsg, success, errorMsg, helpMsg) {
      log(testMsg);
      expectedTestPasses += 1;

      if (success) {
        log('[x] Test passed', false, true);
        testsPassed += 1;
      } else {
        log(errorMsg, true);
        log('[ ] Test failed', true, true);
        log('Tip: ' + helpMsg);
      }
      log('');
    }

    function log(msg, isError=false, color=false) {
      // Log to report
      reportStr += msg + '\n';

      // Log to console
      if (isError) {
        if (color) {
          msg = '\x1b[31m' + msg + '\x1b[39m';
        }
        console.error(msg);
      } else {
        if (color) {
          msg = '\x1b[32m' + msg + '\x1b[39m';
        }
        console.log(msg);
      }
    }
  }
}());

module.exports = server;
