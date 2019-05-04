/**
 * Local testing server entrypoint.
 *
 * Copyright 2017-2019, Voxel51, Inc.
 * voxel51.com
 *
 * David Hodgson, david@voxel51.com
 * Brian Moore, brian@voxel51.com
 */
'use strict';

const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const debug = require('debug')('server');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const uuid4 = require('uuid/v4');

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
    defaultValue: 'cpu',
    description: 'The compute type to use. Your Docker image must support ' +
      'this compute type. If GPU execution is requested, `--runtime=nvidia` ' +
      'is added to the `docker run` command; it is assumed that your ' +
      'machine and Docker installation are configured to support this. ' +
      'The default is `cpu`.',
    typeLabel: '<cpu|gpu>',
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
    content: 'Voxel51 Platform local analytic test server'
  },
  {
    header: 'Example usage',
    content: 'bash run.bash \\\n' +
      '--analytic-image <image-name> \\\n' +
      '--analytic-json <analytic-json> \\\n' +
      '--inputs <name>=<path> \\\n' +
      '--compute-type gpu'
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

    // Parse Docker image flag
    DOCKER_IMAGE_NAME = options['analytic-image'];
    if (!DOCKER_IMAGE_NAME) {
      throw new Error(
        'The --analytic-image flag must be set to provide the name of the ' +
        'local Docker image to test.');
    }

    // Parse analytic JSON flag
    ANALYTIC_JSON_PATH = options['analytic-json'];
    if (!ANALYTIC_JSON_PATH) {
      throw new Error(
        'The --anlytic-json flag must be set to provide the path to the ' +
        'analytic JSON file for the test.');
    }

    // Parse inputs
    INPUTS = options['inputs'];
    if (!INPUTS) {
      throw new Error(
        'The --inputs flag must be set to provide the name(s) and path(s) ' +
        'to the desired test files.');
    }
    try {
      const parsedInputs = await parseInputs(INPUTS);
    } catch (err) {
      console.error(`Unable to parse inputs: ${INPUTS}`);
      console.error(err);
    }

    // Parse parameters
    PARAMETERS = options['parameters'] || [];
    try {
      const parsedParameters = parseParameters(PARAMETERS);
    } catch (err) {
      console.error(`Unable to parse parameters: ${PARAMETERS}`);
      console.error(err);
    }

    // Parse compute type
    COMPUTE_TYPE = options['compute-type'];

    debug('Command-line args ingested.');

    const analyticFields = await parseAndVerifyAnalyticJSON();
    const {taskURL, task} = await generateTaskJSON(
      analyticFields, parsedInputs, parsedParameters);
    debug('Setup complete.');

    debug('Spinning up mock server.');
    const socket = await server.spinup(task);

    const dockerCmd = await generateDockerCommand(
      taskURL, task.logfile['signed-url']);

    // Print Docker run instructions
    console.log(
      '\n\nExecute the following command in a separate terminal to run your ' +
      'image now:\n\n', dockerCmd, '\n\nAfter the image terminates, kill ' +
      'the server via Ctrl-C to generate a report summarizing the test.' +
      '\n\nTo cleanup after the test, run \'bash clean.bash\'\n\n');

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
    var parsedInputs = {};
    for (const namePath of inputs) {
      const [name, path] = namePath.split('=');
      const inputFilename = await copyInputToStorage(path);
      parsedInputs[name] = {
        'signed-url': await generateSignedUrl(inputFilename, 'inputs')
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
    const parsedParameters = {};
    parameters.forEach(function(nameValue) {
      let [name, value] = nameValue.split('=');
      parsedParameters[name] = JSON.parse(value);
    });
    return parsedParameters;
  }

  function generateSignedUrl(filepath, type) {
    let localPath = path.join(config.STORAGE_BASE_DIR, filepath);
    return Promise.resolve(
      `${config.API_BASE_URL}/local/file?${type}=${localPath}`);
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
        `-e API_TOKEN="xxxxxxxxxxxxxxxx" ` +
        `-e OS="${process.platform}" ` +
        `-e LOGFILE_SIGNED_URL="${logfileURL}" ` +
        `-e API_BASE_URL="${config.API_BASE_URL}" ` +
        `--network="host" ${DOCKER_IMAGE_NAME}; ` +
        `echo -e "Now kill the server (Ctrl-C) to retrieve your results!"`;

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

  async function parseAndVerifyAnalyticJSON() {
    debug('Starting reading and parsing of analytic JSON file.');
    const analyticFilename = path.basename(ANALYTIC_JSON_PATH);
    debug('Analytic filename read as:', analyticFilename);
    const analyticFilepath = path.join(
      config.STORAGE_BASE_DIR, analyticFilename);
    debug('Analytic filepath created as:', analyticFilepath);
    await pExec(`cp ${ANALYTIC_JSON_PATH} ${analyticFilepath}`);
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
}());
