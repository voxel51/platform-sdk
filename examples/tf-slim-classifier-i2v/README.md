# Deploying a Classifier via the Image-To-Video Tool

This directory demonstrates how to deploy an image classifier from the
[TensorFlow-Slim Model Zoo](https://github.com/tensorflow/models/tree/master/research/slim)
to the Voxel51 Platform via the Image-To-Video tool.


## Overview

This directory defines a `tf-slim-classifier-i2v` analytic that is ready for
deployment to the Voxel51 Platform.

The following files constitute the definition of the analytic:

- `main.bash`: the main Docker entrypoint script, which calls `main.py` and
gracefully handles any uncaught errors that are raised therein

- `main.py`: the main executable for the analytic, which loads the model using
the `eta.classifiers.TFSlimClassifier` interface, performs inference on each
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

### TF-Slim Model Zoo

Choose a model of interest from the [TF-Slim Model Zoo](
https://github.com/tensorflow/models/tree/master/research/slim) to deploy:

```shell
#
# Choose any model from
# https://github.com/tensorflow/models/tree/master/research/slim
#
MODEL=resnet_v2_50_2017_04_14
```

download it:

```
mkdir -p models/tmp
wget -P models/tmp http://download.tensorflow.org/models/${MODEL}.tar.gz
tar -xf models/tmp/${MODEL}.tar.gz -C models/tmp
```

and extract the training checkpoint:

```shell
mv models/tmp/*.ckpt models/${MODEL}.ckpt
rm -r models/tmp
```

Finally, export the frozen inference graph using the
`eta.classifiers.tfslim_classifiers.export_frozen_inference_graph()` method
and cleanup the checkpoint:

> Note: if you chose a different `MODEL` above, you will need to update the
> paths below to match. You will also need to update the corresponding
> constants in the `main.py` file prior to building the Docker image

```py
import eta.classifiers.tfslim_classifiers as etat
import eta.core.utils as etau

checkpoint_path = "models/resnet_v2_50_2017_04_14.ckpt"
network_name = "resnet_v2_50"
output_path = "models/resnet_v2_50_imagenet.pb"

etat.export_frozen_inference_graph(
    checkpoint_path, network_name, output_path, num_classes=1001)

etau.delete_file(checkpoint_path)
```

### ETA Models Registry

Alternatively, you can directly download a frozen inference graph from the ETA
models registry:

```shell
# Downloads a pre-trained ResNet50 v2 model from the ETA models registry
eta gdrive download --public \
    1cWT55Pp9wl2zR0Om8y-g8QVskYEthQfi models/resnet_v2_50_imagenet.pb
```


## Building the image

To build the image, run the following commands:

```shell
# For GPU build
BASE_IMAGE="nvidia/cuda:9.0-cudnn7-runtime-ubuntu16.04"
TENSORFLOW_VERSION="tensorflow-gpu==1.12.0"
IMAGE_NAME="tf-slim-classifier-i2v-gpu"

# For CPU build
BASE_IMAGE="ubuntu:16.04"
TENSORFLOW_VERSION="tensorflow==1.12.0"
IMAGE_NAME="tf-slim-classifier-i2v-cpu"

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
images locally to ensure that they are functioning properly.

To do so, first download a directory of frames to work with:

```shell
mkdir -p data
wget -O data/cats.tar.gz 'https://drive.google.com/uc?export=download&id=1Zexi3HtkDZPRWyTJUNxQCwvMfd2TtIsd'
wget -O data/cats.mp4 'https://drive.google.com/uc?export=download&id=178KqoAqIyGVbRiJZRu55pPRNau5i8gr8'
tar -xf data/cats.tar.gz -C data/
rm data/cats.tar.gz
```

Then run the image on the frames using the `test-i2v.bash` script provided by
the Platform SDK:

```shell
bash ../../tests/test-i2v.bash "${IMAGE_NAME}" data/cats/
```

If the script executed correctly, it will write an `out/labels.json` file.

To visualize the labels on the input video, run the following ETA pipeline,
which will generate an `out/cats-annotated.mp4` file:

```shell
VIDEO_PATH=data/cats.mp4
LABELS_PATH=out/labels.json
ANNOTATED_VIDEO_PATH=out/cats-annotated.mp4

eta build -n visualize_labels \
    -i "video=\"${VIDEO_PATH}\",video_labels=\"${LABELS_PATH}\"" \
    -o "annotated_video=\"${ANNOTATED_VIDEO_PATH}\"" \
    --run-now
```


## Deploying to the platform

To deploy your working analytic to the Platform, you must first save the Docker
images as `.tar.gz` files:

```shell
docker save tf-slim-classifier-i2v-cpu | gzip -c > tf-slim-classifier-i2v-cpu.tar.gz
docker save tf-slim-classifier-i2v-gpu | gzip -c > tf-slim-classifier-i2v-gpu.tar.gz
```

The following code snippet publishes the analytic to the platform using the
Python client library:

```py
from voxel51.users.api import API, AnalyticType

analytic_json_path = "./analytic.json"
cpu_image_path = "./tf-slim-classifier-i2v-cpu.tar.gz"
gpu_image_path = "./tf-slim-classifier-i2v-gpu.tar.gz"

api = API()

# Upload analytic JSON
analytic_type = AnalyticType.IMAGE_TO_VIDEO  # declare as Image-To-Video
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
Console to verify), you can run a test platform job on the `data/cats.mp4`
video by executing the following code with the Python client library:

```py
from voxel51.users.api import API
from voxel51.users.jobs import JobRequest

api = API()

# Upload data
data = api.upload_data("data/cats.mp4")

# Upload and start job
job_request = JobRequest("<username>/tf-slim-classifier-i2v")
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