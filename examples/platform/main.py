#!/usr/bin/env/python
'''
Main entrypoint for the `platform-demo` analytic.

Copyright 2017-2019, Voxel51, Inc.
voxel51.com

Brian Moore, brian@voxel51.com
'''
# pragma pylint: disable=redefined-builtin
# pragma pylint: disable=unused-wildcard-import
# pragma pylint: disable=wildcard-import
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals
from builtins import *
# pragma pylint: enable=redefined-builtin
# pragma pylint: enable=unused-wildcard-import
# pragma pylint: enable=wildcard-import

import logging
import random
import sys

import eta.core.data as etad
import eta.core.geometry as etag
import eta.core.objects as etao
import eta.core.video as etav

import voxel51.platform.task as voxt


TASK_LOGFILE_PATH = "/var/log/image.log"  # Don't change this path
INPUTS_DIR = "/engine/task/inputs"
OUTPUT_PATH = "/engine/task/output.txt"


logger = logging.getLogger(__name__)


def _generate_random_object(label, name, index):
    tlx = random.uniform(0.0, 0.8)
    tly = random.uniform(0.0, 0.8)
    tl = etag.RelativePoint(tlx, tly)
    br = etag.RelativePoint(tlx + 0.2, tly + 0.2)
    bbox = etag.BoundingBox(tl, br)
    obj = etao.DetectedObject(label, bbox, confidence=1, index=index)
    obj.add_attribute(etad.CategoricalAttribute("name", name))
    return obj


def _generate_random_labels(video_path, labels_path):
    metadata = etav.VideoMetadata.build_for(video_path)
    labels = etav.VideoLabels()
    for frame_number in range(1, metadata.total_frame_count + 1):
        obj = _generate_random_object("object", "demo", 1)
        labels.add_object(obj, frame_number)
    labels.write_json(labels_path)


def main():
    '''Main entrypoint for the `platform-demo` analytic.'''
    # Setup logging
    voxt.setup_logging(TASK_LOGFILE_PATH)

    # Get task config URL
    task_config_url = voxt.get_task_config_url()

    try:
        # Create a TaskManager for the task
        task_manager = voxt.TaskManager.from_url(task_config_url)
    except:
        voxt.fail_epically()
        return

    try:
        # Mark the task as started
        task_manager.start()

        # Download inputs/parameters
        inputs = task_manager.download_inputs(INPUTS_DIR)
        parameters = task_manager.parse_parameters()

        # Record metadata
        video_path = inputs["video"]
        task_manager.record_input_metadata("video", video_path=video_path)
        task_manager.post_job_metadata(video_path=video_path)

        # Generate random labels
        logger.info("Generating random labels for video")
        _generate_random_labels(video_path, OUTPUT_PATH)

        # Upload output
        task_manager.upload_output(OUTPUT_PATH)

        # Mark task as complete
        task_manager.complete(logfile_path=TASK_LOGFILE_PATH)
    except:
        task_manager.fail_gracefully(
            failure_type=voxt.TaskFailureType.USER,
            logfile_path=TASK_LOGFILE_PATH)


if __name__ == "__main__":
    main()
