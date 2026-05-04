export const pipelineDisplayNames: Record<string, string> = {
    scrinshot: "Scrinshot",
    merfish: "Merfish",
    seqfish: "SeqFish+",
    oligoseq: "OligoSeq",
    generator: "Genomic Region Generator",
};

export const pipelineRoutes: Record<string, string> = {
    scrinshot: "/pipelines/scrinshot",
    merfish: "/pipelines/merfish",
    seqfish: "/pipelines/seqfish",
    oligoseq: "/pipelines/oligoseq",
};

export const visualizationDisplayNames = {
    alignment: "Genomic Regions",
    components: "Oligo Components",
};

export type VisualizationType = keyof typeof visualizationDisplayNames;

export const formatDateTime = (date: string | Date): string =>
    new Date(date).toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
