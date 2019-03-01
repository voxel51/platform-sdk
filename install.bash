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
    echo "Usage:  bash $0 [-h] [-e]

-h      Display this help message.
-e      Installs python packages in editable (developer) mode.
"
}

# Parse flags
SHOW_HELP=false
DEV_MODE=false
while getopts "he" FLAG; do
    case "${FLAG}" in
        h) SHOW_HELP=true ;;
        e) DEV_MODE=true ;;
        *) usage ;;
    esac
done
[ ${SHOW_HELP} = true ] && usage && exit 0

# Install platform-sdk
echo "Installing platform-sdk"
pip install -r requirements.txt
if [ ${DEV_MODE} = true ]; then
    pip install -e .
else
    pip install .
fi

# Initialize submodules
echo "Initializing submodules"
git submodule init
git submodule update

# Install ETA and its dependencies
echo "Installing ETA"
cd eta
bash install_externals.bash
if [ ${DEV_MODE} = true ]; then
    pip install -e .
else
    pip install .
fi
