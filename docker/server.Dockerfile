# using https://micromamba-docker.readthedocs.io/en/latest/index.html
FROM mambaorg/micromamba:2-alpine3.22

LABEL org.opencontainers.image.url https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end
LABEL org.opencontainers.image.source https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite-front-end
LABEL org.opencontainers.image.title "odt-server"
LABEL org.opencontainers.image.description "Flask API backend for ODT Cloud"
LABEL org.opencontainers.image.licenses MIT

# --- Set up Python environment ---
RUN --mount=source=backend/environment.yml,target=/tmp/env.yml \
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
RUN --mount=source=backend/pyproject.toml,target=pyproject.toml \
    --mount=type=cache,target=/home/$MAMBA_USER/.cache/pip,uid=$MAMBA_USER_ID \
    pip install --group test

# --- Copy Flask server ---
WORKDIR /app
COPY --chown=$MAMBA_USER:$MAMBA_USER backend backend

ENV FLASK_APP=backend.app

EXPOSE 5000

CMD [ "gunicorn", "backend.app:create_app()", "--bind", "0.0.0.0:5000" ]
