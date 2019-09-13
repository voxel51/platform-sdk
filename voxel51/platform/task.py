#!/usr/bin/env/python
'''
Task management module for the Voxel51 Platform SDK.

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
from future.utils import iteritems
# pragma pylint: enable=redefined-builtin
# pragma pylint: enable=unused-wildcard-import
# pragma pylint: enable=wildcard-import

import logging
import os
import sys

from eta.core.config import Config
import eta.core.log as etal
from eta.core.serial import Serializable
import eta.core.utils as etau

import voxel51.platform.api as voxa
import voxel51.platform.config as voxc
import voxel51.platform.utils as voxu


_API_CLIENT = None


logger = logging.getLogger(__name__)


class TaskConfig(Config):
    '''Class that describes a request to run a job.'''

    def __init__(self, d):
        self.analytic = self.parse_string(d, "analytic")
        self.version = self.parse_string(d, "version")
        self.job_id = self.parse_string(d, "job_id")
        self.inputs = self.parse_object_dict(
            d, "inputs", voxu.RemotePathConfig, default={})
        self.parameters = self.parse_dict(d, "parameters", default={})
        self.status = self.parse_object(d, "status", voxu.RemotePathConfig)
        self.logfile = self.parse_object(d, "logfile", voxu.RemotePathConfig)
        self.output = self.parse_object(
            d, "output", voxu.RemotePathConfig, default=None)


class TaskState(object):
    '''Enum describing the possible states of a task.'''

    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class TaskFailureType(object):
    '''Enum describing the possible reasons for a failed task.'''

    USER = "USER"
    ANALYTIC = "ANALYTIC"
    PLATFORM = "PLATFORM"
    NONE = "NONE"


class TaskManager(object):
    '''Class for managing the execution of a task.'''

    def __init__(self, task_config, task_status=None):
        '''Creates a TaskManager instance.

        Args:
            task_config (TaskConfig): a TaskConfig instance
            task_status (TaskStatus, optional): an optional TaskStatus instance
                to use. If not provided, the default TaskStatus is created
        '''
        self.task_config = task_config
        if task_status is not None:
            self.task_status = task_status
        else:
            self.task_status = make_task_status(task_config)

    @classmethod
    def from_url(cls, task_config_url):
        '''Creates a TaskManager for the TaskConfig downloadable from the given
        URL.

        Args:
            task_config_url (str): a URL from which to download a
                :class:`TaskConfig`

        Returns:
            a TaskManager instance
        '''
        task_config = download_task_config(task_config_url)
        return cls(task_config)

    def start(self):
        '''Marks the task as started and publishes the :class:`TaskStatus` to
        the platform.
        '''
        start_task(self.task_status)

    def pause(self, config_path, status_path):
        '''Pauses the task by writing the :class:`TaskConfig` and current
        :class:`TaskStatus` to disk locally.

        To resume a task and retrieve the associated :class:`TaskManger`, use
        :func:`resume_task`.

        Args:
            config_path (str): local path to write the TaskConfig
            status_path (str): local path to write the TaskStatus
        '''
        pause_task(
            self.task_config, self.task_status, config_path, status_path)

    def download_inputs(self, inputs_dir):
        '''Downloads the task inputs.

        Args:
            inputs_dir (str): the directory to which to download the inputs

        Returns:
            a dictionary mapping input names to filepaths
        '''
        return download_inputs(inputs_dir, self.task_config, self.task_status)

    def parse_parameters(self, data_params_dir=None):
        '''Parses the task parameters.

        Args:
            data_params_dir (str, optional): the directory to which to download
                data (non-builtin) parameters, if any. By default, this is None

        Returns:
            a dictionary mapping parameter names to values (builtin parameters)
            or paths (data parameters)
        '''
        return parse_parameters(
            self.task_config, self.task_status,
            data_params_dir=data_params_dir)

    def get_path_for_input(self, name, inputs_dir):
        '''Gets the filepath for the task input with the given name.

        Note that this function does not check if the input actually exists at
        the returned location.

        Args:
            name (str): the name of the input
            inputs_dir (str): the directory for the inputs

        Returns:
            the local filepath to the input
        '''
        path_config = self.task_config.inputs[name]
        return voxu.get_download_path(path_config, inputs_dir)

    def get_path_for_data_parameter(self, name, data_params_dir):
        '''Gets the filepath for the data parameter with the given name.

        Note that this function does not check if the parameter actually exists
        at the returned location.

        Args:
            name (str): the name of the data parameter
            data_params_dir (str): the directory for the data parameters

        Returns:
            the local filepath to the data parameter
        '''
        val = self.task_config.parameters[name]
        if not voxu.RemotePathConfig.is_path_config_dict(val):
            raise ValueError("Parameter '%s' is not a data parameter" % name)

        path_config = voxu.RemotePathConfig(val)
        return voxu.get_download_path(path_config, data_params_dir)

    def record_input_metadata(
            self, name, image_path=None, video_path=None, metadata=None):
        '''Records metadata about the given input.

        Exactly one of the keyword arguments must be provided.

        If the input is an image or video, it is recommended to use the
        `image_path` or `video_path` keyword argument, respectively, so that
        the SDK controls the format of the metadata that is reported to the
        platform.

        You can use the `metadata` argument to provide an arbitrary (JSON
        serializable) dictionary of metadata about the input. Note, however,
        that certain platform console features such as output preview may not
        work if you use a custom `metadtaa` format.

        Args:
            name (str): the input name
            image_path (str, optional): (for image inputs only) the path to the
                input image. If provided, the metadata is computed for you via
                ``eta.core.image.ImageMetadata``
            video_path (str, optional): (for video inputs only) the path to the
                input video. If provided, the metadata is computed for you via
                ``eta.core.video.VideoMetadata``
            metadata (dict, optional): a metadata dict describing the input
        '''
        if image_path:
            metadata = voxu.get_metadata_for_image(image_path).serialize()
        if video_path:
            metadata = voxu.get_metadata_for_video(video_path).serialize()
        self.task_status.record_input_metadata(name, metadata)

    def post_job_metadata(self, image_path=None, video_path=None):
        '''Posts the job metadata for the task.

        Exactly one keyword argument must be provided.

        Note that this function currently only supports jobs that process a
        single image or video.

        Args:
            image_path (str, optional): the path to the input image for the job
            video_path (str, optional): the path to the input video for the job
        '''
        if image_path:
            post_job_metadata_for_image(
                image_path, self.task_config, self.task_status)
        if video_path:
            post_job_metadata_for_video(
                video_path, self.task_config, self.task_status)

    def add_status_message(self, msg):
        '''Adds the given status message to the :class:`TaskStatus` for the
        task. The status is not yet published to the platform.

        Args:
            msg (str): a status message
        '''
        self.task_status.add_message(msg)

    def publish_status(self):
        '''Publishes the current status of the task to the platform.'''
        self.task_status.publish()

    def upload_output(self, output_path):
        '''Uploads the task output.

        Args:
            output_path (str): the local path to the output file to upload
        '''
        upload_output(output_path, self.task_config, self.task_status)

    def upload_output_as_data(self, name, output_path):
        '''Uploads the given task output as data on behalf of the user.

        Args:
            name (str): the name of the output
            output_path (str): the local path to the output file to upload
        '''
        upload_output_as_data(
            name, output_path, self.task_config, self.task_status)

    def complete(self, logfile_path=None):
        '''Marks the task as complete and publishes the :class:`TaskStatus` to
        the platform.

        Args:
            logfile_path (str): an optional path to a logfile to upload for the
                task
        '''
        complete_task(
            self.task_config, self.task_status, logfile_path=logfile_path)

    def fail_gracefully(self, failure_type=None, logfile_path=None):
        '''Marks the task as failed and gracefully winds up by posting any
        available information (status, logfile, etc.) to the platform.

        Args:
            failure_type (TaskFailureType, optional): an optional failure
                reason for the task
            logfile_path (str): an optional local path to a logfile for the
                task
        '''
        fail_gracefully(
            self.task_config, self.task_status, failure_type=failure_type,
            logfile_path=logfile_path)


class TaskStatus(Serializable):
    '''Class for recording the status of a task.

    Attributes:
        analytic (str): name of the analytic
        version (str): version of the analytic
        state (TaskState): state of the task
        start_time (str): time the task was started, or None if not started
        complete_time (str): time the task was completed, or None if not
            completed
        fail_time (str): time the task failed, or None if not failed
        failure_type (TaskFailureType): the TaskFailureType of the task, if
            applicable
        messages (list): list of :class:`TaskStatusMessage` instances for the
            task
        inputs (dict): a dictionary containing metadata about the inputs to the
            task
        posted_data (dict): a dictionary mapping names of outputs posted as
            data to their associated data IDs
    '''

    def __init__(
            self,
            analytic=None,
            version=None,
            state=TaskState.SCHEDULED,
            start_time=None,
            complete_time=None,
            fail_time=None,
            failure_type=TaskFailureType.NONE,
            messages=None,
            inputs=None,
            posted_data=None
        ):
        '''Creates a TaskStatus instance.

        Args:
            analytic (str): the name of the analytic
            version (str, optional): the version of the analytic
            state (TaskState, optional): the state of the task
            start_time (str, optional): the time the task was started, if
                applicable
            complete_time (str, optional): the time the task was completed, if
                applicable
            fail_time (str, optional): the time the task failed, if applicable
            failure_type (TaskFailureType, optional): the
                :class:`TaskFailureType` of the task, if applicable
            messages (list, optional): list of :class:`TaskStatusMessage`
                instances for the task, if any
            inputs (dict, optional): a dictionary containing metadata about the
                inputs to the task, if any
            posted_data (dict, optional): a dictionary mapping names of
                outputs, if any, posted as data to their associated data IDs
        '''
        self.analytic = analytic or ""
        self.version = version
        self.state = state
        self.start_time = start_time
        self.complete_time = complete_time
        self.fail_time = fail_time
        self.failure_type = failure_type
        self.messages = messages or []
        self.inputs = inputs or {}
        self.posted_data = posted_data or {}
        self._publish_callback = None

    @classmethod
    def build_for(cls, task_config):
        '''Builds a TaskStatus for recording the status of the task specified
        by the given TaskConfig.

        Args:
            task_config (TaskConfig): a TaskConfig describing the task

        Returns:
            a TaskStatus instance
        '''
        task_status = cls(
            analytic=task_config.analytic, version=task_config.version)
        publish_callback = make_publish_callback(
            task_config.job_id, task_config.status)
        task_status.set_publish_callback(publish_callback)
        return task_status

    def record_input_metadata(self, name, metadata):
        '''Records metadata about the given input.

        Args:
            name (str): the input name
            metadata (dict): a dictionary or ``eta.core.serial.Serializable``
                object describing the input
        '''
        self.inputs[name] = metadata

    def record_posted_data(self, name, data_id):
        '''Records the ID of data posted to the cloud on the user's behalf.

        Args:
            name (str): the output name
            data_id (str): the ID of the posted data in cloud storage
        '''
        self.posted_data[name] = data_id

    def start(self, msg="Task started"):
        '''Marks the task as started.

        Args:
            msg (str, optional): a message to log
        '''
        self.start_time = self.add_message(msg)
        self.state = TaskState.RUNNING

    def complete(self, msg="Task complete"):
        '''Marks the task as complete.

        Args:
            msg (str, optional): a message to log
        '''
        self.complete_time = self.add_message(msg)
        self.state = TaskState.COMPLETE

    def fail(self, failure_type=None, msg="Task failed"):
        '''Marks the task as failed.

        Args:
            failure_type (TaskFailureType, optional): an optional failure
                reason for the task
            msg (str, optional): an optional message to log
        '''
        self.fail_time = self.add_message(msg)
        self.state = TaskState.FAILED
        if failure_type is not None:
            self.failure_type = failure_type

    def add_message(self, msg):
        '''Adds the given message to the status. Messages are timestamped and
        stored in an internal messages list.

        Args:
            msg (str): a message to log

        Returns:
            the timestamp of the message
        '''
        message = TaskStatusMessage(msg)
        self.messages.append(message)
        return message.time

    def set_publish_callback(self, publish_callback):
        '''Sets the callback to use when `publish()` is called.

        Args:
            publish_callback: a function that accepts a :class:`TaskStatus`
                object and performs some desired action with it
        '''
        self._publish_callback = publish_callback

    def publish(self):
        '''Publishes the task status using
        :func:`TaskStatus._publish_callback``.
        '''
        if self._publish_callback:
            self._publish_callback(self)

    def attributes(self):
        '''Returns a list of class attributes to be serialized.'''
        return [
            "analytic", "version", "state", "start_time", "complete_time",
            "fail_time", "failure_type", "messages", "inputs", "posted_data"]

    @classmethod
    def from_dict(cls, d):
        '''Constructs a :class:`TaskStatus` instance from a JSON dictionary.

        Args:
            d (dict): a JSON dictionary

        Returns:
            a TaskStatus instance
        '''
        analytic = d["analytic"]
        version = d["version"]
        state = d["state"]
        start_time = d["start_time"]
        complete_time = d["complete_time"]
        fail_time = d["fail_time"]
        failure_type = d["failure_type"]
        messages = [TaskStatusMessage.from_dict(md) for md in d["messages"]]
        # Note that we are not parsing Serializable objects here, if any
        inputs = d["inputs"]
        posted_data = d["posted_data"]
        return cls(
            analytic=analytic, version=version, state=state,
            start_time=start_time, complete_time=complete_time,
            fail_time=fail_time, failure_type=failure_type, messages=messages,
            inputs=inputs, posted_data=posted_data)


class TaskStatusMessage(Serializable):
    '''Class encapsulating a task status message with a timestamp.

    Attributes:
        message (str): the message string
        time (str): the timestamp string
    '''

    def __init__(self, message, time=None):
        '''Creates a TaskStatusMessage instance.

        Args:
            message (str): a message string
            time (str, optional): an optional time string. If not provided, the
                current time in ISO 8601 format is used
        '''
        self.message = message
        self.time = time or etau.get_isotime()

    def attributes(self):
        '''Returns a list of class attributes to be serialized.'''
        return ["message", "time"]


def setup_logging(logfile_path, rotate=True):
    '''Configures system-wide logging so that all logging recorded via the
    builtin ``logging`` module will be written to the given logfile path.

    Args:
        logfile_path (str): the desired log path
        rotate (bool, optional): whether to rotate any existing logfiles (True)
            or append to any existing logfiles (False). By default, this is
            True
    '''
    logging_config = etal.LoggingConfig.default()
    logging_config.filename = logfile_path
    etal.custom_setup(logging_config, rotate=rotate)


def get_task_config_url():
    '''Gets the :class:`TaskConfig` URL for this task from the
    ``voxel51.platform.config.TASK_DESCRIPTION_ENV_VAR`` environment variable.

    Returns:
        the URL from which the :class:`TaskConfig` for the task can be read
    '''
    return os.environ[voxc.TASK_DESCRIPTION_ENV_VAR]


def download_task_config(task_config_url):
    '''Downloads the :class:`TaskConfig` from the given URL.

    Args:
        task_config_url (str): the URL from which the :class:`TaskConfig` can
            be read

    Returns:
        the TaskConfig instance
    '''
    path_config = voxu.RemotePathConfig.from_signed_url(task_config_url)
    task_config_str = voxu.download_bytes(path_config)
    logger.info("TaskConfig downloaded from %s", task_config_url)
    return TaskConfig.from_str(task_config_str)


def make_task_status(task_config):
    '''Makes a :class:`TaskStatus` instance for the given :class:`TaskConfig`.

    Args:
        task_config (TaskConfig): a TaskConfig instance describing the task

    Returns:
        a :class:`TaskStatus` instance for tracking the progress of the task
    '''
    task_status = TaskStatus.build_for(task_config)
    logger.info("TaskStatus instance created")
    return task_status


def start_task(task_status):
    '''Marks the task as started and publishes the :class:`TaskStatus` to the
    platform.

    Args:
        task_status (TaskStatus): the TaskStatus for the task
    '''
    logger.info("Task started")
    task_status.start()
    task_status.publish()


def pause_task(task_config, task_status, config_path, status_path):
    '''Pauses the task by writing the the :class:`TaskConfig` and
    :class:`TaskStatus` to local disk.

    Args:
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task
        config_path (str): path to write the TaskConfig
        status_path (str): path to write the TaskStatus
    '''
    print(task_config)
    print(status_status)
    task_config.write_json(config_path)
    task_status.write_json(status_path)


def resume_task(config_path, status_path, task_status_cls=TaskStatus):
    '''Resumes the task specified by the given :class:`TaskConfig` and
    :class:`TaskStatus` by reading them from disk.

    Args:
        config_path (str): the path from which to load the TaskConfig
        status_path (str): the path from which to read the TaskStatus
        task_status_cls (type, optional): an optional TaskStatus subclass type
            to use to load the TaskStatus

    Returns:
        a TaskManager instance
    '''
    task_config = TaskConfig.from_json(config_path)
    task_status = task_status_cls.from_json(status_path)

    publish_callback = make_publish_callback(
        task_config.job_id, task_config.status)
    task_status.set_publish_callback(publish_callback)

    return TaskManager(task_config, task_status=task_status)


def make_publish_callback(job_id, status_path_config):
    '''Makes a callback function that can be called to publish the status of an
    ongoing task.

    Args:
        job_id (str): the ID of the underlying job
        status_path_config (voxel51.platform.utils.RemotePathConfig): a
            RemotePathConfig specifying how to publish the :class:`TaskStatus`

    Returns:
        a function that can publish a :class:`TaskStatus` instance via the
        syntax :func:`publish_callback(task_status)`
    '''
    def _publish_status(task_status):
        voxu.upload_bytes(
            task_status.to_str(), status_path_config,
            content_type="application/json")
        logger.info("Task status written to cloud storage")

        if task_status.state == TaskState.FAILED:
            failure_type = task_status.failure_type
        else:
            failure_type = None

        _get_api_client().update_job_state(
            job_id, task_status.state, failure_type=failure_type)
        if task_status.state == TaskState.FAILED:
            logger.info(
                "Job state %s (%s) posted to API", task_status.state,
                failure_type)
        else:
            logger.info("Job state %s posted to API", task_status.state)

    return _publish_status


def download_inputs(inputs_dir, task_config, task_status):
    '''Downloads the task inputs to the specified directory.

    Args:
        inputs_dir (str): the directory to which to download the inputs
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task

    Returns:
        a dictionary mapping input names to their downloaded filepaths
    '''
    input_paths = {}
    for name, path_config in iteritems(task_config.inputs):
        local_path = voxu.download(path_config, inputs_dir)
        input_paths[name] = local_path
        logger.info("Input '%s' downloaded", name)
        task_status.add_message("Input '%s' downloaded" % name)

    return input_paths


def parse_parameters(task_config, task_status, data_params_dir=None):
    '''Parses the task parameters.

    Any data parameters are downloaded to the specified `data_params_dir`,
    if provided.

    Args:
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task
        data_params_dir (str, optional): the directory to which to download
            data parameters, if any. Can be None if no data parameters are
            expected, or if they should be skipped if encountered

    Returns:
        a dictionary mapping parameter names to values (builtin parameters) or
        downloaded filepaths (data parameters)
    '''
    parameters = {}
    for name, val in iteritems(task_config.parameters):
        if voxu.RemotePathConfig.is_path_config_dict(val):
            if data_params_dir is None:
                logger.info("Skipping data parameter '%s'", name)
                task_status.add_message("Skipping data parameter '%s'" % name)
                continue

            path_config = voxu.RemotePathConfig(val)
            local_path = voxu.download(path_config, data_params_dir)
            parameters[name] = local_path
            logger.info("Parameter '%s' downloaded", name)
            task_status.add_message("Parameter '%s' downloaded" % name)
        else:
            logger.info("Found value '%s' for parameter '%s'", val, name)
            parameters[name] = val

    return parameters


def post_job_metadata_for_image(image_path, task_config, task_status):
    '''Posts the job metadata for the task, which must have the given image
    as its sole input.

    Args:
        image_path (str): the path to the input image
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task
    '''
    im = voxu.get_metadata_for_image(image_path)
    metadata = {
        "frame_count": 1,
        "duration_seconds": 0,
        "size_bytes": im.size_bytes
    }
    post_job_metadata(metadata, task_config, task_status)


def post_job_metadata_for_video(video_path, task_config, task_status):
    '''Posts the job metadata for the task, which must have the given video
    as its sole input.

    Args:
        video_path (str): the path to the input video
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task
    '''
    vm = voxu.get_metadata_for_video(video_path)
    metadata = {
        "frame_count": vm.total_frame_count,
        "duration_seconds": vm.duration,
        "size_bytes": vm.size_bytes
    }
    post_job_metadata(metadata, task_config, task_status)


def post_job_metadata(metadata, task_config, task_status):
    '''Posts the job metadata for the task.

    Args:
        metadata (dict): a dictionary describing the input metadata for the
            job. It should include all of the following fields, if applicable:
            ``frame_count``, ``duration_seconds``, and ``size_bytes``
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task
    '''
    job_id = task_config.job_id
    _get_api_client().post_job_metadata(job_id, metadata)
    task_status.add_message("Job metadata posted")


def upload_output(output_path, task_config, task_status):
    '''Uploads the given task output.

    Args:
        output_path (str): the path to the output file to upload
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task
    '''
    voxu.upload(output_path, task_config.output)
    logger.info("Output uploaded to %s", task_config.output)
    task_status.add_message("Output published")


def upload_output_as_data(output_name, output_path, task_config, task_status):
    '''Uploads the given output as data on behalf of the user.

    Args:
        output_name (str): the name of the task output that you are posting
        output_path (str): the path to the output file to post as data
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task
    '''
    data_id = _get_api_client().upload_job_output_as_data(
        task_config.job_id, output_path)
    task_status.record_posted_data(output_name, data_id)
    logger.info("Output '%s' published as data", output_name)
    task_status.add_message("Output '%s' published as data" % output_name)


def complete_task(task_config, task_status, logfile_path=None):
    '''Marks the task as complete and publishes the TaskStatus to the platform.

    Args:
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task
        logfile_path (str, optional): the path to a logfile to upload
    '''
    logger.info("Task complete")
    task_status.complete()
    task_status.publish()
    if logfile_path:
        upload_logfile(logfile_path, task_config)


def upload_logfile(logfile_path, task_config):
    '''Uploads the given logfile for the task.

    Args:
        logfile_path (str): the path to a logfile to upload
        task_config (TaskConfig): the TaskConfig for the task
    '''
    logger.info("Uploading logfile to %s", str(task_config.logfile))
    voxu.upload(logfile_path, task_config.logfile)


def fail_gracefully(
        task_config, task_status, failure_type=None, logfile_path=None):
    '''Marks the task as failed and gracefully winds up by posting any
    available information (status, logfile, etc).

    Args:
        task_config (TaskConfig): the TaskConfig for the task
        task_status (TaskStatus): the TaskStatus for the task
        failure_type (TaskFailureType, optional): an optional failure reason
            for the task
        logfile_path (str, optional): an optional path to a logfile for the
            task to upload
    '''
    # Log the stack trace and mark the task as failed
    exc_info = sys.exc_info()
    if failure_type is not None:
        logger.info("Failure type: %s", failure_type)
    else:
        logger.info("Failure type not specified")
    logger.error("Uncaught exception", exc_info=exc_info)
    task_status.fail(failure_type=failure_type)

    try:
        # Try to publish the task status
        task_status.publish()
    except:
        logger.error("Failed to publish job status")

    try:
        # Try to upload the logfile, if any
        if logfile_path:
            upload_logfile(logfile_path, task_config)
    except:
        logger.error("Failed to upload logfile")


def fail_epically():
    '''Handles an epic failure of a task that occurs before the
    :class:`TaskConfig` was succesfully downloaded. The platform is notified
    of the failure as fully as possible.
    '''
    #
    # Log exception, even though we'll be unable to upload the logfile
    # because something went wrong before we were even able to parse the
    # task config to get the logfile path
    #
    logger.error("Uncaught exception", exc_info=sys.exc_info())

    try:
        #
        # The only thing we can do is update the job status to FAILED
        # and blame it on the platform
        #
        job_id = os.environ[voxc.JOB_ID_ENV_VAR]
        _get_api_client().update_job_state(
            job_id, TaskState.FAILED, failure_type=TaskFailureType.PLATFORM)
        logger.info(
            "Job state %s (%s) posted to API", TaskState.FAILED,
            TaskFailureType.PLATFORM)
    except:
        logger.error("Unable to communicate with API")


def _get_api_client():
    global _API_CLIENT
    if _API_CLIENT is None:
        _API_CLIENT = voxa.make_api_client()
    return _API_CLIENT
