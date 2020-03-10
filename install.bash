#!/usr/bin/env bash
# Installs the platform-sdk package.
#
# Copyright 2017-2019, Voxel51, Inc.
# voxel51.com
#

# Show usage information
usage() {
    echo "Usage:  bash $0 [-h] [-f] [-n]

Getting help:
-h      Display this help message.

Install options:
-f      Whether to perform a full ETA install. The default is a lite install.
-n      Don't install ETA. By default, ETA is installed
"
}

# Parse flags
SHOW_HELP=false
LITE_ETA_INSTALL=true
INSTALL_ETA=true
while getopts "hfn" FLAG; do
    case "${FLAG}" in
        h) SHOW_HELP=true ;;
        f) LITE_ETA_INSTALL=false ;;
        n) INSTALL_ETA=false ;;
        *) usage ;;
    esac
done
[ ${SHOW_HELP} = true ] && usage && exit 0

# Install platform-sdk
echo "Installing platform-sdk"
pip install -r requirements.txt
pip install -e .

# Install ETA, if necessary
if [ ${INSTALL_ETA} = true ]; then
    # Initialize submodules
    echo "Initializing submodules"
    git submodule init
    git submodule update

    # Install ETA
    cd eta
    if [ ${LITE_ETA_INSTALL} = true ]; then
        echo "Installing ETA lite"
        bash install.bash -l
    else
        echo "Installing ETA"
        bash install.bash
    fi
    cp config-example.json config.json
    cd ..
fi

# Install local test server
echo "Installing local test server"
command -v npm &> /dev/null
if [ $? -ne 0 ]; then
    echo "Installing Node.js"

    # Install nvm
    unset NVM_DIR
    curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.34.0/install.sh | bash

    # Manually execute commands from ~/.bashrc so we can use nvm immediately
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

    # Install node
    nvm install node

    # Ensures that the rest of this terminal session can also use node
    if [[ -f ~/.bashrc ]]; then
        source ~/.bashrc
    fi
    if [[ -f ~/.bash_profile ]]; then
        source ~/.bash_profile
    fi
fi
cd tests/platform
npm install
