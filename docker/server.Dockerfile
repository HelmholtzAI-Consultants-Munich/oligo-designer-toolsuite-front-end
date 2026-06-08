# using https://micromamba-docker.readthedocs.io/en/latest/index.html
FROM mambaorg/micromamba:2-alpine3.22

# --- Set up Python environment ---
RUN --mount=source=backend/environment.yml,target=/tmp/env.yml \
    --mount=type=cache,target=/opt/conda/pkgs,uid=$MAMBA_USER_ID \
    micromamba install -y -n base -f /tmp/env.yml

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

CMD ["flask", "run", "--host=0.0.0.0"]
