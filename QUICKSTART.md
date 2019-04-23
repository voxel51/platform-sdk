# Voxel51 Platform Quickstart

This guide provides a detailed description of using the
[Platform SDK](https://github.com/voxel51/platform-sdk) to wrap your custom
analytic for deployment to the Voxel51 Platform in a Docker image.

<img src="https://drive.google.com/uc?id=1j0S8pLsopAqF1Ik3rf-CdyAIU4kA0sOP" alt="voxel51-logo.png" width="40%"/>


## Docker installation

All analytics are deployed to the Voxel51 Platform as
[Docker images](https://www.docker.com). If you are new to Docker, we recommend
that you:

- install the Community Edition (CE) on your machine by following the simple
instructions at https://docs.docker.com/install

- read the Docker orientation guide at https://docs.docker.com/get-started to
get familar with the concepts


## Docker entrypoint

The following code provides an annotated example of a generic Docker entrypoint
that uses the Platform SDK to:
 - parse the task description provided to the image at runtime
 - download the inputs and parameters for the task
 - report the necessary metadata to the platform
 - publish the outputs of the task to the platform
 - mark the task as complete

It also demonstrates how to appropriately handle runtime errors that may occur
during execution.

```python
import logging

# The `platform-sdk` package must be pip installed in your image
import voxel51.platform.task as voxt

#
# The following constants set paths in the internal file system of your Docker
# image to which you want to download task input(s), write outputs, etc.
#

# A directory to which to download the task input(s) for your task
INPUTS_DIR = "/path/to/inputs"

# A path to write the logfile for this task
TASK_LOGFILE_PATH = "/path/to/task.log"

#
# The local path to which your analytic will write it's final output. The file
# type you specify here depends on the nature of your analytic.
#
OUTPUT_PATH = "/path/to/output.json"


logger = logging.getLogger(__name__)


def main():
    '''The main entrypoint for your Docker.

    Note that no arguments are required here because the Platform SDK reads the
    necessary configuration settings from environment variables.
    '''

    #
    # Setup logging
    #
    # This command configures system-wide logging so that all logging recorded
    # via the builtin `logging` module will be written to the logfile path that
    # you provide here. Note that the platform stores task logs internally to
    # facilitate debugging, but these logs are not made available to end-users.
    #
    voxt.setup_logging(TASK_LOGFILE_PATH)

    #
    # Get task config URL
    #
    # When a platform Docker image is executed, the `TASK_DESCRIPTION`
    # environment variable is set to a signed URL at which the TaskConfig for
    # the task can be downloaded.
    #
    task_config_url = voxt.get_task_config_url()

    try:
        #
        # Create a TaskManager for the task
        #
        # The TaskManager class provides a convenient interface to read inputs
        # and parameters for your task, publish its status during execution,
        # and upload the output when the task completes.
        #
        # This command downloads the TaskConfig from `task_config_url` and
        # stores a TaskStatus instance internally to record the status of the
        # task.
        #
        task_manager = voxt.TaskManager.from_url(task_config_url)
    except:
        #
        # Something went terribly wrong and we are unable to communicate with
        # the platform. This command logs the failure and notifies the platform
        # as fully as possible.
        #
        voxt.fail_epically(task_config_url)
        return

    try:
        #
        # Mark the task as started
        #
        # This command updates the state of the TaskStatus stored in the
        # TaskManager and then publishes the status to the platform.
        #
        task_manager.start()

        #
        # Download inputs
        #
        # This command downloads the inputs for your task to the directory that
        # you specify here. It returns a dictionary mapping the input names to
        # the paths of each downloaded file in the directory. The inputs are
        # downloaded from the signed URLs contained in the TaskConfig provided
        # to your Docker image when it was run. The names of the inputs are
        # configured by the analytic JSON that you provided when publishing the
        # analytic to the platform.
        #
        inputs = task_manager.download_inputs(INPUTS_DIR)

        #
        # Parse parameters
        #
        # This command parses any parameters provided in the TaskConfig for the
        # task. It returns a dictionary that maps parameter names to their
        # corresponding values. The names of the parameters are configured by
        # the analytic JSON that you provided when publishing the analytic to
        # the platform.
        #
        parameters = task_manager.parse_parameters()

        #
        # Record metadata and post job metadata
        #
        # The code below performs two tasks: it records the metadata about the
        # task inputs, and it publishes the metadata about the overall task to
        # the platform.
        #
        # The input metadata is required by the platform in order to, for
        # example, know the frame rate of the input video when rendering the
        # annotations generated by an object detection analytic.
        #
        # Posting metadata about the job to the platform is required so that
        # the platform can track the data volume processed by the task.
        #
        # The code below assumes the typical case where the analytic has only
        # one input, and that input is a video. If your analytic does not take
        # a single video as input, then you can comment out the lines below;
        # note, however, that the details of the data processed by your job
        # will not be fully tracked by the platform, and thus certain features
        # like output preview and data volume reporting will not be supported.
        #
        input_name = list(inputs.keys())[0]
        input_path = inputs[input_name]
        task_manager.record_input_metadata(input_name, video_path=input_path)
        task_manager.post_job_metadata(video_path=input_path)

        #
        # Your code goes here!!
        #
        # Now you have the inputs and parameters required to run your task, so
        # you can perform your custom work!
        #
        # Remember that any `logging` messages you generated will be
        # automatically recorded in your task's logfile. The TaskManager can
        # also store messages, which are included in the status JSON file made
        # available to end users. You can publish the latest status of your
        # task to the platform at any time by calling `publish_status()`.
        #
        logger.info("Logging messages will appear in the task's logfile")
        task_manager.add_status_message("TaskManager can track messages")
        task_manager.publish_status()

        #
        # Upload output
        #
        # This command uploads the output that you generated at the provided
        # path to the platform.
        #
        task_manager.upload_output(OUTPUT_PATH)

        #
        # Mark task as complete
        #
        # This command marks the task as complete and publishes the final task
        # status and logfile to the platform. You are done!
        #
        task_manager.complete(logfile_path=TASK_LOGFILE_PATH)
    except:
        #
        # An error occured while your analytic was executing, so the command
        # below gracefully exits by recording the stack trace in your logfile,
        # marking the task as failed, and posting the final (failed) task
        # status to the platform.
        #

        #
        # Note that the `fail_gracefully` function allows you to specify a
        # failure type for the job from the TaskFailureType enum. Here we
        # assume that the platform and analytic are working perfectly and any
        # error must have resulted from invalid user data. However, the failure
        # type can be customized depending on the nature of the error.
        #
        task_manager.fail_gracefully(
            failure_type=voxt.TaskFailureType.USER,
            logfile_path=TASK_LOGFILE_PATH)


if __name__ == "__main__":
    main()
```


## Docker build

This section assumes that you have extended the template in the previous
section to obtain a `main.py` entrypoint for your Docker image that runs your
custom analytic.

The snippet below defines a `Dockerfile` that installs the Platform SDK and
its dependencies in a GPU-enabled Docker image that runs the `main.py`
entrypoint that you provide. It can be easily extended to include any custom
installation requirements for your analytic.

```
# A typical base image for GPU deployments. Others are possible
FROM nvidia/cuda:9.0-cudnn7-runtime-ubuntu16.04

#
# Your custom installation goes here!
#

#
# Install `platform-sdk` and its dependencies
#
# The following tensorflow + numpy options are supported:
#   - Python 2.7.X: tensorflow(-gpu)==1.12.0 and numpy==1.14.0
#   - Python 3.6.X: tensorflow(-gpu)==1.12.0 and numpy==1.16.0
#
COPY platform-sdk/ /engine/platform-sdk/
RUN apt-get update \
    && apt-get -y --no-install-recommends install \
        libcupti-dev \
        python2.7 \
        python-dev \
        python-pip \
        python-setuptools \
        ffmpeg \
        imagemagick \
    && pip install --upgrade pip==9.0.3 \
    && pip --no-cache-dir install -r /engine/platform-sdk/requirements.txt \
    && pip --no-cache-dir install -r /engine/platform-sdk/eta/requirements.txt \
    && pip --no-cache-dir install -e /engine/platform-sdk/. \
    && pip --no-cache-dir install -e /engine/platform-sdk/eta/.
    && pip --no-cache-dir install opencv-python-headless \
    && pip --no-cache-dir install --upgrade requests \
    && pip --no-cache-dir install -I tensorflow-gpu==1.12.0 \
    && pip --no-cache-dir install --upgrade numpy==1.14.0 \
    && rm -rf /var/lib/apt

#
# Declare environment variables that the platform will use to communicate with
# the image at runtime
#
ENV TASK_DESCRIPTION=null ENV=null API_TOKEN=null

# Expose port so image can read/write from external storage at runtime
EXPOSE 8000

# Setup entrypoint
COPY main.py /engine/main.py
RUN chmod +x /engine/main.py
WORKDIR /engine
ENTRYPOINT ["python", "main.py"]
```

You can build your image from the above `Dockerfile` by running:

```shell
# Clone platform-sdk
git clone https://github.com/voxel51/platform-sdk
git submodule init
git submodule update

#
# Your custom setup goes here!
#

# Build image
docker build -t "<analytic>-<version>" .

# Cleanup
rm -rf platform-sdk
```


## Docker deployment

After you have built the Docker image for your custom analytic, you must save
it as a `.tar.gz` file so that you can upload it to the Voxel51 Platform.
To do so, simply execute a command like:

```shell
docker save <image> | gzip -c > <image>.tar.gz
```

where, if you built your image as described in the previous section,
`<image>=<analytic>-<version>`.

Finally, follow the instructions in the Analytic Deployment section of the
[README](README.md) to publish your analytic to the platform.


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
