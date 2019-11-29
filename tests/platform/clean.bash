#!/bin/bash
# Cleans up generated test files.
#
# Usage:
#   bash clean.bash
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#

THIS_DIR=$(dirname "$0")
node "${THIS_DIR}/server/cleanup.js" "$@"
