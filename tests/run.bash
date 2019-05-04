#!/bin/bash
# Local test suite runner script.
#
# Usage:
# bash run.bash \
#     --analytic-image='image-name' \
#     --analytic-json='/path/to/analytic.json' \
#     [ --inputs='<input1>:<path1>,...' ] \
#     [ --params='{"<param1>": <value1>, ...}' ] \
#     [ --compute-type=cpu|gpu ]
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#
# David Hodgson, david@voxel51.com
#

npm run start -- "$@"
