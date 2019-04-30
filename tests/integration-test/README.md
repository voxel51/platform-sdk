# Platform SDK Integration Test Suite

This project serves as a means for analytic developers using
Voxel51's Platform SDK a quick, simple method for verifying that
their built Docker images are compatible with the Voxel51 Platform
compute interface. The suite consists of a simple HTTP server that will
mock the expected behavior of the actual Platform when receiving
requests from the Docker image. In addition, the suite will also provide
a short report detailing if any necessary integration points/calls are
missing from the current Docker image.


## Dependencies

The suite only requires `node` and `npm` or `yarn` to be available. Voxel51
recommends using [nvm](https://github.com/creationix/nvm)
to install `node` and `nvm`. `yarn` can be installed by various methods, but
once `npm` is installed it can easily be added via `npm install -g yarn`. Be
sure to use the above link to grab the latest verion of `nvm`! For additional
`yarn` installation methods, see
[here](https://yarnpkg.com/en/docs/install#debian-stable).

```shell
# example installation of nvm, node, npm, and yarn
# with curl
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
source ~/.bashrc
nvm install node # version can be specified here if desired
node -v
npm -v

# install yarn via npm or other method (optional)
npm install -g yarn
```


## Setup

To initially setup the test suite, run:

```shell
# from test suite root directory
npm install # yarn
```


That's it! Running `npm start` will display helpful error messages
if variables are not set correctly or, if they are set, will
spin up the test server and output the correct docker run command.

If you are more comfortable using bash scripts, a number of "runner"
scripts are provided:

- `run.sh` - main script with no extra debug logging
- `debug.sh` - main debug script with all debug logging turned on
- `debug-setup.sh` - debug script with only setup debug logging turned on
- `debug-server.sh` - debug script with only server debug logging turned on

The three command line variables that require setting are:

- analytic-image - the docker image to test
- input-file - the test input file (multiple input support
in development).
- analytic-json - the analytic JSON file for the test docker image

All command line variables must be used in this form:
`--analytic-image=<my-image-name>`. Not using this format will cause the
scrip to fail.


## Executing

Below is an example of starting the test suite. This will output a `docker run`
command that you must then copy and paste in another terminal/shell.
Once the docker image finishes (either error or success), return to the
server shell and kill it (`Ctrl-C`). A simple JSON report will
provide information on server and docker interactions that
were registered during the test.

> NOTE: Restart a new server instance for each test!

```shell
# bash run.sh or ./run.sh are supported
./run.sh --analytic-image=<my-docker-image> \
  --analytic-json=<absolute-path-to-analytic-json-file> \
  --input-file=<absolute-path-to-input-test-file>

# then copy and paste the run command in another shell
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

David Hodgson, david@voxel51.com
