# Platform Demo Analytic

This guide provides a end-to-end example of building and deploying an analytic
to the Voxel51 Platform.


## Overview

This directory defines a `platform-demo` analytic that is ready for deployment
to the Voxel51 Platform. The actual functionality of the analytic is defined in
the `main.py` file; it simply downloads an input video and randomly generates a
labels file that contains a single randomly oriented object detection.

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

If you would like to programmatically test the demo analytic once you have
uploaded it to the platform, you will also need to install the
[Python client library](https://github.com/voxel51/api-py):

```shell
# Clone the repository
git clone https://github.com/voxel51/api-py
cd api-py

# Install the library
pip install -r requirements.txt
pip install -e .
```


## Building the image

To build the demo analytic, simply run the commands below from this directory.
The code will clone a fresh copy of the Platform SDK, build the Docker image,
and then cleanup the generated files.

```shell
# Clone platform-sdk
git clone https://github.com/voxel51/platform-sdk
git submodule init
git submodule update

# Build image
docker build -t "platform-demo" .

# Cleanup
rm -rf platform-sdk
```


## Testing locally

Before deploying the analytic to the platform, it is helpful to test your
Docker images locally to ensure that they are functioning properly. Follow
the simple instructions below to use the SDK's local test server to run an job
with the image that you built:

```shell
# Launch test server
bash ../tests/integration-tests/run.bash \
    --analytic-json="./analytic.json" \
    --analytic-image="platform-demo" \
    --inputs="video=data/test.mp4" \
    --use-gpu
```

The server will print a `docker run` command that you should execute in
another terminal (from the same working directory). This will locally execute
the job that you specified, using your test server as a proxy for the platform.

After the Docker image exits, press `Ctrl-C` in the terminal session running
the server. This will generate a report summarizing the function of your
analytic and highlight any issues identified with your analytic.

After your analytic image passes local tests, it is ready for deployment to
the Voxel51 Platform!


## Deploying to the platform

To deploy your working analytic, you must first save it as a `.tar.gz` file so
that you can upload it to the platform:

```shell
docker save platform-demo | gzip -c > platform-demo.tar.gz
```

The following code snippet publishes the analytic to the platform using the
Python client library:

```py
from voxe51.api import API

analytic_json_path = "./analytic.json"
analytic_image_path = "./platform-demo.tar.gz"

api = API()
api.upload_analytic(analytic_json_path)
api.upload_analytic_image(analytic_id, analytic_image_path, "gpu")
```

You can also upload analytics by logging into your
[Platform Console account](https://console.voxel51.com).


## Using the analytic on the platform

After the analytic has been processed and is ready for use (check the Platform
Console to verify), you can run a test platform job on the `data/test.mp4`
video by executing the following code with the Python client library:

```py
from voxel51.api import API
from voxel51.jobs import JobRequest

api = API()

# Upload data
data = api.upload_data("data/test.mp4")
data_id = data["id"]

# Upload and start job
job_request = JobRequest("<your-username>/platform-demo")
job_request.set_input("video", data_id=data_id)
job = api.upload_job_request(job_request, "sdk-test", auto_start=True)
job_id = job["id"]

# Wait until job completes, then download output
api.wait_until_job_completes(job_id)
api.download_job_output(job_id, "out/labels.json")
```

In the above, replace `<your-username>` with your username on the platform.


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
