'use strict';

const debug = require('debug')('sdk-integration');
const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const uuid4 = require('uuid/v4');

(async function main() {
  // declare global consts
  var STORAGE_BASE_DIR,
    GIVEN_INPUT_FILE,
    TEST_PORT,
    API_TOKEN,
    TEST_DOCKER_IMAGE,
    JOB_ID;

  try {
    GIVEN_INPUT_FILE = process.env.TEST_INPUT_FILE;
    if (!GIVEN_INPUT_FILE) {
      throw new Error(`A valid absolute path to the desired input test ` +
        `file must be set via TEST_INPUT_FILE environment variable.`);
    }

    TEST_DOCKER_IMAGE = process.env.TEST_DOCKER_IMAGE;
    if (!TEST_DOCKER_IMAGE) {
      throw new Error(`A valid, local docker image must be set via ` +
        `TEST_DOCKER_IMAGE environment variable.`);
    }

    STORAGE_BASE_DIR = path.join(__dirname, './storage');
    API_TOKEN = 'my-very-special-key12345';
    TEST_PORT = process.env.TEST_PORT || 5656;
    JOB_ID = uuid4();
    const taskURL = await generateTaskJSON();
    const dockerCmd = await generateDockerCommand(taskURL);
    console.log('Run the following docker command to test your image now:',
      dockerCmd);
    process.exit(0);

    // requests to serve
    // download task json request
    // post job state(s)
    // post started
    // download input(s)
    // accept job metadata
    // post running
    // post output(s)
    // post complete
    // post fail/log at any point
  } catch (err) {
    debug('Error. Exiting process.', err);
    process.exit(1);
  }

  function generateDockerCommand(taskURL) {
    return new Promise(function(resolve, reject) {
      var cmd = 'docker run ';
      if (process.env.TEST_USE_GPU) {
        cmd += '--runtime=nvidia ';
      }
      cmd += `--name ${JOB_ID} ` +
        `--detach ` +
        `-e TASK_DESCRIPTION="${taskURL}" ` +
        `-e ENV="LOCAL" ` +
        `-e API_TOKEN="${API_TOKEN}" ` +
        `-e OS="${process.platform}" ` +
        `--network="host" ${TEST_DOCKER_IMAGE}`;
      return resolve(cmd);
    });
  }

  async function generateTaskJSON(params={}) {
    // TODO get analytic, version, output name from analytic json?
    // TODO add verification of analytic json file?
    const inputFilename = path.basename(GIVEN_INPUT_FILE);
    const inputFilePath = path.join(STORAGE_BASE_DIR, inputFilename);
    await pExec(`cp ${GIVEN_INPUT_FILE} ${inputFilePath}`);
    const task = {
      analytic: 'foobar',
      version: '1.0.0',
      job_id: JOB_ID,
      inputs: {
        video: {
          signed_url: await generateSignedUrl(inputFilename),
        },
      },
      parameters: params,
      // TODO get output filename/dir from analytic json
      output: await generateSignedUrl('output'),
      status: await generateSignedUrl('status.json'),
      logfile: await generateSignedUrl('logfile.log'),
    };
    const taskJSON = await safeJSONStringify(task);
    await writeFile('task.json', taskJSON);
    return await generateSignedUrl('task.json');
  }

  function generateSignedUrl(filepath) {
    return Promise.resolve(path.join(STORAGE_BASE_DIR, filepath));
  }

  function safeJSONParse(input) {
    return new Promise(function(resolve, reject) {
      try {
        const data = JSON.parse(input);
        return resolve(data);
      } catch (err) {
        return reject(err);
      }
    });
  }

  function safeJSONStringify(input) {
    return new Promise(function(resolve, reject) {
      try {
        const obj = JSON.stringify(input);
        return resolve(obj);
      } catch (err) {
        return reject(err);
      }
    });
  }

  function writeFile(filepath, data) {
    return new Promise(function(resolve, reject) {
      const file = path.join(STORAGE_BASE_DIR, filepath);
      fs.writeFile(file, data, (err) => {
        if (err) {
          return reject(err);
        }
        return resolve();
      });
    });
  }

  function pExec(cmd) {
    return new Promise(function(resolve, reject) {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          return reject(err);
        }
        return resolve({stdout, stderr});
      });
    });
  }
}());
