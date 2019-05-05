#!/bin/bash
# Local testing server runner script.
#
# To see usage:
#   bash run.bash --help
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#
# Brian Moore, brian@voxel51.com
#

node "$(dirname "$0")/server/index.js" "$@"
