'''
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

from pkgutil import extend_path

#
# This statement allows multiple `voxel51.XXX` packages to be installed in the
# same environment and used simultaneously.
#
# https://docs.python.org/2/library/pkgutil.html#pkgutil.extend_path
#
__path__ = extend_path(__path__, __name__)
