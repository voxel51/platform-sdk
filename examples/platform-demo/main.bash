#!/bin/bash
# Main entrypoint for a Voxel51 Platform Analytic.
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#

#
# Don't change `LOGFILE_PATH`. The platform attaches a pre-stop hook to images
# at runtime that will upload the logfile from this location whenever a task is
# terminated unexpectedly (e.g., preemption, resource violation, etc.)
#
LOGFILE_PATH=/var/log/image.log
BACKUP_LOGFILE_PATH=/var/log/backup.log

#
# Execute analytic and pipe stdout/stderr to disk so that this information
# will be available in case of errors.
#
set -o pipefail
python main.py 2>&1 | tee "${BACKUP_LOGFILE_PATH}"

# Gracefully handle uncaught failures in analytic
if [ $? -ne 0 ]; then
    # Append backlog log
    echo "UNCAUGHT EXCEPTION; APPENDING BACKUP LOG" >> "${LOGFILE_PATH}"
    cat "${BACKUP_LOGFILE_PATH}" >> "${LOGFILE_PATH}"

    # Upload logfile
    curl -T "${LOGFILE_PATH}" -X PUT "${LOGFILE_SIGNED_URL}" &

    # Post job failure
    curl -X PUT "${API_BASE_URL}/jobs/${JOB_ID}/state" \
        -H "X-Voxel51-Agent: ${API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"state": "FAILED", "failure_type": "ANALYTIC"}' &

    wait
fi
