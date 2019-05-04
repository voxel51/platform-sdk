FROM ubuntu:16.04

# Install `platform-sdk` and its dependencies
COPY platform-sdk/ /engine/platform-sdk/
RUN apt-get update \
    && apt-get -y --no-install-recommends install \
        software-properties-common \
    && add-apt-repository -y ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get -y --no-install-recommends install \
        sudo \
        build-essential \
        pkg-config \
        ca-certificates \
        unzip \
        git \
        curl \
        libcupti-dev \
        python3.6 \
        python3-dev \
        python3-pip \
        python3-setuptools \
        ffmpeg \
        imagemagick \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && ln -s /usr/bin/pip3 /usr/bin/pip \
    && python -m pip install --upgrade pip \
    && python -m pip --no-cache-dir install -r /engine/platform-sdk/requirements.txt \
    && python -m pip --no-cache-dir install -r /engine/platform-sdk/eta/requirements.txt \
    && python -m pip --no-cache-dir install -e /engine/platform-sdk/. \
    && python -m pip --no-cache-dir install -e /engine/platform-sdk/eta/. \
    && python -m pip --no-cache-dir install opencv-python-headless \
    && python -m pip --no-cache-dir install -I tensorflow==1.12.0 \
    && python -m pip --no-cache-dir install --upgrade numpy==1.16.0 \
    && rm -rf /var/lib/apt

# Declare environment variables that the platform will use to communicate with
# the image at runtime
ENV TASK_DESCRIPTION=null JOB_ID=null API_TOKEN=null API_BASE_URL=null OS=null LOGFILE_SIGNED_URL=null

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
