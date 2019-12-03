/**
 * Local testing server entrypoint.
 *
 * Copyright 2017-2019, Voxel51, Inc.
 * voxel51.com
 */
'use strict';

const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const debug = require('debug')('server');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const uuid4 = require('uuid/v4');

const clean = require('./clean.js');
const config = require('./config.js');
const schema = require('./schema.js');
const server = require('./server.js');

const optionDefinitions = [
  {
    name: 'analytic-image',
    type: String,
    description: 'The name of the analytic Docker image to run. This flag ' +
      'is required.',
    typeLabel: '<image-name>',
  },
  {
    name: 'analytic-json',
    type: String,
    description: 'The path to the analytic JSON file to use. This flag ' +
      'is required.',
    typeLabel: '<analytic-json>',
  },
  {
    name: 'inputs',
    alias: 'i',
    type: String,
    multiple: true,
    description: 'Name=path pair(s) specifying the inputs to use. Can be ' +
      'repeated multiple times if necessary. At least one input is required.',
    typeLabel: '<name>=<path>',
  },
  {
    name: 'parameters',
    alias: 'p',
    type: String,
    multiple: true,
    description: 'Name=value pair(s) specifying parameter settings to use. ' +
      '`value` must be JSON parsable. Can be repeated multiple times if ' +
      ' necessary.',
    typeLabel: '<name>=<value>',
  },
  {
    name: 'compute-type',
    type: String,
    description: 'The compute type to use. Your Docker image must support ' +
      'this compute type. If GPU execution is requested, `--runtime=nvidia` ' +
      'is added to the `docker run` command; it is assumed that your ' +
      'machine and Docker installation are configured to support this.',
    typeLabel: '<cpu|gpu>',
  },
  {
    name: 'clean',
    alias: 'c',
    type: Boolean,
    description: 'Cleanup generated files from a previous test run from the ' +
      'current working directory.'
  },
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Displays this usage guide.'
  },
];

const usageDefinition = [
  {
    content: 'Voxel51 Platform Analytic Local Testing Server'
  },
  {
    header: 'Example usage',
    content: 'test-platform \\\n' +
      '--analytic-image <image-name> \\\n' +
      '--analytic-json <analytic-json> \\\n' +
      '--inputs <name>=<path> \\\n' +
      '--compute-type <cpu|gpu>'
  },
  {
    header: 'Options',
    optionList: optionDefinitions
  }
];

const JOB_ID = uuid4();

