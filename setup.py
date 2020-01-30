#!/usr/bin/env python
'''
Installs the Voxel51 Platform SDK.

Copyright 2017-2019, Voxel51, Inc.
voxel51.com
'''
from setuptools import setup, find_packages


setup(
    name="voxel51-platform-sdk",
    version="0.1.0",
    description="Voxel51 Platform SDK",
    author="Voxel51, Inc.",
    author_email="support@voxel51.com",
    url="https://github.com/voxel51/platform-sdk",
    license="BSD-4-Clause",
    packages=find_packages(),
    include_package_data=True,
    classifiers=[
        "Development Status :: 4 - Beta",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 2.7",
        "Programming Language :: Python :: 3",
    ],
    install_requires=[
        "requests>=2.18.4",
    ],
    scripts=[
        "tests/platform/test-platform",
        "tests/image2video/test-i2v",
    ],
    python_requires=">=2.7",
)
