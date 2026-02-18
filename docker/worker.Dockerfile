# using https://micromamba-docker.readthedocs.io/en/latest/index.html
FROM mambaorg/micromamba:2-alpine3.22

# --- Set up environment ---
RUN --mount=source=backend/worker_environment.yml,target=/tmp/env.yml \
    --mount=type=cache,target=/opt/conda/pkgs,uid=$MAMBA_USER_ID \
    micromamba install -y -n base -f /tmp/env.yml

# --- Install platform-specific build tools for ARM ---
# these are required to install oligo-designer-toolsuite on ARM
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then \
    micromamba install -y -n base -c conda-forge \
    gcc_linux-aarch64 \
    gxx_linux-aarch64; \
    fi

# --- Install Python dependencies ---
# activate conda environment to use pip during build
ARG MAMBA_DOCKERFILE_ACTIVATE=1
RUN --mount=type=cache,target=/home/$MAMBA_USER/.cache/pip,uid=$MAMBA_USER_ID \
    pip install git+https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite.git
RUN --mount=source=backend/pyproject.toml,target=pyproject.toml \
    --mount=type=cache,target=/home/$MAMBA_USER/.cache/pip,uid=$MAMBA_USER_ID \
    pip install --group worker

# --- Copy Celery worker ---
# schemas are copied to /app/schemas to match the relative path in pipeline_runner.py
WORKDIR /app
# Copy the entire backend directory
COPY --chown=$MAMBA_USER:$MAMBA_USER backend backend
COPY --chown=$MAMBA_USER:$MAMBA_USER schemas schemas


CMD ["celery", "-A", "backend.worker", "worker", "-l", "INFO"]
