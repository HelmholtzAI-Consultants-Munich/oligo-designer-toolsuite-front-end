# using https://micromamba-docker.readthedocs.io/en/latest/index.html
FROM mambaorg/micromamba:2-alpine3.22

# --- Set up environment ---
COPY --chown=$MAMBA_USER:$MAMBA_USER environment.yml /tmp/env.yml
RUN micromamba install -y -n base -f /tmp/env.yml && \
    micromamba clean --all --yes

# --- Install oligo-designer-toolsuite ---
#  Installing odt locally requires git to infer the package version.
#  (see https://github.com/pypa/setuptools-scm)
USER root
RUN apk add --no-cache git
USER $MAMBA_USER

ADD --chown=$MAMBA_USER:$MAMBA_USER --keep-git-dir https://github.com/HelmholtzAI-Consultants-Munich/oligo-designer-toolsuite.git /tmp/odt

# activate conda environment to use pip during build
ARG MAMBA_DOCKERFILE_ACTIVATE=1
RUN pip install --no-cache-dir odt/

# --- Install Flask server ---
WORKDIR /app
COPY --chown=$MAMBA_USER:$MAMBA_USER . .

CMD ["python", "app.py"]
