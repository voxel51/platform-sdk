# Platform Local Testing Server

This directory defines a local testing server that you can use to test your
analytic Docker image locally on your machine to verify that it works properly
before deploying it to the Voxel51 Platform.

The tool consists of a simple HTTP server that will mock the expected
behavior of the Platform API when your analytic Docker communicates with it.
When you launch the server, it provides a `docker run` command that you can
copy and paste into another terminal to run your Docker image locally.
When the server is killed, it will generate a report that assesses
whether your analytic executed successfully and invoked all necessary SDK
methods.


## Quickstart

To launch the local testing server, use the `test-platform` script that is
provided when you install the Platform SDK repository:

```
Voxel51 Platform Analytic Local Testing Server

Example usage

  test-platform \
    --analytic-image <image-name> \
    --analytic-json <analytic-json> \
    --inputs <name>=<path> \
    --compute-type <cpu|gpu>

Options

  --analytic-image <image-name>     The name of the analytic Docker image to run. This flag is required.
  --analytic-json <analytic-json>   The path to the analytic JSON file to use. This flag is required.
  -i, --inputs <name>=<path>        Name=path pair(s) specifying the inputs to use. Can be repeated multiple
                                    times if necessary. At least one input is required.
  -p, --parameters <name>=<value>   Name=value pair(s) specifying parameter settings to use. `value` must be JSON
                                    parsable. Can be repeated multiple times if  necessary.
  --compute-type <cpu|gpu>          The compute type to use. Your Docker image must support this compute type. If
                                    GPU execution is requested, `--runtime=nvidia` is added to the `docker run`
                                    command; it is assumed that your machine and Docker installation are
                                    configured to support this.
  -c, --clean                       Cleanup generated files from a previous test run from the current working
                                    directory.
  -h, --help                        Displays this usage guide.
```

Running the script will output a `docker run` command that you must copy and
paste into another terminal window in order to run your analytic. When you run
the image, an `out/` directory will be populated in your current working
directory with the various files read and written by your analytic. Once the
Docker image exits (either successfully or unsuccessfully), kill the server by
entering `Ctrl-C`. A test report will then be generated that summarizes the
function of your analytic and highlights any issues that were identified. After
your analytic image passes local tests, it is ready for deployment to the
Voxel51 Platform!

Note that you must restart the server for each test you run.

See the
[examples folder](https://github.com/voxel51/platform-sdk/tree/develop/examples)
for a pre-defined test analytic that you can build and deploy to the platform
to get comfortable with the workflow.


## Cleanup

To cleanup generated test files after running a test, run the following command
from the same working directory in which you launched the test server:

```bash
test-platform -c
```

You must manually cleanup any Docker images that you build on your machine.


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
voxel51.com
