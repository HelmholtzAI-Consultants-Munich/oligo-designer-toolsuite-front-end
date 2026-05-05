export const reverseComplement = (sequence: string): string => {
    return sequence
        .split("")
        .reverse()
        .map((base) => {
            switch (base) {
                case "A":
                    return "T";
                case "T":
                    return "A";
                case "C":
                    return "G";
                case "G":
                    return "C";
                default:
                    return base;
            }
        })
        .join("");
};

import type { GenomicRegion, GenomicRegions, Probe } from "../../types";

export type OligoPosition = {
    start: number;
    end: number;
    id: string;
    transcript_ids: string[];
    type: "probe" | "gap";
};

export type Base = { char: string; position: number };

export const Regions: { [key: string]: { color: string; label: string } } = {
    exon: { color: "blue", label: "Exon" },
    intron: { color: "red", label: "Intron" },
    CDS: { color: "green", label: "CDS" },
    three_prime_UTR: { color: "orange", label: "3' UTR" },
    five_prime_UTR: { color: "orange", label: "5' UTR" },
    exonexonjunction: { color: "darkblue", label: "Start / End of Exon" },
    gene: { color: "purple", label: "Gene" },
    unknown: { color: "lightgray", label: "Unknown" },
};

export const oligoTooltipHTML = (
    d: OligoPosition,
    genomicRegions: GenomicRegions
) => {
    const matchingTranscripts = d.transcript_ids.length;
    const totalTranscripts = Object.keys(genomicRegions).length;
    return (
        d.id +
        "<br>Transcripts:<br>" +
        (matchingTranscripts < 10
            ? d.transcript_ids.join(", ")
            : `${matchingTranscripts} of ${totalTranscripts} transcripts match this oligo`)
    );
};

export const regionTooltipHTML = (d: GenomicRegion, transcriptName: string) => {
    return (
        Regions[d.regiontype || "unknown"].label +
        (d.exon_number ? " " + d.exon_number.toString() : "") +
        `<br>Transcript: ${transcriptName}`
    );
};

export const transcriptTooltipHTML = (
    d: string,
    oligoPositions: OligoPosition[]
) => {
    const matchingOligos = oligoPositions.filter((oligo) =>
        oligo.transcript_ids.includes(d)
    );
    const uniqueOligoIds = Array.from(new Set(matchingOligos.map((o) => o.id)));
    return (
        `Transcript: ${d}` +
        "<br>Matching Oligos:<br>" +
        (uniqueOligoIds.length < 10
            ? uniqueOligoIds.join(", ")
            : `${uniqueOligoIds.length} oligos match this transcript`)
    );
};

export const calculeArrowSpacing = (visibleRange: number) => {
    if (visibleRange <= 150) return 10;
    if (visibleRange <= 300) return 20;
    if (visibleRange <= 600) return 40;
    if (visibleRange <= 1200) return 80;
    return 160;
};

// Collect one base per position from genomic regions within the specified range
export const collectReferenceBases = (
    regions: GenomicRegions,
    start: number,
    end: number
) => {
    const allRegions = Object.values(regions).flat();
    allRegions.sort((a, b) => a.start - b.start);
    let collectingPosition = start;
    const bases: Base[] = [];

    allRegions.forEach((region) => {
        if (!region.sequence) {
            return;
        }
        if (collectingPosition >= region.end + 1) {
            return; // already collected this region
        }
        if (collectingPosition > end) {
            return; // beyond desired end
        }

        // Start collecting from the max of current collecting position or region start
        const regionStartPos = Math.max(collectingPosition, region.start);
        for (let pos = regionStartPos; pos <= region.end && pos <= end; pos++) {
            bases.push({
                char: region.sequence[pos - region.start],
                position: pos,
            });
        }
        collectingPosition = region.end + 1;
    });

    return bases;
};

// Collect oligo positions for all components of all probes
export const collectOligoPositions = (probes: Probe[]): OligoPosition[] => {
    return probes.flatMap((oligo) =>
        oligo.components.map((component) => ({
            start: component.start,
            end: component.end,
            id: oligo.oligo_id,
            transcript_ids: oligo.transcript_ids,
            type: component.type,
        }))
    );
};

export const collectOligoBases = (
    probes: Probe[],
    start: number,
    end: number
): Base[] => {
    const visibleProbes = probes.filter((probe) =>
        probe.components.some(
            (component) =>
                component.end >= start &&
                component.start <= end &&
                component.type === "probe"
        )
    );

    return visibleProbes.flatMap((probe) => {
        let sequence =
            probe.pipeline === "oligoseq"
                ? probe.details.oligo
                : probe.details.sequence_target_probe;
        if (probe.details.strand === "+") {
            sequence = sequence.split("").reverse().join("");
        }
        let cursor = 0;

        return probe.components.flatMap((component) => {
            if (component.type !== "probe") {
                return [];
            }
            const componentBases = [];
            const cursorStart = cursor;
            const cursorEnd = cursor + component.end - component.start;
            for (; cursor <= cursorEnd; cursor++) {
                componentBases.push({
                    char: sequence[cursor],
                    position: component.start + (cursor - cursorStart),
                });
            }
            return componentBases;
        });
    });
};
