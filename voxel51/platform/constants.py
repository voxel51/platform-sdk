'''
Constants for the Voxel51 Platform SDK.

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

import os


# Directories
VOXEL51_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
BASE_DIR = os.path.dirname(VOXEL51_DIR)
TESTS_DIR = os.path.join(BASE_DIR, "tests")
