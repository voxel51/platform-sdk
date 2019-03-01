#!/usr/bin/env bash
# Generates Platform SDK documentation.
#
# Usage:
#   bash docs/generate_docs.bash
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#

echo "**** Generating documentation"

sphinx-apidoc -f -o docs/source voxel51/

cd docs
make html
cd ..

echo "**** Documentation complete"
printf "To view the docs, run:\n\nopen docs/build/html/index.html\n\n"
