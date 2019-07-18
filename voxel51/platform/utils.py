#!/usr/bin/env/python
'''
Utilities for the Voxel51 Platform SDK.

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

import json
import os

from requests.adapters import HTTPAdapter
from requests.packages.urllib3.poolmanager import PoolManager

from eta.core.config import Config
import eta.core.image as etai
import eta.core.storage as etas
import eta.core.video as etav


_HTTP_CLIENT = None


class RemotePathConfig(Config):
    '''Class that describes the location of a remote file.'''

    def __init__(self, d):
        self.signed_url = self.parse_string(d, "signed-url")

    def __str__(self):
        return self.signed_url

    @staticmethod
    def is_path_config_dict(d):
        '''Determines whether ``d`` is a valid RemotePathConfig dictionary.'''
        try:
            RemotePathConfig(d)
            return True
        except:
            return False

    @classmethod
    def from_signed_url(cls, signed_url):
        '''Constructs a RemotePathConfig for the given signed URL.

        Args:
            signed_url (str): a signed URL

        Returns:
            a RemotePathConfig instance describing the given signed URL
        '''
        return cls({"signed-url": signed_url})


def get_metadata_for_video(video_path):
    '''Gets metadata about the given video.

    Args:
        video_path (str): the path to the video

    Returns:
        an ``eta.core.video.VideoMetadata`` instance describing the video
    '''
    return etav.VideoMetadata.build_for(video_path)


def get_metadata_for_image(image_path):
    '''Gets metadata about the given image.

    Args:
        image_path (str): the path to the image

    Returns:
        an ``eta.core.image.ImageMetadata`` instance describing the image
    '''
    return etai.ImageMetadata.build_for(image_path)


def download(path_config, output_dir):
    '''Downloads the specified file to the given directory.

    Args:
        path_config (RemotePathConfig): a RemotePathConfig describing the file
            to download
        output_dir (str): the directory to download the file to

    Returns:
        the local path to the downloaded file
    '''
    filename = etas.HTTPStorageClient.get_filename(path_config.signed_url)
    local_path = os.path.join(output_dir, filename)
    _get_http_client().download(path_config.signed_url, local_path)
    return local_path


def download_bytes(path_config):
    '''Downloads the specified file as bytes.

    Args:
        path_config (RemotePathConfig): a RemotePathConfig describing the file
            to download

    Returns:
        the bytes of the downloaded file
    '''
    return _get_http_client().download_bytes(path_config.signed_url)


def upload(local_path, path_config):
    '''Uploads the given file to the specified location.

    Args:
        local_path (str): the path to the file to upload
        path_config (RemotePathConfig): a RemotePathConfig describing where to
            upload the file
    '''
    _get_http_client().upload(local_path, path_config.signed_url)


def upload_bytes(bytes_str, path_config, content_type=None):
    '''Uploads the given bytes to the specified location.

    Args:
        bytes_str (str): the bytes to upload
        path_config (RemotePathConfig): a RemotePathConfig describing where to
            upload the bytes
        content_type (str, optional): a string specifying the content type of
            the file being uploaded
    '''
    _get_http_client().upload_bytes(
        bytes_str, path_config.signed_url, content_type=content_type)


def load_json(str_or_bytes):
    '''Loads JSON from string.

     Args:
        str_or_bytes (str): the input string or bytes

     Returns:
        a JSON list/dictionary
    '''
    try:
        return json.loads(str_or_bytes)
    except TypeError:
        # Must be a Python version for which json.loads() cannot handle bytes
        return json.loads(str_or_bytes.decode("utf-8"))


class SourcePortAdapter(HTTPAdapter):
    '''Custom :class:`requests.adapters.HTTPAdapter` that allows the source
    port to be specified.
    '''

    def __init__(self, source_port, *args, **kwargs):
        '''Creates a SourcePortAdapter instance.

        Args:
            source_port (int): the source port to use
            *args: valid positional arguments for
                :class:`requests.adapters.HTTPAdapter`
            **kwargs: valid keyword arguments for
                :class:`requests.adapters.HTTPAdapter`
        '''
        self._source_port = source_port
        super(SourcePortAdapter, self).__init__(*args, **kwargs)

    def init_poolmanager(self, connections, maxsize, block=False):
        self.poolmanager = PoolManager(
            num_pools=connections, maxsize=maxsize,
            block=block, source_address=("", self._source_port))


def _get_http_client():
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None:
        _HTTP_CLIENT = etas.HTTPStorageClient()
    return _HTTP_CLIENT
