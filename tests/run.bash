#!/bin/bash
#
# Main test script. Spins up server and posts docker run command to copy/paste
# in a separate terminal. Note: `=` are required.
# Also supports --compute-type=gpu to indicate nvidia2 docker runtime.
# Default behavior is cpu.
#
# Usage:
#   ./run.sh --analytic-json=<path-to-json> \
#     --analytic-image=<image-name> \
#     --input-file=<path-to-input-file>
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#
# David Hodgson, david@voxel51.com
#

npm run start -- "$@"
