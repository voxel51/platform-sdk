# Voxel51 Platform SDK

An SDK for deploying custom analytics to the
[Voxel51 Platform](https://console.voxel51.com).

Available at [https://github.com/voxel51/platform-sdk](https://github.com/voxel51/platform-sdk).

<img src="https://user-images.githubusercontent.com/3719547/74191434-8fe4f500-4c21-11ea-8d73-555edfce0854.png" alt="voxel51-logo.png" width="40%"/>


## Installation

Install the SDK as follows:

```shell
# Clone the repository
git clone https://github.com/voxel51/platform-sdk

# Run the install script
cd platform-sdk
bash install.bash
cd ..
```

Next, if you have not already, go to
[https://console.voxel51.com](https://console.voxel51.com) and create a
Platform Account.

If you would like to programmatically upload your analytics and test them via
the Platform API, you also need to install the
[Python client library](https://github.com/voxel51/api-py):

```shell
# Clone the repository
git clone https://github.com/voxel51/api-py

# Install the package
pip install -e api-py
```

After installing the client library, follow
[these instructions](https://voxel51.com/docs/api/?python#authentication) to
download and activiate an API token to enable use of the client library.

After you have installed the client library and activated your API token, run
`voxel51 auth show`. If you see token information, then you're ready to go!


## Quickstart

### Platform Analytics

See the
[Platform Quickstart Guide](https://github.com/voxel51/platform-sdk/blob/develop/quickstarts/PLATFORM.md)
for step-by-step instructions on using this SDK to wrap your custom analytic
for deployment to the Voxel51 Platform.

Also, see the
[examples folder](https://github.com/voxel51/platform-sdk/tree/develop/examples)
for an end-to-end example of building and deploying a test analytic to the
Platform.

### Image-To-Video Analytics

See the
[Image-To-Video Quickstart Guide](https://github.com/voxel51/platform-sdk/blob/develop/quickstarts/IMAGE_TO_VIDEO.md)
for step-by-step instructions on using the Image-To-Video tool in this SDK to
wrap your custom image-based model for deployment to the Voxel51 Platform to
process videos.

Also, see the
[examples folder](https://github.com/voxel51/platform-sdk/tree/develop/examples)
for several end-to-end examples of building and deploying analytics using the
Image-To-Video tool.


## Overview

The Voxel51 Platform is a scalable compute cluster that allows users to process
their video (or other) data through state-of-the-art video understanding
algorithms. The Platform is generic and can be deployed in the cloud
(Google Cloud, AWS, Microsoft Azure, etc.) or on-premises in a private
datacenter.

Algorithms are deployed to the Platform as **analytics**, which are concrete
processing modules that take video (or other) data as input and output metadata
(e.g., object detections, image classifications, etc.) in a predefined format.
In turn, users can create **jobs** to run analytics on data they have uploaded
to the Platform. Each analytic is deployed to the Platform as a Docker
container. When a job is requested on the Platform, the Docker image for the
corresponding analytic is deployed as a Pod in a Kubernetes cluster and the
specified data is processed.

The Platform contains many publicly available analytics that are maintained by
Voxel51. The [Analytics Documentation](https://voxel51.com/docs/analytics#analytics-documentation)
describes the interface of these analytics in detail. In addition, the Platform
allows users and third-party applications to deploy custom analytics to the
Platform for private use by uploading their own Docker images. This repository
contains an easy-to-use SDK that allows you to wrap your custom algorithms with
a Docker entrypoint that implements the Platform's analytic interface. See the
Analytic Deployment section below to learn how to deploy your custom analytics
to the Platform either programmatically via the API or the web-based console.

Regardless of where the Platform is deployed, users interact with it via the
Platform API, which exposes the interface through which users can upload and
manage data resources, run analytics on data, monitor the status of their jobs,
download the outputs of jobs, access statements and billing, and more. For more
information about the Platform API, refer to the
[API Documentation](https://voxel51.com/docs/api).


## Analytic interface

All analytics deployed to the Platform must be implemented as Docker containers
that support the Platform's interface as described below.

The Platform communicates with analytic Docker images by setting the following
environment variables:

- `TASK_DESCRIPTION` : the URL from which to download a JSON file that
describes the task to be performed. Note that this may return a HTTP redirect,
which should be followed

- `JOB_ID` : the ID of the job being executed by this task. Provided as an
environment variable as an extra layer of redundancy in case the task JSON
cannot be accessed

- `API_TOKEN` : the API token that the process can use to communicate with the
Platform API

- `API_BASE_URL`: the base URL of the Platform API that the SDK will use

- `LOGFILE_SIGNED_URL`: the URI to which to POST the logfile for the task.
Provided as an environment variable as an extra layer of redundancy in case the
task JSON cannot be accessed

The Platform SDK provides a `voxel51.platform.task.TaskConfig` class that
conveniently encapsulates reading and parsing the above specification. In
particular, each of the remote file locations are encapsulated by the
`voxel51.platform.utils.RemotePathConfig` class, which abstracts the nature and
location of the remote files from your analytic. Thus _no changes_ to your code
are required for your analytic to support reading/writing files from different
remote storage providers (Google Cloud, AWS Cloud, private datacenters, etc.)

As a task is being executed, the Platform SDK provides a convenient interface
for reporting the status of the task to the Platform. The following JSON file
shows an example of the status of a completed `voxel51/vehicle-sense` task that
was reported automatically via the Platform SDK:

```json
{
    "analytic": "voxel51/vehicle-sense",
    "version": "0.3",
    "state": "COMPLETE",
    "start_time": "2019-02-02 07:14:28",
    "complete_time": "2019-02-02 07:32:45",
    "fail_time": null,
    "failure_type": "NONE",
    "messages": [
        {
            "message": "Task started",
            "time": "2019-02-02 07:14:28"
        },
        {
            "message": "Task complete",
            "time": "2019-02-02 07:32:45"
        }
    ],
    "inputs": {
        "video": {
            "frame_size": [1920, 1080],
            "frame_rate": 30.0,
            "total_frame_count": 1800,
            "duration": 60.0,
            "size_bytes": 3429628200,
            "encoding_str": "avc1"
        }
    },
    "posted_data": {}
}
```

See the
[Platform Quickstart Guide](https://github.com/voxel51/platform-sdk/blob/develop/quickstarts/PLATFORM.md)
for more details about the interface provided by the Platform SDK.


## Analytic deployment

You can deploy new custom analytics or new versions of your existing analytics
at any time via the [API](https://voxel51.com/docs/api) or the
[Web Console](https://console.voxel51.com). Deploying a new analytic is a
simple two step process:

- Upload an analytic JSON to the Platform that describes the details and
interface of the analytic you plan to upload. See the
[API Documentation](https://voxel51.com/docs/api#analytics-download-documentation)
for a description of the format of this JSON file.

- Upload the corresponding Docker image(s) for your analytic. The Platform
supports analytic execution via either CPU-only or GPU-enabled compute. You
must upload a separate Docker image for each execution mode for which you
declared support in your analytic JSON.

Once you have uploaded your analytic JSON and Docker images, your analytic is
ready for production use!

### Deployment via API

New analytics can be published programmatically via the Platform API or any of
its client libraries. For example, the following code snippet shows how to
publish a GPU-enabled analytic using the
[Python client library](https://github.com/voxel51/api-py):

```py
from voxel51.users.api import API, AnalyticImageType

analytic_json_path = "/path/to/analytic.json"
gpu_image_path = "/path/to/gpu-image.tar.gz"

api = API()

# Upload analytic JSON
analytic = api.upload_analytic(analytic_json_path)
analytic_id = analytic["id"]

# Upload image
api.upload_analytic_image(analytic_id, gpu_image_path, AnalyticImageType.GPU)
```

See the [API Documentation](https://voxel51.com/docs/api#analytics-upload-analytic)
for more complete instructions for deploying analytics via the API.

### Deployment via web console

You can also publish new analytics via the Platform's
[Web Console](https://console.voxel51.com). To do so, simply login
to your Platform account, navigate to the `Analytics` page, and click `Upload`.


## Documentation

This project uses
[Sphinx-Napoleon](https://pypi.python.org/pypi/sphinxcontrib-napoleon)
to generate its documentation from source. To generate the documentation, run:

```shell
bash docs/generate_docs.bash
```

To view the documentation, open the `docs/build/html/index.html` file in
your browser.


## Copyright

Copyright 2017-2020, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
