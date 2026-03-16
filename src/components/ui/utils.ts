export const pipelineDisplayNames: Record<string, string> = {
    scrinshot: "Scrinshot",
    merfish: "Merfish",
    seqfish: "SeqFish+",
    oligoseq: "Oligo-Seq",
};

export const visualizationDisplayNames = {
    alignment: "Genomic Regions",
    components: "Oligo Components",
};

export type VisualizationType = keyof typeof visualizationDisplayNames;
