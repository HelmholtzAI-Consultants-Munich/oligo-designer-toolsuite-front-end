# using https://micromamba-docker.readthedocs.io/en/latest/index.html
FROM mambaorg/micromamba:2-alpine3.22

# --- Set up environment ---
RUN --mount=source=flask/worker_environment.yml,target=/tmp/env.yml \
    --mount=type=cache,target=/opt/conda/pkgs,uid=$MAMBA_USER_ID \
    micromamba install -y -n base -f /tmp/env.yml

# --- Install platform-specific build tools for ARM ---
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
RUN --mount=source=flask/pyproject.toml,target=pyproject.toml \
    --mount=type=cache,target=/home/$MAMBA_USER/.cache/pip,uid=$MAMBA_USER_ID \
    pip install --group test


# --- Copy Celery worker ---
WORKDIR /app
COPY --chown=$MAMBA_USER:$MAMBA_USER flask/*.py .
COPY --chown=$MAMBA_USER:$MAMBA_USER flask/worker worker

CMD ["celery", "-A", "worker", "worker", "-l", "INFO"]