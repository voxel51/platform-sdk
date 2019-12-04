#!/bin/bash
# Main entrypoint for an Image-to-Video container.
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
    #
    # An uncatught exception occurred when executing the analytic, so append
    # the backup log to the logfile, just in case
    #
    echo "UNCAUGHT EXCEPTION; APPENDING BACKUP LOG" >> "${LOGFILE_PATH}"
    cat "${BACKUP_LOGFILE_PATH}" >> "${LOGFILE_PATH}"
fi
