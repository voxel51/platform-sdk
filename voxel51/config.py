#!/usr/bin/env/python
'''
Configuration settings for the Voxel51 Vision Analytics SDK.

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
# The environment variable that will contain the API token to use to
# communicate with the Vision Services API
#
API_TOKEN_ENV_VAR = "API_TOKEN"

#
# The environment variable that will specify which deployment environment the
# Vision Services API is currently operating in
#
DEPLOYMENT_ENV_VAR = "ENV"

#
# The environment variable that will hold the platform on which the Vision
# Services API is running
#
OS_ENV_VAR = "OS"

#
# The environment variable that will hold the URL from which to download the
# TaskConfig for the task
#
TASK_DESCRIPTION_ENV_VAR = "TASK_DESCRIPTION"


class DeploymentEnvironments(object):
    '''Class enumerating the possible deployment environments.'''

    DEV = "DEV"
    STAGING = "STAGING"
    PROD = "PROD"
    LOCAL = "LOCAL"

#
# The base API URLs to use for each deployment environment
#
BASE_API_URLS = {
    DeploymentEnvironments.DEV: "https://dev.api.voxel51.com/v1",
    DeploymentEnvironments.STAGING: "https://staging.api.voxel51.com/v1",
    DeploymentEnvironments.PROD: "https://api.voxel51.com/v1",
    DeploymentEnvironments.LOCAL: "http://127.0.0.1:4000/v1",
}
