# Example Platform Analytic

This guide provides a end-to-end example of building and deploying an analytic
to the [Voxel51 Platform](https://console.voxel51.com) using the Platform SDK.


## Overview

This directory defines a `platform-demo` analytic that is ready for deployment
to the Voxel51 Platform. The actual functionality of the analytic is simple: it
downloads an input video and randomly generates a `VideoLabels` file that
contains a single randomly oriented object detection.

The following files constitute the definition of the analytic:

- `main.bash`: the main Docker entrypoint script, which calls `main.py` and
gracefully handles any uncaught errors that are raised therein

- `main.py`: the main executable for the analytic. In this simple demo, the
entire analytic is contained in this single file

- `analytic.json`: the analytic JSON file for the analytic, which declares
the inputs and outputs that the analytic exposes

- `Dockerfile`: the Dockerfile that specifies how to build an image containing
the analytic and its dependencies


## Environment setup

First, clone a fresh copy of the Platform SDK inside this directory. Yes, a
fresh copy, not the version of the SDK that you cloned in order to access the
file you're reading. This new copy of the SDK will be copied into the Docker
image that you build.

```shell
# Clone Platform SDK
git clone https://github.com/voxel51/platform-sdk

# Initialize submodules
cd platform-sdk
git submodule init
git submodule update

cd ..
```


## Building the image

To build the image, run the following command:

```shell
# Build the image
docker build --tag platform-demo .
```


## Testing locally

Before deploying analytics to the Platform, it is helpful to test the Docker
images locally to ensure that they are functioning properly. The Platform SDK
provides a `test-platform` script that you can use to perform such tests.
Type `test-plaform -h` to learn more about the script.

To test your analytic locally, first download a test video to work with:

```shell
mkdir -p data
wget -O data/test.mp4 'https://drive.google.com/uc?export=download&id=1wq3zg62Zg7CtlQPiVkJJKmi662nfraCF'
```

Then execute the following command to spawn a test server:

```shell
# Launch test server
test-platform \
    --analytic-image platform-demo \
    --analytic-json analytic.json \
    --inputs video=data/test.mp4 \
    --compute-type CPU
```

The server will print a `docker run` command that you should execute in
another terminal. This will locally execute the job that you specified, using
your test server as a proxy for the Platform. An `out/` directory will be
populated with the various files read and written by the analytic as it
executes.

After the Docker image exits, press `Ctrl-C` in the terminal session running
the server. This will generate a report summarizing the function of your
analytic and highlight any issues identified with your analytic.

To cleanup after the test, run `test-platform -c` from the working directory
in which you launched the test server.

After your analytic image passes local tests, it is ready for deployment to
the Voxel51 Platform!


## Deploying to the Platform

To deploy your analytic to the Platform, you must first save the Docker image
as a tarfile:

```shell
docker save platform-demo | gzip -c > platform-demo.tar.gz
```

### Deploying via Python client library

The following code snippet publishes the analytic to the Platform using the
Python client library. In order to run it, you must have first followed the
[installation instructions in the README](../../README.md#installation)
to get setup with a Platform Account, the Python client, and an API token.

```py
from voxel51.users.api import API, AnalyticImageType

analytic_json_path = "./analytic.json"
cpu_image_path = "./platform-demo.tar.gz"

api = API()

# Upload analytic JSON
analytic = api.upload_analytic(analytic_json_path)
analytic_id = analytic["id"]

# Upload image
api.upload_analytic_image(analytic_id, cpu_image_path, AnalyticImageType.CPU)
```

### Deploying via CLI

You can also upload analytics via the `voxel51` CLI that is automatically
installed with the Python client library:

```shell
ANALYTIC_DOC_PATH=./analytic.json
CPU_IMAGE_PATH=./platform-demo.tar.gz

# Upload analytic JSON
ANALYTIC_ID=$(voxel51 analytics upload $ANALYTIC_DOC_PATH --print-id)

# Upload image
voxel51 analytics upload-image -i $ANALYTIC_ID -p $CPU_IMAGE_PATH -t CPU
```

### Deploying via Platform Console

Finally, you can upload analytics via your
[Platform Console account](https://console.voxel51.com).


## Using the analytic on the Platform

After the analytic has been processed and is ready for use (check the Platform
Console to verify), you can run a test Platform job on the `data/test.mp4`
video by executing the following code with the Python client library:

```py
from voxel51.users.api import API
from voxel51.users.jobs import JobRequest

api = API()

# Upload data
data = api.upload_data("data/test.mp4")

# Upload and start job
job_request = JobRequest("<username>/platform-demo")
job_request.set_input("video", data_id=data["id"])
job = api.upload_job_request(job_request, data["name"], auto_start=True)

# Wait until job completes, then download output
api.wait_until_job_completes(job["id"])
api.download_job_output(job["id"], "out/labels.json")
```

In the above, replace `<username>` with your username on the Platform.


## Copyright

Copyright 2017-2020, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
