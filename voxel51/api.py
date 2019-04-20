#!/usr/bin/env/python
'''
Client for interacting with the Voxel51 Vision Services API.

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

import mimetypes
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.poolmanager import PoolManager

import voxel51.auth as voxa
import voxel51.config as voxc
import voxel51.utils as voxu


def make_api_client():
    '''Creates an API instance for communicating with the Voxel51 Vision
    Services API.

    Returns:
        an API instance
    '''
    private_key = os.environ[voxc.API_TOKEN_ENV_VAR]
    deployment_env = os.environ[voxc.DEPLOYMENT_ENV_VAR]
    is_macos = voxu.is_macos()
    token = voxa.Token(private_key)
    return API(token, deployment_env=deployment_env, is_macos=is_macos)


class API(object):
    '''Internal class for managing a session with the Voxel51 Vision Services
    API.

    Attributes:
        token (Token): the Token for the session
        deployment_env (DeploymentEnvironments): the deployment
            environment for the session
        is_macos (bool): whether this session is running on macOS
        keep_alive (bool): whether the request session should be kept alive
            between requests
        base_url (str): the base URL of the API for the session
    '''

    def __init__(
            self, token, deployment_env=voxc.DeploymentEnvironments.PROD,
            is_macos=False, keep_alive=False):
        '''Starts a new API session.

        Args:
            token_path (Token): the Token to use for this session
            deployment_env (DeploymentEnvironments, optional): the deployment
                environment for this session. The default is
                ``voxel51.config.DeploymentEnvironments.PROD``
            is_macos (bool, optional): whether this job is running on macOS.
                The default is False
            keep_alive (bool, optional): whether to keep the request session
                alive between requests. By default, this is False
        '''
        self.token = token
        self.deployment_env = deployment_env
        self.is_macos = is_macos
        self.keep_alive = keep_alive
        self.base_url = self._get_base_url(deployment_env, is_macos)
        self._header = self.token.get_header()
        self._requests = requests.Session() if keep_alive else requests

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def close(self):
        '''Closes the HTTP session. Only needs to be called when
        ``keep_alive=True`` is passed to the constructor.
        '''
        if self.keep_alive:
            self._requests.close()

    def post_job_metadata(self, job_id, metadata):
        '''Posts metadata for the job with the given ID.

        Args:
            job_id (str): the job ID
            metadata (dict): the dictionary of metadata to post

        Raises:
            APIError if the request was unsuccessful
        '''
        endpoint = self.base_url + "/jobs/" + job_id + "/metadata"
        res = self._requests.post(
            endpoint, headers=self._header, json=metadata)
        _validate_response(res)

    def update_job_state(self, job_id, state, failure_type=None):
        '''Updates the state of the job with the given ID.

        Args:
            job_id (str): the job ID
            state (str): the new job state
            failure_type (str, optional): the job failure type, if any

        Raises:
            APIError if the request was unsuccessful
        '''
        endpoint = self.base_url + "/jobs/" + job_id + "/state"

        data = {"state": state}
        if failure_type is not None:
            data["failure_type"] = failure_type

        res = self._requests.put(endpoint, headers=self._header, json=data)
        _validate_response(res)

    def upload_job_output_as_data(self, job_id, path):
        '''Uploads the job output as data to the user's account.

        Args:
            job_id (str): the job ID
            path (str): the path to the data to upload

        Returns:
            the ID of the uploaded data

        Raises:
            APIError if the request was unsuccessful
        '''
        endpoint = self.base_url + "/jobs/" + job_id + "/data"
        filename = os.path.basename(path)
        mime_type = _get_mime_type(path)
        with open(path, "rb") as df:
            files = {"file": (filename, df, mime_type)}
            res = self._requests.post(
                endpoint, files=files, headers=self._header)
        _validate_response(res)
        return _parse_json_response(res)["data"]["data_id"]

    @staticmethod
    def _get_base_url(deployment_env, is_macos):
        base_url = voxc.BASE_API_URLS[deployment_env]
        return voxu.handle_macos_localhost(base_url) if is_macos else base_url


class APIError(Exception):
    '''Exception raised when an API request fails.'''

    def __init__(self, message, code):
        '''Creates a new APIError object.

        Args:
            message (str): the error message
            code (int): the error code
        '''
        super(APIError, self).__init__("%d: %s" % (code, message))

    @classmethod
    def from_response(cls, res):
        '''Constructs an APIError from a requests reponse.

        Args:
            res (requests.Response): a requests response

        Returns:
            an instance of APIError

        Raises:
            ValueError: if the given response is not an error response
            HTTPError: if the error was caused by the HTTP connection, not
                the API itself
        '''
        if res.ok:
            raise ValueError("Response is not an error")
        try:
            message = _parse_json_response(res)["error"]["message"]
        except ValueError:
            res.raise_for_status()
        return cls(message, res.status_code)


class SourcePortAdapter(HTTPAdapter):
    '''Custom HTTPAdapter that allows the source port to be specified.'''

    def __init__(self, source_port, *args, **kwargs):
        self._source_port = source_port
        super(SourcePortAdapter, self).__init__(*args, **kwargs)

    def init_poolmanager(self, connections, maxsize, block=False):
        self.poolmanager = PoolManager(
            num_pools=connections, maxsize=maxsize,
            block=block, source_address=("", self._source_port))


def _get_mime_type(path):
    return mimetypes.guess_type(path)[0] or "application/octet-stream"


def _validate_response(res):
    if not res.ok:
        raise APIError.from_response(res)


def _parse_json_response(res):
    return voxu.load_json(res.content)
