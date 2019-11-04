# Image-To-Video Quickstart

This guide provides a detailed description of using the
[Platform SDK](https://github.com/voxel51/platform-sdk) to wrap your custom
image-based model and deploy it to the Voxel51 Platform to process videos.

See the
[Image-To-Video Examples Folder](https://github.com/voxel51/platform-sdk/tree/develop/examples/image-to-video)
for a pre-defined test image-based moel that you can build and deploy to the
platform using the Image-To-Video tool.

<img src="https://drive.google.com/uc?id=1j0S8pLsopAqF1Ik3rf-CdyAIU4kA0sOP" alt="voxel51-logo.png" width="40%"/>


## Docker installation

All analytics are deployed to the Voxel51 Platform as
[Docker images](https://www.docker.com). If you are new to Docker, we recommend
that you:

- install the Community Edition (CE) on your machine by following the simple
instructions at https://docs.docker.com/install
- read the Docker orientation guide at https://docs.docker.com/get-started to
get familar with the concepts


## Image-To-Video executable

The following code provides an annotated example of a generic Python executable
`main.py` that acts as the entrypoint for an Image-To-Video Docker image.

As mentioned below, this entrypoint can be re-written in any language if
desired, as long as it performs the following actions:

1. Read the input images from the ``/shared/user/inputs/frames`` directory,
which is populated with images in te format ``%06d.<ext>``, where ``%06d``
denotes the frame number of the image (e.g., `000010` for frame 10), and
`<ext>` is any valid image format. Note that not all frames will be present in
this directory.

2. Write the predictions to ``/shared/user/outputs/labels.json`` in the JSON
format defined by ``eta.core.video.VideoLabels``. See
https://voxel51.com/docs/api/#types-videolabels for more information.

3. Any desired logging messages are appended to ``/var/log/image.log``.

You can easily adapt this template to run your custom model by inserting
the appropriate code in the places marked by `@todo`.

```python
#!/usr/bin/env python
'''
Template entrypoint for an Image-To-Video Docker image on the Voxel51 Platform.

This entrypoint can be re-written in any language if desired, as long as it
performs the following actions:

1. Read the input images from the ``/shared/user/inputs/frames`` directory,
    which is populated in the format ``%06d.<ext>``, where ``%06d``
    denotes the frame number of the image (e.g., `000010` for frame 10), and
    `<ext>` is any valid image format. Note that there may be frame numbers
    missing from this directory.

2. Write the predictions to ``/shared/user/outputs/labels.json`` in the JSON
    format defined by ``eta.core.video.VideoLabels``. See
    https://voxel51.com/docs/api/#types-videolabels for more information.

3. Any desired logging messages are appended to ``/var/log/image.log``.

Copyright 2017-2019, Voxel51, Inc.
voxel51.com

Brian Moore, brian@voxel51.com
'''
# pragma pylint: disable=redefined-builtin
# pragma pylint: disable=unused-wildcard-import
# pragma pylint: disable=wildcard-import
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals
from builtins import *
# pragma pylint: enable=redefined-builtin
# pragma pylint: enable=unused-wildcard-import
# pragma pylint: enable=wildcard-import

import logging

import voxel51.image2video.core as voxc


logger = logging.getLogger(__name__)


def main():
    '''Main method.'''
    # Setup logging
    voxc.setup_logging()

    # Load model
    logger.info("Loading model")
    model = load_model()

    # Perform predictions
    logger.info("Performing predictions")
    predictions = voxc.Predictions()
    for img, frame_number in voxc.read_images():
        image_labels = process_image(model, img)
        predictions.add(frame_number, image_labels)

    # Write predictions to disk
    logger.info("Writing predictions to disk")
    voxc.write_predictions(predictions)


def load_model():
    '''Loads the image-based model to use.

    Returns:
        the model
    '''
    # @todo: load and return your model here!
    return None


def process_image(model, img):
    '''Processes the given image through the given model and returns the
    predictions in ``eta.core.image.ImageLabels`` format.

    Args:
        model: the image-based model to use
        img: the image

    Returns:
        an ``eta.core.image.ImageLabels`` instance
    '''
    # @todo perform prediction and return results as ImageLabels
    return None


if __name__ == "__main__":
    main()
```


## Docker entrypoint

In order to gracefully handle any uncaught exceptions in the analytic
executable defined above, we strongly recommend wrapping your executable in the
following simple `main.bash` script, which will act as the entrypoint to your
Docker image.

The script simply executes the main executable from the previous section
and pipes its `stdout` and `stderr` to disk.

This extra layer of protection is important to appropriately log errors that
prevent your image from appropriately loading (e.g., an `import` error
caused from buggy installation instructions in the `Dockerfile`).

```shell
#!/bin/bash
# Main entrypoint for an Image-to-Video container.
#
# Syntax:
#   bash main.bash
#

#
# Don't change this path; the platform attaches a pre-stop hook to images at
# runtime that will upload the logfile from this location whenever a task is
# terminated unexpectedly (e.g., preemption, resource violation, etc.)
#
LOGFILE_PATH=/var/log/image.log

#
# Execute analytic and pipe stdout/stderr to disk so that this information
# will be available in case of errors.
#
# If necessary, replace `python main.py` here with the appropriate invocation
# for your analytic.
#
set -o pipefail
python main.py 2>&1 | tee "${LOGFILE_PATH}"
```


## Docker build

This section assumes that you have populated the Image-To-Video executable and
entrypoint scripts from the previous sections to run your custom image-based
model.

The snippet below defines a `Dockerfile` that installs the Platform SDK and
its dependencies in a GPU-enabled Docker image that runs the `main.bash` and
`main.py` scripts that you provide. It can be easily extended to include any
custom installation requirements for your analytic.

```shell
# A typical base image for GPU deployments. Others are possible
FROM nvidia/cuda:9.0-cudnn7-runtime-ubuntu16.04

#
# Your custom installation here!
#

#
# Install `platform-sdk` and its dependencies
#
# The Platform SDK supports either Python 2.7.X or Python 3.6.X
#
# For CPU-enabled images, install tensorflow==1.12.0
#
# For GPU-enabled images, use the TensorFlow version compatible with the CUDA
# version in your image:
#   - CUDA 8: tensorflow-gpu==1.4.0
#   - CUDA 9: tensorflow-gpu==1.12.0
#   - CUDA 10: tensorflow-gpu==1.14.0
#
# The following installs Python 3.6 with TensorFlow 1.12.0 to suit the base
# NVIDIA image chosen above.
#
COPY platform-sdk/ /engine/platform-sdk/
RUN apt-get update \
    && apt-get -y --no-install-recommends install \
        software-properties-common \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get -y --no-install-recommends install \
        sudo \
        build-essential \
        pkg-config \
        ca-certificates \
        unzip \
        git \
        curl \
        libcupti-dev \
        python3.6 \
        python3-dev \
        python3-pip \
        python3-setuptools \
        ffmpeg \
        imagemagick \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && ln -s /usr/bin/pip3 /usr/bin/pip \
    && python -m pip install --upgrade pip \
    && python -m pip --no-cache-dir install -r /engine/platform-sdk/requirements.txt \
    && python -m pip --no-cache-dir install -r /engine/platform-sdk/eta/requirements.txt \
    && python -m pip --no-cache-dir install -e /engine/platform-sdk/. \
    && python -m pip --no-cache-dir install -e /engine/platform-sdk/eta/. \
    && python -m pip --no-cache-dir install -I tensorflow-gpu==1.12.0 \
    && python -m pip --no-cache-dir install --upgrade numpy==1.16.0 \
    && rm -rf /var/lib/apt

# Setup entrypoint
COPY main.bash /engine/main.bash
COPY main.py /engine/main.py
RUN mkdir -p /var/log
WORKDIR /engine
ENTRYPOINT ["bash", "main.bash"]
```

You can build your image from the above `Dockerfile` by running:

```shell
# Clone platform-sdk
git clone https://github.com/voxel51/platform-sdk
cd platform-sdk
git submodule init
git submodule update
cd ..

#
# Your custom setup here!
#

# Build image
docker build -t "<your-image-name>" .

# Cleanup
rm -rf platform-sdk
```


## Local testing

After you have built the Docker image for your custom image-based analytic,
you can test it locally on a directory of frames of your choice by running
the `test-image.bash` script in the
[examples/image-to-video](https://github.com/voxel51/platform-sdk/tree/develop/examples/image-to-video)
directory:

```shell
bash test-image.bash $IMAGE_NAME $FRAMES_DIR
```

In the above `IMAGE_NAME` is the name of your Docker image, and `FRAMES_DIR`
is the path to the directory of frames to process, which must be a relative
path to your working directory. The output labels are written to
`out/labels.json` file in your working directory.

The directory of frames must be populated with the syntax
`/path/to/frames/%06d.<ext>`, where `%06d` denotes the frame number of the
image (e.g., `000010` for frame 10), and `<ext>` is any valid image format.


## Docker deployment

Once your Docker image is ready for deployment, you must save it as a `.tar.gz`
file so that you can upload it to the Voxel51 Platform. To do so, simply
execute a command like:

```shell
docker save <your-image-name> | gzip -c > <your-image-name>.tar.gz
```

Finally, follow the instructions in the `Analytic deployment` section of the
[README](README.md) to publish your analytic to the platform.


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
