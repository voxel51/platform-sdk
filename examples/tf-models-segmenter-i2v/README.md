# Deploying an Instance Segmentation Model via the Image-To-Video Tool

This directory demonstrates how to deploy an instance segmentation model from
the [TensorFlow Detection Model Zoo](
https://github.com/tensorflow/models/blob/master/research/object_detection/g3doc/detection_model_zoo.md)
to the Voxel51 Platform via the Image-To-Video tool.


## Overview

This directory defines a `tf-models-segmenter-i2v` analytic that is ready for
deployment to the Voxel51 Platform.

The following files constitute the definition of the analytic:

- `main.bash`: the main Docker entrypoint script, which calls `main.py` and
gracefully handles any uncaught errors that are raised therein

- `main.py`: the main executable for the analytic, which loads the model using
the `eta.detectors.TFModelsSegmenter` interface, performs inference on each
frame provided by the pre-processing container, and saves the resulting
predictions as an `eta.core.video.VideoLabels` JSON file on disk

- `analytic.json`: the analytic JSON file for the analytic, which declares
the inputs and outputs that the analytic exposes

- `Dockerfile`: the Dockerfile that specifies how to build an image containing
the analytic and its dependencies


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


## Model setup

### TF Detection Model Zoo

Choose a model of interest from the [TF Detection Model Zoo](
https://github.com/tensorflow/models/blob/master/research/object_detection/g3doc/detection_model_zoo.md):

```shell
#
# Choose any model that outputs masks from
# https://github.com/tensorflow/models/blob/master/research/object_detection/g3doc/detection_model_zoo.md
#
MODEL=mask_rcnn_resnet101_atrous_coco_2018_01_28
```

Download the model of interest and extract the frozen inference graph:

```shell
# Extracts frozen inference graph to `models/frozen_inference_graph.pb`
wget -P models/ http://download.tensorflow.org/models/object_detection/${MODEL}.tar.gz
tar -xf models/${MODEL}.tar.gz -C models/
mv models/${MODEL}/frozen_inference_graph.pb models/frozen_inference_graph.pb
rm models/${MODEL}.tar.gz
rm -r models/${MODEL}
```

### ETA Models Registry

Alternatively, you can directly download a frozen inference graph from the ETA
Models Registry:

```shell
# Downloads a pre-trained Mask R-CNN Atrous ResNet101 detector from the ETA
# models registry
eta gdrive download --public 1PvW3E6Ey3yC7E7mri_Bw6FyjyOOy4_aX \
    models/frozen_inference_graph.pb
```


## Building the image

To build the image, run the following commands:

```shell
# For GPU build
BASE_IMAGE="nvidia/cuda:9.0-cudnn7-runtime-ubuntu16.04"
TENSORFLOW_VERSION="tensorflow-gpu==1.12.0"
IMAGE_NAME="tf-models-segmenter-i2v-gpu"

# For CPU build
BASE_IMAGE="ubuntu:16.04"
TENSORFLOW_VERSION="tensorflow==1.12.0"
IMAGE_NAME="tf-models-segmenter-i2v-cpu"

# Build the image
docker build \
    --file Dockerfile \
    --build-arg BASE_IMAGE="${BASE_IMAGE}" \
    --build-arg TENSORFLOW_VERSION="${TENSORFLOW_VERSION}" \
    --tag "${IMAGE_NAME}" \
    .

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
test-i2v "${IMAGE_NAME}" data/people
```

If the script executed correctly, it will write an `out/labels.json` file in
your working directory that contains the predictions generated for each input
frame.

To visualize the labels on the input video, run the following ETA pipeline,
which will generate an `out/people-annotated.mp4` file:

```shell
VIDEO_PATH=data/people.mp4
LABELS_PATH=out/labels.json
ANNOTATED_VIDEO_PATH=out/people-annotated.mp4

eta build -n visualize_labels \
    -i "video=\"${VIDEO_PATH}\",video_labels=\"${LABELS_PATH}\"" \
    -o "annotated_video=\"${ANNOTATED_VIDEO_PATH}\"" \
    --run-now
```

To cleanup after the test, run `test-i2v -c` from the same working directory in
which you ran the test script.

After your analytic image passes local tests, it is ready for deployment to
the Voxel51 Platform!


## Deploying to the platform

To deploy your working analytic to the Platform, you must first save the Docker
images as `.tar.gz` files:

```shell
docker save tf-models-segmenter-i2v-cpu | gzip -c > tf-models-segmenter-i2v-cpu.tar.gz
docker save tf-models-segmenter-i2v-gpu | gzip -c > tf-models-segmenter-i2v-gpu.tar.gz
```

The following code snippet publishes the analytic to the platform using the
Python client library. In order to run it, you must have first followed the
[installation instructions in the README](../../README.md#installation)
to get setup with a Platform Account, the Python client, and an API token.

```py
from voxel51.users.api import API, AnalyticType

analytic_json_path = "./analytic.json"
cpu_image_path = "./tf-models-segmenter-i2v-cpu.tar.gz"
gpu_image_path = "./tf-models-segmenter-i2v-gpu.tar.gz"

api = API()

# Upload analytic JSON
analytic_type = AnalyticType.IMAGE_TO_VIDEO
analytic = api.upload_analytic(analytic_json_path, analytic_type=analytic_type)
analytic_id = analytic["id"]

# Upload images
api.upload_analytic_image(analytic_id, cpu_image_path, "cpu")
api.upload_analytic_image(analytic_id, gpu_image_path, "gpu")
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
job_request = JobRequest("<username>/tf-models-segmenter-i2v")
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