# Platform Quickstart

This guide provides a detailed description of using the
[Platform SDK](https://github.com/voxel51/platform-sdk) to wrap your custom
analytic for deployment to the [Voxel51 Platform](https://console.voxel51.com).

See the
[examples folder](https://github.com/voxel51/platform-sdk/tree/develop/examples)
for pre-defined examples of analytics that you can build and deploy to the
Platform to get comfortable with the workflow.

<img src="https://drive.google.com/uc?id=1j0S8pLsopAqF1Ik3rf-CdyAIU4kA0sOP" alt="voxel51-logo.png" width="40%"/>


## Docker installation

All analytics are deployed to the Voxel51 Platform as
[Docker images](https://www.docker.com). If you are new to Docker, we recommend
that you:

- Install the Community Edition (CE) on your machine by following the simple
instructions at https://docs.docker.com/install
- Read the Docker orientation guide at https://docs.docker.com/get-started to
get familar with the concepts


## Analytic executable

The following code provides an annotated example of a generic Python executable
`main.py` that acts as the main entrypoint for an analytic Docker image. It
uses the Platform SDK to:

 - Parse the task description provided to the image at runtime
 - Download the inputs and parameters for the task
 - Report the necessary metadata to the platform
 - Invoke the analytic-specific implementation
 - Publish the outputs of the task to the platform
 - Mark the task as complete

It also demonstrates how to appropriately handle runtime errors that may occur
during execution.

You can easily adapt this template to run your custom algorithm by inserting
the appropriate calls in the `Your code here!` section.

```python
'''
Template main executable for an analytic Docker image.

Syntax:
    python main.py
'''
import logging

# The `platform-sdk` package must be pip installed in your image
import voxel51.platform.task as voxt

#
# The following constants set paths in the internal file system of your Docker
# image to which you want to download task input(s), write outputs, etc.
#

#
# A path to write the logfile for this task.
#
# Don't change this path; the platform attaches a pre-stop hook to all images
# that will upload any logfile from this location whenever a task is
# terminated unexpectedly (e.g., preemption, resource violation, etc.)
#
TASK_LOGFILE_PATH = "/var/log/image.log"

#
# A directory to which to download the task input(s) for your task.
# This location can be anything you want.
#
INPUTS_DIR = "/path/to/inputs"

#
# The local path to which your analytic will write it's final output. The file
# type you specify here depends on the nature of your analytic. This location
# can be anything you want.
#
OUTPUT_PATH = "/path/to/output.json"


logger = logging.getLogger(__name__)


def main():
    '''The main method for the analytic Docker image.

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
        voxt.fail_epically()
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
        # Your code goes here!
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


## Docker entrypoint

In order to gracefully handle any uncaught exceptions in the analytic
executable defined above, we strongly recommend wrapping your executable in the
following simple `main.bash` script, which will act as the entrypoint to your
Docker image.

```shell
#!/bin/bash
# Main entrypoint for a Voxel51 Platform Analytic.
#

#
# Don't change `LOGFILE_PATH`. The platform attaches a pre-stop hook to images
# at runtime that will upload the logfile from this location whenever a task is
# terminated unexpectedly (e.g., preemption, resource violation, etc.)
#
LOGFILE_PATH=/var/log/image.log
BACKUP_LOGFILE_PATH=/var/log/backup.log

#
# Execute analytic and pipe stdout/stderr to disk so that this information
# will be available in case of errors.
#
# If necessary, replace `python main.py` here with the appropriate invocation
# for your analytic.
#
set -o pipefail
python main.py 2>&1 | tee "${BACKUP_LOGFILE_PATH}"

# Gracefully handle uncaught failures in analytic
if [ $? -ne 0 ]; then
    # Append backlog log
    echo "UNCAUGHT EXCEPTION; APPENDING BACKUP LOG" >> "${LOGFILE_PATH}"
    cat "${BACKUP_LOGFILE_PATH}" >> "${LOGFILE_PATH}"

    # Post job failure
    curl -X PUT "${API_BASE_URL}/jobs/${JOB_ID}/state" \
        -H "X-Voxel51-Agent: ${API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{"state": "FAILED", "failure_type": "ANALYTIC"}'

    # Upload logfile
    curl -T "${LOGFILE_PATH}" -X PUT "${LOGFILE_SIGNED_URL}"
fi
```

The script simply executes the main executable from the previous section, pipes
its `stdout` and `stderr` to disk, and, if the executable exits with a non-zero
status code, marks the job as `FAILED` and uploads the logfile to the platform.

This extra layer of protection is important to catch and appropriately report
errors that prevent the Platform SDK from loading (e.g., an `import` error
caused from buggy installation instructions in the `Dockerfile`).


## Docker build

This section assumes that you have populated the analytic executable and
entrypoint scripts from the previous sections to run your custom analytic.

The snippet below defines a `Dockerfile` that installs the Platform SDK and
its dependencies in a GPU-enabled Docker image that runs the `main.bash` and
`main.py` scripts that you provide. It can be easily extended to include any
custom installation requirements for your analytic.

```shell
# A typical base image for GPU deployments. Others are possible
FROM nvidia/cuda:9.0-cudnn7-runtime-ubuntu16.04

#
# Install `platform-sdk` and its dependencies
#
# The Platform SDK supports either Python 2.7.X or Python 3.6.X
#
# For CPU-enabled images, install tensorflow==1.12.0
#
# For GPU-enabled images, use the TensorFlow version compatible with the CUDA
# version in your image:
#   - CUDA 8: tensorflow-gpu==1.4.0
#   - CUDA 9: tensorflow-gpu==1.12.0
#   - CUDA 10: tensorflow-gpu==1.14.0
#
# The following installs Python 3.6 with TensorFlow 1.12.0 to suit the base
# NVIDIA image chosen above.
#
COPY platform-sdk/ /engine/platform-sdk/
RUN apt-get update \
    && apt-get -y --no-install-recommends install \
        software-properties-common \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get -y --no-install-recommends install \
        sudo \
        build-essential \
        pkg-config \
        ca-certificates \
        unzip \
        git \
        curl \
        libcupti-dev \
        python3.6 \
        python3-dev \
        python3-pip \
        python3-setuptools \
        ffmpeg \
        imagemagick \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && ln -s /usr/bin/pip3 /usr/bin/pip \
    && python -m pip install --upgrade pip \
    && python -m pip --no-cache-dir install -r /engine/platform-sdk/requirements.txt \
    && python -m pip --no-cache-dir install -r /engine/platform-sdk/eta/requirements.txt \
    && python -m pip --no-cache-dir install -e /engine/platform-sdk/. \
    && python -m pip --no-cache-dir install -e /engine/platform-sdk/eta/. \
    && python -m pip --no-cache-dir install -I tensorflow-gpu==1.12.0 \
    && python -m pip --no-cache-dir install --upgrade numpy==1.16.0 \
    && rm -rf /var/lib/apt

#
# Your custom installation here!
#

# Expose port so image can read/write from external storage at runtime
EXPOSE 8000

# Setup entrypoint
COPY main.bash /engine/main.bash
COPY main.py /engine/main.py
RUN mkdir -p /var/log
WORKDIR /engine
ENTRYPOINT ["bash", "main.bash"]
```

You can build your image from the above `Dockerfile` by running:

```shell
# Clone platform-sdk
git clone https://github.com/voxel51/platform-sdk
cd platform-sdk
git submodule init
git submodule update
cd ..

#
# Your custom setup here!
#

# Build image
docker build -t "<image-name>" .

# Cleanup
rm -rf platform-sdk
```


## Local testing

After you have built the Docker image for your custom analytic, you can use
the `test-platform` script that was installed along with the Platform SDK to
verify that your image is functioning properly before deploying it to the
Voxel51 Platform.

The basic syntax for launching a test server instance is:

```shell
test-platform \
    --analytic-image <image-name> \
    --analytic-json <analytic-json> \
    --inputs <name>=<path> \
    --compute-type <cpu|gpu>
```

Type `test-platform -h` for help, and see the
[this folder](https://github.com/voxel51/platform-sdk/tree/develop/tests/platform)
for more informtion.


## Docker deployment

Once your Docker image is ready for deployment, you must save it as a `.tar.gz`
file so that you can upload it to the Voxel51 Platform. To do so, simply
execute a command like:

```shell
docker save <image-name> | gzip -c > <image-name>.tar.gz
```

Finally, follow the instructions in the
[Analytic deployment section of the README](https://github.com/voxel51/platform-sdk/blob/develop/README.md#analytic-deployment)
to publish your analytic to the platform.


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
