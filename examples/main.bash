#!/bin/bash
# Main entrypoint for the `platform-demo` analytic.
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#
# Brian Moore, brian@voxel51.com
#

# Don't change this path
LOGFILE_PATH=/var/log/image.log

# Run analytic
# Pipes stdout/stderr to disk so that we can post it manually in case of errors
python {{entrypoint}} > "${LOGFILE_PATH}" 2>&1

# Gracefully handle uncaught failures in analytic
if [ $? -ne 0 ]; then
    # The task failed, so...

    # Upload the logfile
    curl -T "${LOGFILE_PATH}" -X PUT "${LOGFILE_SIGNED_URL}" &

    # Post the job failure
    curl -X PUT "${API_BASE_URL}/jobs/${JOB_ID}/state" \
        -H "X-Voxel51-Agent: ${API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"state": "FAILED", "failure_type": "ANALYTIC"}' &

    wait
fi
