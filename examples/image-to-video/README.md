# Example Image-To-Video Model

This guide provides a end-to-end example of building and deploying an
image-based model to the Voxel51 Platform using the Image-To-Video tool.


## Overview

This directory defines an `image-to-video-demo` container that is ready for
deployment to the Voxel51 Platform. The actual functionality of the container
is simple: it generates a `VideoLabels` file that contains random labels for a
single frame-level attribute and a single randonly oriented object throughout
the frames.

The following files constitute the definition of the container:

- `main.bash`: the main Docker entrypoint script, which calls `main.py` and
logs any uncaught errors that are raised therein

- `main.py`: the main executable for the container. In this simple demo, the
entire algorithm is contained in this single file

- `analytic.json`: the analytic JSON file for the container, which declares
the metadata about the Image-To-Video analytic

- `Dockerfile`: the Dockerfile that specifies how to build an image containing
the algorithm and its dependencies


## Setup

Download a directory of frames to work with:

```shell
mkdir -p data
wget -O data/people.tar.gz 'https://drive.google.com/uc?export=download&id=1zi7oCKjmZ0ectl4xgn7r3V4DiUKrgZuk'
wget -O data/people.mp4 'https://drive.google.com/uc?export=download&id=1daYF-MZkdJs3BKjcAQMRBFxkndovfkiw'
tar -xf data/people.tar.gz -C data/
rm data/people.tar.gz
```

In addition, make sure that you followed the installation instructions in the
[README](../../README.md) to get setup with a Platform Account, the Python
client, and an API token.


## Building the image

To build the image-to-video model, simply run the commands below from this
directory. The code will clone a fresh copy of the Platform SDK, build the
Docker image, and then cleanup the generated files.

```shell
# Clone platform-sdk
git clone https://github.com/voxel51/platform-sdk
cd platform-sdk
git submodule init
git submodule update
cd ..

# Build image
docker build -t "image-to-video-demo" .

# Cleanup
rm -rf platform-sdk
```


## Testing locally

Before deploying analytics to the platform, it is helpful to test the Docker
images locally to ensure that they are functioning properly. Run the following
script to execute your Docker image on the directory of frames you downloaded
above:

```shell
bash test-image.bash image-to-video-demo data/people/
```

If the script executed correctly, it will write an `out/labels.json` file in
your working directory, and you are ready to deploy to the Voxel51 Platform!


## Deploying to the platform

To deploy your working analytic, you must first save it as a `.tar.gz` file so
that you can upload it to the platform:

```shell
docker save image-to-video-demo | gzip -c > image-to-video-demo.tar.gz
```

The following code snippet publishes the analytic to the platform using the
Python client library:

```py
from voxel51.users.api import API

analytic_json_path = "./analytic.json"
analytic_image_path = "./image-to-video-demo.tar.gz"

api = API()

# Upload analytic JSON and declare it as an image-to-video model
analytic = api.upload_analytic(analytic_json_path, is_image_to_video=True)
analytic_id = analytic["id"]

# Upload image
api.upload_analytic_image(analytic_id, analytic_image_path, "cpu")
```

You can also upload analytics by logging into your
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
data = api.upload_data("data/people.mp4")
data_id = data["id"]

# Upload and start job
job_request = JobRequest("<your-username>/image-to-video-demo")
job_request.set_input("video", data_id=data_id)
job = api.upload_job_request(job_request, "image-to-video-demo", auto_start=True)
job_id = job["id"]

# Wait until job completes, then download output
api.wait_until_job_completes(job_id)
api.download_job_output(job_id, "out/labels.json")
```

In the above, replace `<your-username>` with your username on the platform.


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
