#!/usr/bin/env python
'''
Entrypoint for the `tf-models-segmenter-i2v` container.

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

import eta.core.image as etai
from eta.detectors import TFModelsSegmenter, TFModelsSegmenterConfig

import voxel51.image2video.core as voxc


logger = logging.getLogger(__name__)


MODEL_PATH = "/engine/models/frozen_inference_graph.pb"
LABELS_PATH = "/engine/models/mscoco_label_map.pbtxt"
CONFIDENCE_THRESHOLD = 0.3
MASK_THRESHOLD = 0.5


def main():
    voxc.setup_logging()

    logger.info("Loading model")
    model = load_model()

    with model:
        logger.info("Performing predictions")
        predictions = voxc.Predictions()
        for img, frame_number in voxc.read_images():
            image_labels = process_image(model, img)
            predictions.add(frame_number, image_labels)

    logger.info("Writing predictions to disk")
    voxc.write_predictions(predictions)


def load_model():
    config = TFModelsSegmenterConfig({
        "model_path": MODEL_PATH,
        "labels_path": LABELS_PATH,
        "mask_thresh": MASK_THRESHOLD,
        "confidence_thresh": CONFIDENCE_THRESHOLD,
    })
    return TFModelsSegmenter(config)


def process_image(model, img):
    objects = model.detect(img)
    return etai.ImageLabels(objects=objects)


if __name__ == "__main__":
    main()
