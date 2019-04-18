'use strict';

const debug = require('debug')('sdk-integration');
const { exec } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const uuid4 = require('uuid/v4');

const schema = require('./schema.js');

(async function main() {
  // declare global consts
  var STORAGE_BASE_DIR,
    GIVEN_INPUT_FILE,
    TEST_PORT,
    API_TOKEN,
    TEST_DOCKER_IMAGE,
    GIVEN_ANALYTIC_FILE,
    JOB_ID;

  try {
    debug('Beginning setup of image test.');
    debug('Validating required environment variables.');
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

    GIVEN_ANALYTIC_FILE = process.env.TEST_ANALYTIC_FILE;
    if (!GIVEN_ANALYTIC_FILE) {
      throw new Error(`A valid absolute path to the desired analytic JSON ` +
        `test file must be set via TEST_ANALYTIC_FILE environment variable.`);
    }
    debug('Environment variable validation complete.');

    STORAGE_BASE_DIR = path.join(__dirname, './storage');
    API_TOKEN = 'my-very-special-key12345';
    TEST_PORT = process.env.TEST_PORT || 5656;
    JOB_ID = uuid4();
    const analyticFields = await parseAndVerifyAnalyticJSON();
    // TODO add support for parameters?
    const taskURL = await generateTaskJSON(analyticFields);
    const dockerCmd = await generateDockerCommand(taskURL);
    console.log('Run the following docker command to test your image now:\n',
      dockerCmd, '\nCleanup generated files via npm run clean or ' +
      'yarn run clean.');
    debug('Test setup complete.');
    debug('Spinning up mock server.');
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
    console.error(err);
    process.exit(1);
  }

  function generateDockerCommand(taskURL) {
    return new Promise(function(resolve, reject) {
      debug('Generating the docker run command.');
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
      debug('Docker command generation complete.');
      return resolve(cmd);
    });
  }

  async function generateTaskJSON(analyticFields, params={}) {
    debug('Generating task JSON file using analytic fields:', analyticFields);
    const inputFilename = path.basename(GIVEN_INPUT_FILE);
    const inputFilepath = path.join(STORAGE_BASE_DIR, inputFilename);
    debug(`Copying analytic file to new location, ${inputFilepath}.`);
    await pExec(`cp ${GIVEN_INPUT_FILE} ${inputFilepath}`);
    const task = {
      analytic: analyticFields.name,
      version: analyticFields.version,
      job_id: JOB_ID,
      inputs: {
        video: {
          signed_url: await generateSignedUrl(inputFilename),
        },
      },
      parameters: params,
      output: await generateSignedUrl(analyticFields.output),
      status: await generateSignedUrl('status.json'),
      logfile: await generateSignedUrl('logfile.log'),
    };
    const taskJSON = await safeJSONStringify(task);
    debug('Stringified task JSON:', taskJSON);
    await writeFile('task.json', taskJSON);
    debug('Generating signed url for task JSON file.');
    const taskURL = await generateSignedUrl('task.json');
    debug('Task JSON generation complete.');
    return taskURL;
  }

  function generateSignedUrl(filepath) {
    return Promise.resolve(path.join(STORAGE_BASE_DIR, filepath));
  }

  async function parseAndVerifyAnalyticJSON() {
    debug('Starting reading and parsing of analytic JSON file.');
    const analyticFilename = path.basename(GIVEN_ANALYTIC_FILE);
    debug('Analytic filename read as:', analyticFilename);
    const analyticFilepath = path.join(STORAGE_BASE_DIR, analyticFilename);
    debug('Analytic filepath created as:', analyticFilepath);
    await pExec(`cp ${GIVEN_ANALYTIC_FILE} ${analyticFilepath}`);
    debug('Analytic file copied to new location.');
    const analytic = await readFile(analyticFilename);
    debug('Analytic file read and parsed successfully. Beginning validation.');
    await validateAnalyticSchema(analytic);
    debug('Validation complete. Parsing required fields for test setup.');
    const analyticFields = await parseNeededAnalyticFields(analytic);
    debug('Required fields parsed.');
    return analyticFields;
  }

  async function validateAnalyticSchema(a) {
    debug('Validating the overall analytic schema.');
    await schema.validate.structure(a);
    debug('Validating each input field schema.');
    await Promise.all(a.inputs.map(schema.validate.input));
    debug('Validating each parameter field schema.');
    await Promise.all(a.parameters.map(schema.validate.parameter));
    debug('Validating each output field schema.');
    await Promise.all(a.outputs.map(schema.validate.output));
    debug('Validation of analytic JSON file complete.');
  }

  function parseNeededAnalyticFields(a) {
    return new Promise(function(resolve, reject) {
      var fields = {
        name: a.info.name,
        version: a.info.version,
        supportsCPU: a.info.supports_cpu,
        supportsGPU: a.info.supports_gpu,
      };
      if (a.zip_outputs) {
        fields.output = 'output.zip';
      } else {
        const nonDataOutputs = a.outputs.filter((o) => !o.post_as_data);
        if (nonDataOutputs.length > 1) {
          debug('The platform assumes one output file only, so if multiple ' +
            'files are desired, they must be zipped into a single file.');
          throw new Error(`If zip_outputs is false, only one output ` +
            `can be NOT posted as data.`);
        } else if (nonDataOutputs.length === 0) {
          debug('No outputs are assigned to this analytic');
          fields.output = 'output';
        } else {
          debug('The first possible non-data output is used by default');
          fields.output = nonDataOutputs[0].filename;
        }
      }
      return resolve(fields);
    });
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

  function readFile(filepath) {
    return new Promise(function(resolve, reject) {
      const file = path.join(STORAGE_BASE_DIR, filepath);
      fs.readFile(file, async (err, data) => {
        if (err) {
          return reject(err);
        }
        const obj = await safeJSONParse(data);
        return resolve(obj);
      });
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
