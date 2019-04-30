# Platform Demo Analytic

This guide provides a end-to-end example of building and deploying an analytic
to the Voxel51 Platform.


## Implementing the analytic

This directory contains the following files, which define a `platform-demo`
analytic that is ready for deployment to the Voxel51 Platform. The analytic
is defined in the `main.py` file, and it simply downloads an input video and
randomly generates a labels file that contains a single randomly

- `main.bash`: the main Docker entrypoint script. The only thing that needs to
be customized about this script is the name of the main executable for the
analytic (in this case, `main.py`)

- `main.py`: the main executable for the analytic. In this demo, the entire
analytic is contained in this single file

- `analytic.json`: the analytic JSON file for the analytic, which declares
the inputs and outputs

- `Dockerfile`: the Dockerfile that specifies how to build

You can build your image from the above `Dockerfile` by running:


## Building the image

To build the demo analytic, simply run the commands below from this directory.
The code will clone a fresh copy of the Platform SDK, build the Docker image,
and then cleanup the generated files.

```shell
# Clone platform-sdk
git clone https://github.com/voxel51/platform-sdk
git submodule init
git submodule update

# Build image
docker build -t "platform-demo" .

# Cleanup
rm -rf platform-sdk
```


## Testing locally

Before deploying the analytic to the platform, it is helpful to test your
Docker images locally to ensure that they are functioning properly. You can
use the included local test server to test the image that you built in the
previous step by executing:

```shell
bash start_server.bash \
    --analytic-json ./analytic.json \
    --analytic-image platform-demo
```


## Deploying to the platform

To deploy your working analytic, you must first save it as a `.tar.gz` file so
that you can upload it to the platform:

```shell
docker save platform-demo | gzip -c > platform-demo.tar.gz
```

The following code snippet publishes the analytic to the platform using the
[Python client library](https://github.com/voxel51/api-py):

```py
from voxe51.api import API

analytic_json_path = "./analytic.json"
analytic_image_path = "./platform-demo.tar.gz"

api = API()
api.upload_analytic(analytic_json_path)
api.upload_analytic_image(analytic_id, analytic_image_path, "gpu")
```


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
[voxel51.com](https://voxel51.com)
