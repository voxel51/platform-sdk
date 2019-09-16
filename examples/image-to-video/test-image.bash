#!/bin/bash
# Run an Image-To-Video Docker image locally on an input directory of images
# of your choice.
#
# The frames directory that you provide must be relative to your working
# directory. The output labels are written to `out/labels.json` in your working
# directory.
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
OUTPUT_DIR="$(pwd)/out"

docker run --rm \
    -v "${FRAMES_DIR}":/shared/user/inputs/frames/ \
    -v "${OUTPUT_DIR}":/shared/user/outputs/ \
    "$1"
