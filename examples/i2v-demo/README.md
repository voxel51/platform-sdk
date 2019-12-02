# Example Image-To-Video Analytic

This guide provides a end-to-end example of building and deploying an analytic
to the [Voxel51 Platform](https://console.voxel51.com) using the
Image-To-Video tool from the Platform SDK.


## Overview

This directory defines an `i2v-demo` container that is ready for deployment
to the Voxel51 Platform. The actual functionality of the container is simple:
it generates a `VideoLabels` file that contains random labels for a single
frame-level attribute and a single randonly oriented object throughout the
frames.

The following files constitute the definition of the container:

- `main.bash`: the main Docker entrypoint script, which calls `main.py` and
logs any uncaught errors that are raised therein

- `main.py`: the main executable for the container, which defines the (simple)
functionality of the analytic

- `analytic.json`: the analytic JSON file for the container, which declares
the metadata about the Image-To-Video analytic

- `Dockerfile`: the Dockerfile that specifies how to build an image containing
the algorithm and its dependencies


## Environment setup

First, install the Platform SDK with a full ETA installation:

> Note: you probably want to do this in a fresh virtual environment so you
> don't interfere with your existing ETA installation!

```shell
# Install Platform SDK
git clone https://github.com/voxel51/platform-sdk
cd platform-sdk
git submodule init
git submodule update

# Full ETA install
cd eta
bash install.bash
cp config-example.json config.json

cd ../..
```


## Building the image

To build the image, run the following commands:

```shell
# Build the image
docker build --tag i2v-demo .

# Cleanup
rm -rf platform-sdk
```


## Testing locally

Before deploying analytics to the platform, it is helpful to test the Docker
images locally to ensure that they are functioning properly. The Platform SDK
provides a `test-i2v` script that you can use to perform such tests. Type
`test-i2v -h` to learn more about the script.

To test your analytic locally, first download a directory of frames to work
with:

```shell
mkdir -p data
wget -O data/people.tar.gz 'https://drive.google.com/uc?export=download&id=1zi7oCKjmZ0ectl4xgn7r3V4DiUKrgZuk'
wget -O data/people.mp4 'https://drive.google.com/uc?export=download&id=1daYF-MZkdJs3BKjcAQMRBFxkndovfkiw'
tar -xf data/people.tar.gz -C data/
rm data/people.tar.gz
```

Then run the image on the frames using the `test-i2v` script:

```shell
test-i2v i2v-demo data/people
```

If the script executed correctly, it will write an `out/labels.json` file in
your working directory that contains the predictions generated for each input
frame.

To cleanup after the test, run `test-i2v -c` from the same working directory in
which you ran the test script.

After your analytic image passes local tests, it is ready for deployment to
the Voxel51 Platform!


## Deploying to the platform

To deploy your analytic to the Platform, you must first save the Docker image
as a `.tar.gz` file:

```shell
docker save i2v-demo | gzip -c > i2v-demo.tar.gz
```

The following code snippet publishes the analytic to the platform using the
Python client library:

```py
from voxel51.users.api import API, AnalyticType

analytic_json_path = "./analytic.json"
cpu_image_path = "./i2v-demo.tar.gz"

api = API()

# Upload analytic JSON
analytic_type = AnalyticType.IMAGE_TO_VIDEO  # declare as Image-To-Video
analytic = api.upload_analytic(analytic_json_path, analytic_type=analytic_type)
analytic_id = analytic["id"]

# Upload image
api.upload_analytic_image(analytic_id, cpu_image_path, "cpu")
```

You can also upload analytics via your
[Platform Console account](https://console.voxel51.com).


## Using the analytic on the platform

After the analytic has been processed and is ready for use (check the Platform
Console to verify), you can run a test platform job on the `data/people.mp4`
video by executing the following code with the Python client library:

```py
from voxel51.users.api import API
from voxel51.users.jobs import JobRequest

api = API()

# Upload data
data = api.upload_data("data/people.mp4")

# Upload and start job
job_request = JobRequest("<username>/i2v-demo")
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
