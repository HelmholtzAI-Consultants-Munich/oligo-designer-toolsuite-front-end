FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

COPY package.json package-lock.json playwright.config.ts ./
RUN npm ci
ENV CI=true

# Only the two smallest FASTA fixtures (see tests/e2e/helpers.ts FASTA_FIXTURES).
COPY \
    backend/data/genomic_regions/cds_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna \
    backend/data/genomic_regions/utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna \
    ./backend/data/genomic_regions/
COPY tests ./tests

ENTRYPOINT ["npx", "playwright"]
CMD ["test"]
