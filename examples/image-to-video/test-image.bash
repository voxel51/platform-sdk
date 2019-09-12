#!/bin/bash
# Run an Image-To-Video Docker image locally on an input directory of images
# of your choice.
#
# The frames directory that you provide must be relative to your working
# directory. The output labels are written to a `labels.json` file in your
# working directory.
#
# Usage:
#   bash test-image.bash IMAGE_NAME FRAMES_DIR
#
# Copyright 2019, Voxel51, Inc.
# voxel51.com
#
# Brian Moore, brian@voxel51.com
#

FRAMES_DIR="$(pwd)/$2"
LABELS_PATH="$(pwd)/labels.json"

docker run --rm \
    -v "${FRAMES_DIR}":/engine/frames/ \
    -v "${LABELS_PATH}":/engine/frame-labels.json \
    "$1"
