#!/bin/bash
# Platform analytic local testing server.
#
# Usage:
#   bash test-platform.bash -h
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#

THIS_DIR=$(dirname "$0")
npm start --prefix "${THIS_DIR}" -- "$@"
