#!/usr/bin/env/python
'''
Core methods for the Image-To-Video tool in the Voxel51 Platform SDK.

| Copyright 2017-2019, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
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

import eta.core.image as etai
import eta.core.log as etal
import eta.core.utils as etau
import eta.core.video as etav


logger = logging.getLogger(__name__)


# Local paths; don't change these!
TASK_LOGFILE_PATH = "/var/log/image.log"
IMAGE_TO_VIDEO_FRAMES_DIR = "/shared/user/inputs/frames"
IMAGE_TO_VIDEO_LABELS_PATH = "/shared/user/outputs/labels.json"


class Predictions(object):
    '''Container for the predictions on individual frames of a video.

    Internally, the labels are stored in ``eta.core.video.VideoLabels``
    format, which is abstracted from the user of this class, for convenience.
    '''

    def __init__(self):
        '''Creates a Predictions instance.'''
        self.labels = etav.VideoLabels()

    def add(self, frame_number, image_labels):
        '''Adds labels for the given frame number to the collection.

        Args:
            frame_number (int): the frame number
            image_labels (ImageLabels): an ``eta.core.image.ImageLabels``
                describing the predictions for the given frame
        '''
        self.labels.add_frame(
            etav.VideoFrameLabels.from_image_labels(
                image_labels, frame_number))


def setup_logging():
    '''Configures system-wide logging so that all logging recorded via the
    builtin ``logging`` module will be appended to the logfile for the task.
    '''
    logging_config = etal.LoggingConfig.default()
    logging_config.filename = TASK_LOGFILE_PATH
    etal.custom_setup(logging_config, rotate=False)


def read_images():
    '''Returns an iterator over the images to process and their frame numbers
    in the source video.

    Returns:
        an iterator that emits ``(img, frame_number)`` tuples containing the
        images to predict and their associated frame numbers
    '''
    img_patt, frame_numbers = etau.parse_dir_pattern(IMAGE_TO_VIDEO_FRAMES_DIR)
    logger.info("Found %d frames",  len(frame_numbers))
    for frame_number in frame_numbers:
        logger.debug("Processing frame %d", frame_number)
        img = etai.read(img_patt % frame_number)
        yield img, frame_number


def write_predictions(predictions):
    '''Writes the predictions to disk.

    Args:
        predictions (Predictions): the predictions to write
    '''
    logger.info(
        "Writing labels for %d frames to '%s'", len(predictions.labels),
        IMAGE_TO_VIDEO_LABELS_PATH)
    predictions.labels.write_json(IMAGE_TO_VIDEO_LABELS_PATH)
