FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ffmpeg libgl1 libglib2.0-0 git wget curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install ComfyUI's Python dependencies into the image. The ComfyUI source
# code and the models live on the network volume, but the Python environment
# (torch + all libs) comes from this image so it works on the serverless worker.
RUN git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git /tmp/ComfyUI \
    && pip install --no-cache-dir -r /tmp/ComfyUI/requirements.txt \
    && rm -rf /tmp/ComfyUI

# Custom node dependencies (WanVideo, VideoHelperSuite, IPAdapter+FaceID,
# Impact Pack + Subpack for FaceDetailer/hand detailer).
RUN pip install --no-cache-dir insightface onnxruntime ultralytics dill gguf \
    && for repo in \
        https://github.com/kijai/ComfyUI-WanVideoWrapper.git \
        https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git \
        https://github.com/cubiq/ComfyUI_IPAdapter_plus.git \
        https://github.com/ltdrdata/ComfyUI-Impact-Pack.git \
        https://github.com/ltdrdata/ComfyUI-Impact-Subpack.git \
        https://github.com/rgthree/rgthree-comfy.git \
        https://github.com/Fannovel16/comfyui_controlnet_aux.git ; do \
        name=$(basename "$repo" .git); \
        git clone --depth 1 "$repo" "/tmp/$name" || continue; \
        if [ -f "/tmp/$name/requirements.txt" ]; then \
            pip install --no-cache-dir -r "/tmp/$name/requirements.txt" || true; \
        fi; \
        rm -rf "/tmp/$name"; \
    done

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py .
COPY workflows/ /workflows/
COPY characters/ /characters/

CMD ["python", "-u", "handler.py"]
