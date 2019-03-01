# Voxel51 Vision Services Platform SDK

An SDK for deploying custom analytics to the Voxel51 Vision Services Platform.

<img src="https://drive.google.com/uc?id=1j0S8pLsopAqF1Ik3rf-CdyAIU4kA0sOP" alt="voxel51-logo.png" width="40%"/>


## Installation

To install the library, first clone it:

```shell
git clone https://github.com/voxel51/platform-sdk
cd platform-sdk
```

and then install the package:

```shell
pip install .
```


## Quickstart

See the [Quickstart Guide](QUICKSTART.md) for step-by-step instructions on
using this SDK to wrap your custom analytic for deployment to the Vision
Services Platform.


## Overview

The Voxel51 Vision Services Platform is a scalable compute cluster that allows
users to process their video (or other) data through state-of-the-art video
understanding algorithms. The platform is generic and can be deployed in the
cloud (Google Cloud, AWS, Microsoft Azure, etc.) or on-premises in a private
datacenter.

Algorithms are deployed to the platform as **analytics**, which are concrete
processing modules that take video (or other) data as input and output metadata
(e.g., object detections, image classifications, etc.) in a predefined format.
In turn, users can create **jobs** to run analytics on data they have uploaded
to the platform. Each analytic is deployed to the platform as a Docker
container. When a job is requested on the platform, the Docker image for the
corresponding analytic is deployed as a Pod in a Kubernetes cluster and the
specified data is processed.

The Vision Services Platform contains many publicly available analytics that
are maintained by Voxel51. The [Analytics Documentation](https://console.voxel51.com/docs/analytics#analytics-documentation) describes the interface of these analytics in detail. In
addition, the platform allows users and third-party applications to deploy
custom analytics to the platform for private use by uploading their own Docker
images. This repository contains an easy-to-use SDK that allows you to wrap
your custom algorithms with a Docker entrypoint that implements the platform's
analytic interface.

Regardless of where the platform is deployed, users interact with
it via the Vision Services API, which exposes the interface through which users
can upload and manage data resources, run analytics on data, monitor the status
of their jobs, download the outputs of jobs, access statements and billing,
and more. For more information about the API, refer to the
[API Documentation](https://console.voxel51.com/docs/api).


## Analytic Interface

All analytics deployed to the Vision Services Platform must be implemented as
Docker containers that support the platform's interface as described below.

The platform communicates with analytic Docker images by setting the following
environment variables:

- `TASK_DESCRIPTION` : the URL from which to download a JSON file that
describes the task to be performed

- `API_TOKEN` : the API token that the process can use to communicate with the
Vision Services API

- `ENV` : specifies which deployment environment the task is being run in. The
possible values are enumerated by the `voxel51.config.DeploymentEnvironments`
enum. This value determines which API endpoint the process should communicate
with

The following JSON file shows an example of a task specification provided to
the `vehicle-tracker` analytic:

```json
{
    "analytic": "vehicle-tracker",
    "job_id": "2ffe1110-b446-427d-8829-db9ac95d0638",
    "inputs": {
        "video": {
            "signed-url": "https://storage.googleapis.com/XXXX"
        }
    },
    "parameters": {
        "size": [-1, 720]
    },
    "output": {
        "signed-url": "https://storage.googleapis.com/XXXX"
    },
    "status": {
        "signed-url": "https://storage.googleapis.com/XXXX"
    },
    "logfile": {
        "signed-url": "https://storage.googleapis.com/XXXX"
    }
}
```

In the above JSON, the `analytic` key specifies the name of the analytic being
run, and the `job_id` specifies the ID of the platform job being executed,
which is used by the SDK when communicating the status of the task to the
platform. The `inputs` object specifies where the process should download its
input(s), and the `parameters` object specifies any parameters that were set.
Finally the `output`, `status`, and `logfile` objects specify where to upload
the task outputs, status file, and logfile, respectively.

The Platform SDK provides a `voxel51.task.TaskConfig` class that conveniently
encapsulates reading and parsing the above specification. In particular, each
of the remote file locations are encapsulated by the
`voxel51.utils.RemotePathConfig` class, which abstracts the nature and location
of the remote files from your analytic. Thus _no changes_ to your code are
required for your analytic to support reading/writing files from different
remote storage providers (Google Cloud, AWS Cloud, private data centers, etc.)

As a task is being executed, the Platform SDK provides a convenient interface
for reporting the status of the task to the platform. The following JSON file
shows an example of the status of a completed `vehicle-tracker` task that was
reported automatically via the Platform SDK:

```json
{
    "name": "vehicle-tracker",
    "state": "COMPLETE",
    "start_time": "2019-02-02 07:14:28",
    "complete_time": "2019-02-02 07:32:45",
    "fail_time": null,
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

See the [Quickstart Guide](QUICKSTART.md) for more details about the interface
provided by the Platform SDK.


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

Copyright 2017-2019, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
