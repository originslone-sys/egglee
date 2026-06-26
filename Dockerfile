FROM runpod/pytorch:2.2.1-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 git wget curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py .
COPY workflows/ /workflows/
COPY characters/ /characters/

CMD ["python", "-u", "handler.py"]
