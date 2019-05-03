# Local Analytic Testing Suite

This directory provides a local testing server that you can use to test your
analytic Docker image locally on your machine to verify that it works properly
before deploying it to the Voxel51 Platform.

The test suite consists of a simple HTTP server that will mock the expected
behavior of the Platform API when your analytic Docker communicates with it.
When you launch the server, it provides a `docker run` command that you can
copy and paste into another terminal to run your Docker image locally.
When the server is killed, it will generate a report that assesses
whether your analytic executed successfully and invoked all necessary SDK
methods.


## Installation

The test suite requires [Node.js](https://nodejs.org) and
[npm](https://www.npmjs.com). We recommend that you use
[nvm](https://github.com/creationix/nvm) to install them, if necessary.

```shell
# Install node and npm via nvm
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
source ~/.bashrc
nvm install node
```

To setup the test suite, simply run the following command from the `tests/`
directory:

```shell
npm install
```


## Quickstart

The `run.bash` script

If you are more comfortable using bash scripts, a number of "runner"
scripts are provided:

- `run.sh` - main script with no extra debug logging

The three command line variables that require setting are:

- analytic-image - the docker image to test
- input-file - the test input file
- analytic-json - the analytic JSON file for the test docker image

Multiple inputs are supported via the `--inputs` flag. This argument
will supercede any setting of `--input-file`. `--inputs` must be a
comma-separated list formatted like `--input-file`, so:

```
# single input
--input-file=<key>:<absolute-path-to-file>

# multiple inputs
--inputs=<key1>:<path1>,<key2>:<path2>,...
```

> Note: Key is referring to the input's property name, e.g. `video`.

Setting non-default parameters is also supported via the `--params` flag.
The value passed to the `--params` flag MUST be a JSON parseable value. This
permits proper setting of value types. The example below shows a parameter
flag setting of the four main types - string, number, array, and object.

```
--params='{"number": 42.0, "array": [1,2,3,4], "string": "foobarbaz", "object": {"a": 12}}'
```

The test suite also supports optionally using `nvidia-docker2` runtime
via the optional `--compute-type=gpu` command line argument. This
requires both a working GPU and Docker setup for the required runtime support.


## Executing

Below is an example of starting the test suite. This will output a `docker run`
command that you must then copy and paste in another terminal/shell.
Once the docker image finishes (either error or success), return to the
server shell and kill it (`Ctrl-C`). A simple JSON report will
provide information on server and docker interactions that
were registered during the test.

> NOTE: Restart a new server instance for each test!

```shell
# bash run.bash or ./run.bash are supported
./run.bash --analytic-image=<my-docker-image> \
  --analytic-json=<absolute-path-to-analytic-json-file> \
  --input-file=<absolute-path-to-input-test-file>

# then copy and paste the run command in another shell

# example with multiple inputs and setting non-default parameters
./run.bash --analytic-image=<my-docker-image> \
  --analytic-json=<absolute-path-to-analytic-json-file> \
  --inputs=<key1>:<path1>,<key2>:<path2>,<key3>:<path3>,... \
  --params='{"fps": 25, "schema": ["car", "bus", "bike"]}'
```

## Cleanup

To cleanup the generated and written test files, run:


```
npm run clean # yarn run clean
```

Cleanup of Docker containers/images is left to the developer.


## Docker Entrypoint Recommendation

If following the `platform-sdk` recommendations on using the `main.bash`
entrypoint wrapper, running that image locally will result in no live logs
posted, as `stdout` and `stderr` are both piped to the logfile. This can
be undesirable during local testing, so consider using a simple entrypoint,
like `ENTRYPOINT ["python", "main.py"]`, so that debugging logs are readily
available for local tests! The entrypoint wrapper version can be quickly
built after testing and the wrapped version is *strongly* recommended
when you are ready to register your analytic in the Platform system!




## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
voxel51.com

David Hodgson, david@voxel51.com<br>
Brian Moore, brian@voxel51.com
