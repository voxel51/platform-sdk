#!/usr/bin/env python
'''
Entrypoint for the `tf-semantic-segmenter-i2v` container.

Copyright 2017-2020, Voxel51, Inc.
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

from eta.segmenters import TFSemanticSegmenter, TFSemanticSegmenterConfig

import voxel51.image2video.core as voxc


logger = logging.getLogger(__name__)


MODEL_PATH = "/engine/models/frozen_inference_graph.pb"
LABELS_PATH = "/engine/models/cityscapes-train-labels.txt"


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

    # Store mask index, if available
    if model.exposes_mask_index:
        predictions.labels.mask_index = model.get_mask_index()

    logger.info("Writing predictions to disk")
    voxc.write_predictions(predictions)


def load_model():
    config = TFSemanticSegmenterConfig({
        "model_path": MODEL_PATH,
        "labels_path": LABELS_PATH,
        "resize_to_max_dim": 513,
        "input_name": "ImageTensor",
        "output_name": "SemanticPredictions"
    })
    return TFSemanticSegmenter(config)


def process_image(model, img):
    return model.segment(img)


if __name__ == "__main__":
    main()
