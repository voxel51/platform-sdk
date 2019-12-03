#!/bin/bash
# Main entrypoint for an Image-to-Video container.
#
# Syntax:
#   bash main.bash
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#
# Brian Moore, brian@voxel51.com
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
