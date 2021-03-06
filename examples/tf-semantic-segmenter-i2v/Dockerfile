ARG BASE_IMAGE
FROM $BASE_IMAGE

#
# Install `platform-sdk` and its dependencies
#
# `ppa:deadsnakes/ppa` is used in order to install Python 3.6 on Ubuntu 16.04
# https://askubuntu.com/questions/865554/how-do-i-install-python-3-6-using-apt-get
#
# `https://bootstrap.pypa.io/get-pip.py` is used to install pip on Python 3.6
# https://askubuntu.com/questions/889535/how-to-install-pip-for-python-3-6-on-ubuntu-16-10
#
COPY platform-sdk/ /engine/platform-sdk/
ARG TENSORFLOW_VERSION
RUN apt-get update \
    && apt-get -y --no-install-recommends install software-properties-common \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get -y --no-install-recommends install \
        sudo \
        build-essential \
        git \
        curl \
        wget \
        unzip \
        pkg-config \
        ca-certificates \
        python3.6 \
        python3.6-dev \
        libcupti-dev \
        ffmpeg \
        imagemagick \
    && ln -s /usr/bin/python3.6 /usr/local/bin/python \
    && curl https://bootstrap.pypa.io/get-pip.py | python \
    && pip install --upgrade pip setuptools \
    && pip --no-cache-dir install -r /engine/platform-sdk/requirements.txt \
    && pip --no-cache-dir install -r /engine/platform-sdk/eta/requirements.txt \
    && pip --no-cache-dir install -e /engine/platform-sdk/. \
    && pip --no-cache-dir install -e /engine/platform-sdk/eta/. \
    && pip --no-cache-dir install -I $TENSORFLOW_VERSION \
    && pip --no-cache-dir install --upgrade numpy==1.16.0 \
    && rm -rf /var/lib/apt

# Install models
COPY models/ /engine/models/

# Setup entrypoint
COPY main.bash /engine/main.bash
COPY main.py /engine/main.py
RUN mkdir -p /var/log
WORKDIR /engine
ENTRYPOINT ["bash", "main.bash"]
