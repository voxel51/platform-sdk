FROM ubuntu:16.04

#
# Install `platform-sdk` and its dependencies
#
# Notes:
#   - ppa:deadsnakes/ppa is used in order to install Python 3.6 on Ubuntu 16.04
#   - bootstrap.pypa.io/get-pip.py is used to install pip on Python 3.6
#
COPY platform-sdk/ /engine/platform-sdk/
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
    && pip --no-cache-dir install opencv-python-headless \
    && pip --no-cache-dir install -I tensorflow==1.12.0 \
    && pip --no-cache-dir install --upgrade numpy==1.16.0 \
    && rm -rf /var/lib/apt

#
# Declare environment variables that the platform will use to communicate with
# the image at runtime
#
ENV \
    TASK_DESCRIPTION=null \
    JOB_ID=null \
    API_TOKEN=null \
    API_BASE_URL=null \
    OS=null \
    LOGFILE_SIGNED_URL=null

# Expose port so image can read/write from external storage at runtime
EXPOSE 8000

# Install entrypoint files
COPY main.bash /engine/main.bash
COPY main.py /engine/main.py
RUN mkdir -p /var/log \
    && chmod +x /engine/main.bash \
    && chmod +x /engine/main.py

# Setup entrypoint
WORKDIR /engine
ENTRYPOINT ["bash", "main.bash"]
