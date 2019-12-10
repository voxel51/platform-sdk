#!/usr/bin/env python
'''
Entrypoint for the `tf-slim-classifier-i2v` container.

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
from eta.classifiers import TFSlimClassifier, TFSlimClassifierConfig

import voxel51.image2video.core as voxc


logger = logging.getLogger(__name__)


NETWORK_NAME = "resnet_v2_50"
MODEL_PATH = "/engine/models/resnet_v2_50_imagenet.pb"
LABELS_PATH = "/engine/models/tfslim_imagenet_labels.txt"
CONFIDENCE_THRESHOLD = 0.3


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
    config = TFSlimClassifierConfig({
        "attr_name": "imagenet",
        "model_path": MODEL_PATH,
        "network_name": NETWORK_NAME,
        "labels_path": LABELS_PATH,
        "confidence_thresh" : CONFIDENCE_THRESHOLD,
    })
    return TFSlimClassifier(config)


def process_image(model, img):
    attrs = model.predict(img)
    return etai.ImageLabels(attrs=attrs)


if __name__ == "__main__":
    main()
