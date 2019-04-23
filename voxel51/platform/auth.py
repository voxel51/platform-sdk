#!/usr/bin/env/python
'''
Authentication module for the Voxel51 Platform API.

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


class Token(object):
    '''A class encapsulating an API token.'''

    def __init__(self, private_key):
        '''Creates a Token with the given private key.

        Args:
            private_key (str): the private key of the token
        '''
        self.private_key = private_key

    def get_header(self):
        '''Gets a header dictionary for authenticating requests with this
        token.

        Returns:
            a header dictionary
        '''
        return {"X-Voxel51-Agent": self.private_key}