(async function main() {
  var DOCKER_IMAGE_NAME;
  var ANALYTIC_JSON_PATH;
  var INPUTS;
  var PARAMETERS;
  var COMPUTE_TYPE;

  try {
    debug('Parsing command-line args.');
    const options = commandLineArgs(optionDefinitions);

    // Handle help flag
    if (options.help) {
      debug('Displaying help.');
      const usage = commandLineUsage(usageDefinition);
      console.log(usage);
      process.exit(0);
    }

    // Handle clean flag
    if (options.clean) {
      debug('Cleaning up after test.');
      clean.cleanup();
      process.exit(0);
    }

    // Make storage directory
    debug(`Making storage directory ${config.STORAGE_BASE_DIR}.`);
    await pExec(`mkdir -p ${config.STORAGE_BASE_DIR}`);

    // Parse Docker image flag
    DOCKER_IMAGE_NAME = options['analytic-image'];
    if (!DOCKER_IMAGE_NAME) {
      throw new Error(
        'The `--analytic-image` flag must be set to provide the name of the ' +
        'local Docker image to test.');
    }

    // Parse analytic JSON flag
    ANALYTIC_JSON_PATH = options['analytic-json'];
    if (!ANALYTIC_JSON_PATH) {
      throw new Error(
        'The `--analytic-json` flag must be set to provide the path to the ' +
        'analytic JSON file for the test.');
    }

    // Parse inputs
    INPUTS = options['inputs'];
    if (!INPUTS) {
      throw new Error(
        'The `--inputs` flag must be set to provide the name(s) and path(s) ' +
        'to the desired test files.');
    }
    var parsedInputs;
    try {
      parsedInputs = await parseInputs(INPUTS);
    } catch (err) {
      console.error(`Unable to parse inputs: ${INPUTS}`);
      console.error(`Expected <name>=<path> pair(s).`);
      throw(err);
    }

    // Parse parameters
    PARAMETERS = options['parameters'] || [];
    var parsedParameters;
    try {
      parsedParameters = parseParameters(PARAMETERS);
    } catch (err) {
      console.error(`Unable to parse parameters: ${PARAMETERS}`);
      console.error(`Expected <name>=<json-value> pair(s).`);
      throw(err);
    }

    // Parse compute type
    COMPUTE_TYPE = options['compute-type'];

    debug('Command-line args ingested.');

    const analyticFields = await parseAndVerifyAnalyticJSON();
    const {taskURL, task} = await generateTaskJSON(
      analyticFields, parsedInputs, parsedParameters);
    debug('Setup complete.');

    debug('Spinning up server.');
    const socket = await server.spinup(task);

    // Print Docker run instructions
    const dockerCmd = await generateDockerCommand(
      taskURL, task.logfile['signed-url']);
    console.log(
      '\n\nTo run your image, execute the following command in a separate ' +
      'terminal:\n\n' + dockerCmd + '\n\nAfter the image terminates, kill ' +
      'the server via Ctrl-C to generate a test report\n');

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

  async function parseInputs(inputs) {
    let parsedInputs = {};
    for (const namePath of inputs) {
      const [name, path] = namePath.split('=');
      const inputFilename = await copyInputToStorage(path);
      parsedInputs[name] = {
        'signed-url': await generateSignedURL(inputFilename, 'inputs')
      };
    };
    return parsedInputs;
  }

  async function copyInputToStorage(fullPath) {
    const inputFilename = path.basename(fullPath);
    const inputFilepath = path.join(config.STORAGE_BASE_DIR, inputFilename);
    debug(`Copying input ${fullPath} to ${inputFilepath}.`);
    await pExec(`cp ${fullPath} ${inputFilepath}`);
    return inputFilename;
  }

  function parseParameters(parameters) {
    let parsedParameters = {};
    parameters.forEach(function(nameValue) {
      let [name, value] = nameValue.split('=');
      parsedParameters[name] = JSON.parse(value);
    });
    return parsedParameters;
  }

  function generateSignedURL(filepath, type) {
    const localPath = path.join(config.STORAGE_BASE_DIR, filepath);
    return Promise.resolve(
      modifyURLForDocker(
        `${config.API_BASE_URL}/local/file?${type}=${localPath}`
      )
    );
  }

  function modifyURLForDocker(url) {
    // if MacOS and local
    if (process.platform === 'darwin') {
      return url.replace(/127\.0\.0\.1/g, 'docker.for.mac.localhost');
    }
    return url;
  }

  function generateDockerCommand(taskURL, logfileURL) {
    return new Promise(function(resolve, reject) {
      debug('Generating the docker run command.');
      let cmd = 'docker run ';
      if (COMPUTE_TYPE === 'gpu') {
        cmd += '--runtime=nvidia ';
      }
      cmd += `--name ${JOB_ID} ` +
        `-e TASK_DESCRIPTION="${taskURL}" ` +
        `-e API_TOKEN="xxxxxxxxxxxxxxxx" ` +
        `-e LOGFILE_SIGNED_URL="${logfileURL}" ` +
        `-e API_BASE_URL="${modifyURLForDocker(config.API_BASE_URL)}" ` +
        `--network="host" ${DOCKER_IMAGE_NAME}; ` +
        `echo -e "\\nDocker has exited. Kill the server (Ctrl-C) to ` +
        `retrieve your test results\\n"`;
      return resolve(cmd);
    });
  }

  async function generateTaskJSON(analyticFields, inputs, parameters={}) {
    debug('Generating task JSON.');
    const task = {
      analytic: analyticFields.name,
      version: analyticFields.version,
      job_id: JOB_ID,
      inputs,
      parameters,
      output: {
        'signed-url': await generateSignedURL(analyticFields.output, 'output'),
      },
      status: {
        'signed-url': await generateSignedURL('status.json', 'status'),
      },
      logfile: {
        'signed-url': await generateSignedURL('logfile.log', 'logfile'),
      },
    };
    const taskStr = JSON.stringify(task, null, 4);
    debug('Task JSON:', taskStr);

    let taskPath = path.join(config.STORAGE_BASE_DIR, 'task.json');
    debug(`Writing task JSON to ${taskPath}.`);
    fs.writeFileSync(taskPath, taskStr);

    debug('Generating signed URL for task JSON.');
    const taskURL = await generateSignedURL('task.json', 'task');

    return {taskURL, task};
  }

  async function parseAndVerifyAnalyticJSON() {
    debug('Starting reading and parsing of analytic JSON file.');
    const analyticFilename = path.basename(ANALYTIC_JSON_PATH);

    debug('Analytic filename read as:', analyticFilename);
    const analyticFilepath = path.join(
      config.STORAGE_BASE_DIR, analyticFilename);

    debug(`Copying analytic JSON to '${analyticFilepath}'`);
    await pExec(`cp ${ANALYTIC_JSON_PATH} ${analyticFilepath}`);

    debug('Validing analytic JSON schema');
    const analytic = JSON.parse(fs.readFileSync(analyticFilepath, 'utf8'));
    await validateAnalyticSchema(analytic);
    const analyticFields = await extractAnalyticInfo(analytic);

    return analyticFields;
  }

  async function validateAnalyticSchema(a) {
    debug('Validating analytic schema');
    debug('Validating top-level schema.');
    await schema.validate.structure(a);
    debug('Validating input schemas.');
    await Promise.all(a.inputs.map(schema.validate.input));
    debug('Validating parameter schemas.');
    await Promise.all(a.parameters.map(schema.validate.parameter));
    debug('Validating output schemas.');
    await Promise.all(a.outputs.map(schema.validate.output));
    debug('Analytic validation complete');
  }

  function extractAnalyticInfo(a) {
    return new Promise(function(resolve, reject) {
      let fields = {
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
          throw new Error(
            'If `zip_outputs == false`, at most one output can have ' +
            '`post_as_data == false`');
        } else if (nonDataOutputs.length === 0) {
          debug('Analytic generates no outputs');
          fields.output = 'null';
        } else {
          debug('Analytic has one output');
          fields.output = nonDataOutputs[0].filename;
        }
      }
      return resolve(fields);
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
      console.log('Shutting down server...\n');
      socket.close(() => {
        process.exit(0);
      });
    };
  }
}());
