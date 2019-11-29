#!/bin/bash
# Image-To-Video local testing script.
#
# To see usage:
#   test-i2v -h
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#

# Show usage information
usage() {
    echo "Usage:  bash $0 [-h] IMAGE_NAME FRAMES_DIR

Runs an Image-To-Video Docker image locally on an input directory of images
of your choice.

The frames directory that you provide must be relative to your working
directory. The output labels are written to `out/labels.json` in your working
directory.

optional arguments:
-h              show this help message and exit

positional arguments:
IMAGE_NAME      the name of the Image-To-Video Docker image to test
FRAMES_DIR      the directory of frames to process
"
}

# Parse flags
SHOW_HELP=false
while getopts "h" FLAG; do
    case "${FLAG}" in
        h) SHOW_HELP=true ;;
        *) usage ;;
    esac
done
[ ${SHOW_HELP} = true ] && usage && exit 0

FRAMES_DIR="$(pwd)/$2"
OUTPUT_DIR="$(pwd)/out"

docker run --rm \
    -v "${FRAMES_DIR}":/shared/user/inputs/frames/ \
    -v "${OUTPUT_DIR}":/shared/user/outputs/ \
    "$1"
