# using https://micromamba-docker.readthedocs.io/en/latest/index.html
FROM mambaorg/micromamba:2

# --- Set up environment ---
COPY --chown=$MAMBA_USER:$MAMBA_USER environment.yml /tmp/env.yml
RUN micromamba install -y -n base -f /tmp/env.yml && \
    micromamba clean --all --yes

# --- Install build tools for C extensions ---
RUN micromamba install -y -n base -c conda-forge \
    gcc_linux-aarch64 \
    gxx_linux-aarch64 \
    && micromamba clean --all --yes

# --- Install oligo-designer-toolsuite ---
# activate conda environment to use pip during build
ARG MAMBA_DOCKERFILE_ACTIVATE=1
RUN pip install --no-cache-dir git+https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite.git

# --- Install Flask server ---
WORKDIR /app
COPY --chown=$MAMBA_USER:$MAMBA_USER . .

CMD ["python", "app.py"]
