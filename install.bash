#!/usr/bin/env bash
# Installs the platform-sdk package.
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#
# Brian Moore, brian@voxel51.com
#

# Show usage information
usage() {
    echo "Usage:  bash $0 [-h]

-h      Display this help message.
"
}

# Parse flags
SHOW_HELP=false
while getopts "h" FLAG; do
    case "${FLAG}" in
        h) SHOW_HELP=true ;;
        *) usage ;;
    esac
done
[ ${SHOW_HELP} = true ] && usage && exit 0

# Install platform-sdk
echo "Installing platform-sdk"
pip install -r requirements.txt
pip install -e .

# Initialize submodules
echo "Initializing submodules"
git submodule init
git submodule update

# Install ETA lite
echo "Installing ETA lite"
cd eta
bash install.bash -l
cp config-example.json config.json
