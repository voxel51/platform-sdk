/**
 * Local testing server index.
 *
 * Copyright 2017-2019, Voxel51, Inc.
 * voxel51.com
 *
 * David Hodgson, david@voxel51.com
 */
'use strict';

const debug = require('debug')('sdk-integration');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const uuid4 = require('uuid/v4');

const schema = require('./schema.js');
const server = require('./server.js');

(async function main() {
  // declare global consts
  var TEST_DOCKER_IMAGE,
    GIVEN_ANALYTIC_FILE,
    GIVEN_INPUTS,
    COMPUTE_TYPE,
    GIVEN_PARAMETERS;
  const JOB_ID = uuid4();
  const config = require('./config.js');

  try {
    debug('Beginning setup of image test.');
    debug('Validating required environment variables.');
    const cliArgs = await parseCLIArgs();
    debug('Parsed command-line arguments are:', cliArgs);

    if (cliArgs['inputs']) {
      GIVEN_INPUTS = cliArgs['inputs'].split(',');
    } else {
      GIVEN_INPUTS = cliArgs['input-file'];
    }
    if (!GIVEN_INPUTS) {
      throw new Error(`A valid absolute path to the desired input test ` +
        `file OR a comma-separated list of absolute paths ` +
        `must be set via --inputs or --input-file command line arguments.`);
    }

    TEST_DOCKER_IMAGE = cliArgs['analytic-image'];
    if (!TEST_DOCKER_IMAGE) {
      throw new Error(`A valid, local docker image must be set via ` +
        `--analytic-image command line argument.`);
    }

    GIVEN_ANALYTIC_FILE = cliArgs['analytic-json'];
    if (!GIVEN_ANALYTIC_FILE) {
      throw new Error(`A valid absolute path to the desired analytic JSON ` +
        `test file must be set via --analytic-json command line argument.`);
    }

    GIVEN_PARAMETERS = cliArgs['params'] || {};

    COMPUTE_TYPE = cliArgs['compute-type'] || 'cpu';

    debug('Environment variable validation complete.');

    const parsedInputs = await parseInputs(GIVEN_INPUTS);
    const parsedParameters = await parseParameters(GIVEN_PARAMETERS);
    const analyticFields = await parseAndVerifyAnalyticJSON();
    const {taskURL, task} = await generateTaskJSON(analyticFields,
      parsedInputs, parsedParameters);
    debug('Test setup complete.');

    debug('Spinning up mock server.');
    const socket = await server.spinup(task);

    const dockerCmd = await generateDockerCommand(taskURL, task.logfile['signed-url']);
    console.log('\n\nRun the following docker command to test your image now:\n\n',
      dockerCmd, '\n\nCleanup generated files via npm run clean or ' +
      'yarn run clean.\n\n');

    process.on('SIGTERM', shutdown(socket));
    process.on('SIGINT', shutdown(socket));
    process.on('unhandledRejection', (reason, p) => {
      console.error('Unhandled rejection at Promise: ', p, 'reason:', reason);
      console.error(reason.stack);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  function generateDockerCommand(taskURL, logfileURL) {
    return new Promise(function(resolve, reject) {
      debug('Generating the docker run command.');
      var cmd = 'docker run ';
      if (COMPUTE_TYPE === 'gpu') {
        cmd += '--runtime=nvidia ';
      }
      cmd += `--name ${JOB_ID} ` +
        `-e TASK_DESCRIPTION="${taskURL}" ` +
        `-e API_TOKEN="${config.API_TOKEN}" ` +
        `-e OS="${process.platform}" ` +
        `-e LOGFILE_SIGNED_URL="${logfileURL}" ` +
        `-e API_BASE_URL="${config.API_BASE_URL}" ` +
        `--network="host" ${TEST_DOCKER_IMAGE}; ` +
        `echo -e "Now close the server (Ctrl-C) to finish the ` +
        `test and retrive your results!"`;
      debug('Docker command generation complete.');
      return resolve(cmd);
    });
  }

  async function generateTaskJSON(analyticFields, inputs, parameters={}) {
    debug('Generating task JSON file using analytic fields:', analyticFields);
    const task = {
      analytic: analyticFields.name,
      version: analyticFields.version,
      job_id: JOB_ID,
      inputs,
      parameters,
      output: {
        'signed-url': await generateSignedUrl(analyticFields.output, 'output'),
      },
      status: {
        'signed-url': await generateSignedUrl('status.json', 'status'),
      },
      logfile: {
        'signed-url': await generateSignedUrl('logfile.log', 'logfile'),
      },
    };
    const taskJSON = await safeJSONStringify(task);
    debug('Stringified task JSON:', taskJSON);
    await writeFile('task.json', taskJSON);
    debug('Generating signed url for task JSON file.');
    const taskURL = await generateSignedUrl('task.json', 'task');
    debug('Task JSON generation complete.');
    return {taskURL, task};
  }

  function generateSignedUrl(filepath, type) {
    return Promise.resolve(`http://127.0.0.1:${config.PORT}/v1` +
      `/local/file?${type}=${path.join(config.STORAGE_BASE_DIR, filepath)}`);
  }

  async function parseAndVerifyAnalyticJSON() {
    debug('Starting reading and parsing of analytic JSON file.');
    const analyticFilename = path.basename(GIVEN_ANALYTIC_FILE);
    debug('Analytic filename read as:', analyticFilename);
    const analyticFilepath = path.join(config.STORAGE_BASE_DIR, analyticFilename);
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
      const file = path.join(config.STORAGE_BASE_DIR, filepath);
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
      const file = path.join(config.STORAGE_BASE_DIR, filepath);
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

  function shutdown(socket) {
    return function() {
      console.log('Exiting. Wrapping up remaining connections...');
      socket.close(() => {
        process.exit(0);
      });
    };
  }

  function parseCLIArgs() {
    return new Promise(function(resolve, reject) {
      const args = process.argv.slice(2);
      var argsObj = {};
      args.forEach((arg) => {
        const [key, value] = arg.split('=');
        argsObj[key.slice(2)] = value;
      });
      return resolve(argsObj);
    });
  }

  async function parseInputs(inputs) {
    var parsedInputs = {};
    if (Array.isArray(inputs)) {
      for (const inp of inputs) {
        const [key, path] = inputs.split(':');
        const inputFilename = await copyInputToStorage(path);
        parsedInputs[key] = {'signed-url': await generateSignedUrl(inputFilename, 'inputs')};
      }
    } else {
      // single input
      const [key, path] = inputs.split(':');
      const inputFilename = await copyInputToStorage(path);
      parsedInputs[key] = {'signed-url': await generateSignedUrl(inputFilename, 'inputs')};
    }
  }

  async function copyInputToStorage(fullPath) {
    const inputFilename = path.basename(fullPath);
    const inputFilepath = path.join(config.STORAGE_BASE_DIR, inputFilename);
    debug(`Copying input file to new location, ${inputFilepath}.`);
    await pExec(`cp ${path} ${inputFilepath}`);
    return inputFilename;
  }

  function parseParameters(params) {
    return new Promise(function(resolve, reject) {
      try {
        const parsedParameters = JSON.parse(params);
        return resolve(parsedParameters);
      } catch (error) {
        return reject(error);
      }
    });
  }
}());
