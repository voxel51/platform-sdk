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


## Setup

Download a short test video to work with:

```shell
mkdir -p data
wget -O data/test.mp4 'https://drive.google.com/uc?export=download&id=1wq3zg62Zg7CtlQPiVkJJKmi662nfraCF'
```

In addition, make sure that you followed the installation instructions in the
[README](../../README.md) to get setup with a Platform Account, the Python
client, and an API token.


## Building the image

To build the demo analytic, simply run the commands below from this directory.
The code will clone a fresh copy of the Platform SDK, build the Docker image,
and then cleanup the generated files.

```shell
# Clone platform-sdk
git clone https://github.com/voxel51/platform-sdk
cd platform-sdk
git submodule init
git submodule update
cd ..

# Build image
docker build -t "platform-demo" .

# Cleanup
rm -rf platform-sdk
```


## Testing locally

Before deploying analytics to the platform, it is helpful to test the Docker
images locally to ensure that they are functioning properly. The
[platform tests folder](../../tests/platform/README.md) defines a local
testing server that you can use to perform such tests.

Execute the following command to spawn a test server to run a job on the
`platform-demo` image locally:

```shell
# Launch test server
bash ../../tests/platform/test-platform.bash \
    --analytic-image platform-demo \
    --analytic-json analytic.json \
    --inputs video=data/test.mp4 \
    --compute-type cpu
```

The server will print a `docker run` command that you should execute in
another terminal. This will locally execute the job that you specified, using
your test server as a proxy for the platform. An `out/` directory will be
populated with the various files read and written by the analytic as it
executes.

After the Docker image exits, press `Ctrl-C` in the terminal session running
the server. This will generate a report summarizing the function of your
analytic and highlight any issues identified with your analytic.

After your analytic image passes local tests, it is ready for deployment to
the Voxel51 Platform!


## Deploying to the platform

To deploy your analytic to the Platform, you must first save the Docker image
as a `.tar.gz` file:

```shell
docker save platform-demo | gzip -c > platform-demo.tar.gz
```

The following code snippet publishes the analytic to the platform using the
Python client library:

```py
from voxel51.users.api import API

analytic_json_path = "./analytic.json"
cpu_image_path = "./platform-demo.tar.gz"

api = API()

# Upload analytic JSON
analytic = api.upload_analytic(analytic_json_path)
analytic_id = analytic["id"]

# Upload image
api.upload_analytic_image(analytic_id, cpu_image_path, "cpu")
```

You can also upload analytics via your
[Platform Console account](https://console.voxel51.com).


## Using the analytic on the platform

After the analytic has been processed and is ready for use (check the Platform
Console to verify), you can run a test platform job on the `data/test.mp4`
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

In the above, replace `<username>` with your username on the platform.


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
