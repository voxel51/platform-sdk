#!/usr/bin/env/python
'''
Utilities for the Voxel51 Vision Analytics SDK.

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

try:
    import urllib.parse as urlparse  # Python 3
except ImportError:
    import urlparse  # Python 2

from eta.core.config import Config
import eta.core.storage as etas
import eta.core.video as etav

import voxel51.config as voxc


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


def is_macos():
    '''Determines whether the current platform is Mac.

    Returns:
        True/False if the current operating system is macOS
    '''
    return os.environ.get(voxc.OS_ENV_VAR, "").lower() == "darwin"


def handle_macos_localhost(url):
    '''Converts ``localhost`` to ``docker.for.mac.localhost`` in the given URL,
    if necessary, when running on macOS. This is required for Docker containers
    running on macOS.

    Args:
        url (str): a URL

    Returns:
        a URL with ``localhost`` replaced with ``docker.for.mac.localhost``,
            if necessary
    '''
    if not is_macos():
        return url

    chunks = list(urlparse.urlsplit(url))
    netloc = chunks[1].split(":", 1)
    hostname = netloc[0]
    if hostname == "localhost" or hostname.startswith("127.0.0."):
        netloc[0] = "docker.for.mac.localhost"
        chunks[1] = ":".join(netloc)
        url = urlparse.urlunsplit(chunks)
    return url


def get_metadata_for_video(video_path):
    '''Gets metadata about the given video.

    Args:
        video_path (str): the path to the video

    Returns:
        a VideoMetadata instance describing the video
    '''
    return etav.VideoMetadata.build_for(video_path)


def download(path_config, output_dir):
    '''Downloads the specified file to the given directory.

    Args:
        path_config (RemotePathConfig): a RemotePathConfig describing the file
            to download
        output_dir (str): the directory to download the file to

    Returns:
        the local path to the downloaded file
    '''
    url = handle_macos_localhost(path_config.signed_url)
    filename = etas.HTTPStorageClient.get_filename(url)
    local_path = os.path.join(output_dir, filename)
    _get_http_client().download(url, local_path)
    return local_path


def download_bytes(path_config):
    '''Downloads the specified file as bytes.

    Args:
        path_config (RemotePathConfig): a RemotePathConfig describing the file
            to download

    Returns:
        the bytes of the downloaded file
    '''
    url = handle_macos_localhost(path_config.signed_url)
    return _get_http_client().download_bytes(url)


def upload(local_path, path_config):
    '''Uploads the given file to the specified location.

    Args:
        local_path (str): the path to the file to upload
        path_config (RemotePathConfig): a RemotePathConfig describing where to
            upload the file
    '''
    url = handle_macos_localhost(path_config.signed_url)
    _get_http_client().upload(local_path, url)


def upload_bytes(bytes_str, path_config, content_type=None):
    '''Uploads the given bytes to the specified location.

    Args:
        bytes_str (str): the bytes to upload
        path_config (RemotePathConfig): a RemotePathConfig describing where to
            upload the bytes
        content_type (str, optional): a string specifying the content type of
            the file being uploaded
    '''
    url = handle_macos_localhost(path_config.signed_url)
    _get_http_client().upload_bytes(bytes_str, url, content_type=content_type)


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


def _get_http_client():
    global _HTTP_CLIENT
    if _HTTP_CLIENT is None:
        _HTTP_CLIENT = etas.HTTPStorageClient()
    return _HTTP_CLIENT
