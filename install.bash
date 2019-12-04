#!/usr/bin/env bash
# Installs the platform-sdk package.
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
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
cd ..

# Install local test server
echo "Installing local test server"
command -v npm &> /dev/null
if [ $? -ne 0 ]; then
    echo "Installing Node.js"
    curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash
    if [[ -f ~/.bashrc ]]; then
        source ~/.bashrc
    fi
    if [[ -f ~/.bash_profile ]]; then
        source ~/.bash_profile
    fi
    nvm install node
fi
cd tests/platform
npm install
