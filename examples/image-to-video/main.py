#!/usr/bin/env/python
'''
Example entrypoint for an Image-To-Video container.

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

import eta.core.data as etad
import eta.core.image as etai
import eta.core.geometry as etag
import eta.core.objects as etao

import voxel51.image2video.core as voxc


logger = logging.getLogger(__name__)


def main():
    '''Main method.'''
    # Setup logging
    voxc.setup_logging()

    # Load model
    logger.info("Loading model")
    model = load_model()

    # Perform predictions
    logger.info("Performing predictions")
    predictions = voxc.Predictions()
    for img, frame_number in voxc.read_images():
        image_labels = process_image(model, img)
        predictions.add(frame_number, image_labels)

    # Write predictions to disk
    logger.info("Writing predictions to disk")
    voxc.write_predictions(predictions)


def load_model():
    '''Loads the image-based model to use.

    Returns:
        the model
    '''
    # For this demo, there is no model
    return None


def process_image(model, img):
    '''Processes the given image through the given model and returns the
    predictions in ``eta.core.image.ImageLabels`` format.

    Args:
        model: the image-based model to use
        img: the image

    Returns:
        an ``eta.core.image.ImageLabels`` instance
    '''
    # For this demo, we simply generate a random ImageLabels
    image_labels = etai.ImageLabels()

    # Add an image attribute
    scene = random.choice(["urban", "rural", "resedential"])
    img_attr = etad.CategoricalAttribute("scene", scene, confidence=1)
    image_labels.add_image_attribute(img_attr)

    # Add an object
    obj = _generate_random_object("object", "demo", 1)
    image_labels.add_object(obj)

    return image_labels


def _generate_random_object(label, name, index):
    tlx = random.uniform(0.0, 0.8)
    tly = random.uniform(0.0, 0.8)
    tl = etag.RelativePoint(tlx, tly)
    br = etag.RelativePoint(tlx + 0.2, tly + 0.2)
    bbox = etag.BoundingBox(tl, br)
    obj = etao.DetectedObject(label, bbox, confidence=1, index=index)
    obj.add_attribute(etad.CategoricalAttribute("name", name))
    return obj


if __name__ == "__main__":
    main()
