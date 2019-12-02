# Image-To-Video Local Testing Server

This directory defines a local testing script that you can use to test your
Image-To-Video analytic Docker image locally on your machine to verify that it
works properly before deploying it to the Voxel51 Platform.


## Quickstart

To test an Image-To-Video Docker image that you have built, use the `test-i2v`
script that was provided when you installed the Platform SDK:

```
Usage:  bash test-i2v [-h] [-c] [IMAGE_NAME] [FRAMES_DIR]

Runs an Image-To-Video Docker image locally on an input directory of images
of your choice.

The frames directory that you provide must be relative to your working
directory. The output labels are written to 'out/labels.json' in your working
directory.

optional arguments:
-c              cleanup generated files from a previous test run from the
                current working directory
-h              show this help message and exit

positional arguments:
IMAGE_NAME      the name of the Image-To-Video Docker image to test
FRAMES_DIR      the directory of frames to process
```

Running the script will run your image `IMAGE_NAME` via `docker run`, which
will apply your model to the frames in the `FRAMES_DIR` directory (which should
contain images whose filenames contain a numeric pattern like `%06d`) and
write the predictions in VideoLabels format to `out/labels.json`.

If the `out/labels.json` file is populated as expected, your analytic is ready
for deployment to the Voxel51 Platform!

See the
[examples folder](https://github.com/voxel51/platform-sdk/tree/develop/examples)
for pre-defined test analytics that you can build and deploy to the platform
to get comfortable with the workflow.


## Cleanup

To cleanup generated test files after running a test, run the following command
from the same working directory in which you ran the test:

```bash
test-i2v -c
```


## Copyright

Copyright 2017-2019, Voxel51, Inc.<br>
voxel51.com
