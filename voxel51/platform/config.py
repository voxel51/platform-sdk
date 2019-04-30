#!/usr/bin/env/python
'''
Configuration settings for the Voxel51 Platform SDK.

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


#
# The environment variable that will hold the URL from which to download the
# TaskConfig for the task
#
TASK_DESCRIPTION_ENV_VAR = "TASK_DESCRIPTION"

#
# The environment variable that holds the ID of the job being executed
#
JOB_ID_ENV_VAR = "JOB_ID"

#
# The environment variable that will contain the API token to use to
# communicate with the Platform API
#
API_TOKEN_ENV_VAR = "API_TOKEN"

#
# The environment variable that holds the base URL of the API
#
API_BASE_URL_ENV_VAR = "API_BASE_URL"

#
# The environment variable that will hold the platform on which the Platform
# API is running
#
OS_ENV_VAR = "OS"
