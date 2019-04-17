# Platform SDK Integration Test Suite

This project serves as a means for analytic developers using
Voxel51's platform sdk a quick, simple method for verifying that
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
npm run test-setup # yarn run test-setup
```


## Executing
TODO

```shell
# generates output command to launch server and start docker image
npm run generate-test-command # yarn run generate-test-command
# copy and paste output command, substituting for variables where needed!
```


## Cleanup

To cleanup the generated and written test files, run:


```
npm run clean-up # yarn run clean-up
```

Cleanup of Docker containers/images is left to the developer.


## Understanding Test Results
TODO


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
voxel51.com

David Hodgson, david@voxel51.com
