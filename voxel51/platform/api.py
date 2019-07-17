#!/usr/bin/env/python
'''
Client for interacting with the Voxel51 Platform API.

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

import voxel51.platform.auth as voxa
import voxel51.platform.config as voxc
import voxel51.platform.utils as voxu


def make_api_client():
    '''Creates an :class:`API` instance for communicating with the Voxel51
    Platform API.

    Returns:
        an :class:`API` instance
    '''
    private_key = os.environ[voxc.API_TOKEN_ENV_VAR]
    token = voxa.Token(private_key)
    return API(token)


class API(object):
    '''Internal class for managing a session with the Voxel51 Platform API.

    Attributes:
        token (voxel51.platform.auth.Token): the Token for the session
        keep_alive (bool): whether the request session should be kept alive
            between requests
        base_url (str): the base URL of the API for the session
    '''

    def __init__(self, token, keep_alive=False):
        '''Starts a new API session.

        Args:
            token (voxel51.platform.auth.Token): the Token to use for the
                session
            keep_alive (bool, optional): whether to keep the request session
                alive between requests. By default, this is False
        '''
        self.token = token
        self.keep_alive = keep_alive
        self.base_url = os.environ[voxc.API_BASE_URL_ENV_VAR]

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
            :class:`APIError` if the request was unsuccessful
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
            :class:`APIError` if the request was unsuccessful
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
            :class:`APIError` if the request was unsuccessful
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


class APIError(Exception):
    '''Exception raised when an :class:`API` request fails.'''

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
            :class:`ValueError` if the given response is not an error response
            :class:`HTTPError` if the error was caused by the HTTP connection
        '''
        if res.ok:
            raise ValueError("Response is not an error")
        try:
            message = _parse_json_response(res)["error"]["message"]
        except ValueError:
            res.raise_for_status()
        return cls(message, res.status_code)


def _get_mime_type(path):
    return mimetypes.guess_type(path)[0] or "application/octet-stream"


def _validate_response(res):
    if not res.ok:
        raise APIError.from_response(res)


def _parse_json_response(res):
    return voxu.load_json(res.content)