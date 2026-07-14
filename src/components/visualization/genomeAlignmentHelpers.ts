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

/**
 * Generates HTML content for tooltips when hovering an oligo.
 *
 * @param probe The probe for which the tooltip is being generated.
 * @param genomicRegions The genomic regions that may be relevant for the tooltip content, used to determine how many transcripts match the oligo.
 * @returns A string containing HTML content for the tooltip.
 */
export const oligoTooltipHTML = (
    probe: Probe,
    genomicRegions: GenomicRegions
) => {
    const matchingTranscripts = probe.transcript_ids.length;
    const totalTranscripts = Object.keys(genomicRegions).length;
    return (
        probe.oligo_id +
        (matchingTranscripts !== 0
            ? "<br>Transcripts:<br>" +
              (matchingTranscripts < 10
                  ? probe.transcript_ids.join(", ")
                  : `${matchingTranscripts} of ${totalTranscripts} transcripts match this oligo`)
            : "")
    );
};

/**
 * Generates HTML content for tooltips when hovering a genomic region.
 *
 * @param region The genomic region for which the tooltip is being generated.
 * @param transcriptName The name of the transcript associated with the region.
 * @returns A string containing HTML content for the tooltip.
 */
export const regionTooltipHTML = (
    region: GenomicRegion,
    transcriptName: string
) => {
    return (
        Regions[region.regiontype || "unknown"].label +
        (region.exon_number ? " " + region.exon_number.toString() : "") +
        (transcriptName !== "unknown"
            ? `<br>Transcript: ${transcriptName}`
            : "")
    );
};

/**
 * Generates HTML content for tooltips when hovering a transcript.
 *
 * @param transcriptId The ID of the transcript for which the tooltip is being generated.
 * @param oligoComponents The oligo components that may be relevant for the tooltip content, used to determine which oligos match the transcript.
 * @returns A string containing HTML content for the tooltip.
 */
export const transcriptTooltipHTML = (
    transcriptId: string,
    oligoComponents: OligoPosition[]
) => {
    const matchingOligos = oligoComponents.filter((oligo) =>
        oligo.transcript_ids.includes(transcriptId)
    );
    const uniqueOligoIds = Array.from(new Set(matchingOligos.map((o) => o.id)));
    return (
        `Transcript: ${transcriptId}` +
        "<br>Matching Oligos:<br>" +
        (uniqueOligoIds.length < 10
            ? uniqueOligoIds.join(", ")
            : `${uniqueOligoIds.length} oligos match this transcript`)
    );
};

/**
 * Calculates the spacing between arrows in the visualization based on the visible range of the genomic region, avoiding overcrowding.
 *
 * @param visibleRange The length of the currently visible range in the visualization (right edge - left edge).
 * @returns The desired distance between arrows.
 */
export const calculateArrowSpacing = (visibleRange: number) => {
    if (visibleRange <= 150) return 10;
    if (visibleRange <= 300) return 20;
    if (visibleRange <= 600) return 40;
    if (visibleRange <= 1200) return 80;
    return 160;
};

/**
 * Collects the reference bases (one base per position) from the genomic regions that overlap with the specified range.
 *
 * @param regions The genomic regions from which to collect bases.
 * @param start The start position of the range for which to collect bases.
 * @param end The end position of the range for which to collect bases.
 * @returns An array of Base objects representing the collected bases and their positions.
 */
export const collectReferenceBases = (
    regions: GenomicRegions,
    start: number,
    end: number
) => {
    const visibleRegions = Object.values(regions).flatMap((regions) =>
        regions.filter(
            (region) =>
                region.end >= start && region.start <= end && region.sequence
        )
    );
    visibleRegions.sort((a, b) => a.start - b.start);
    let collectingPosition = start;
    const bases: Base[] = [];

    visibleRegions.forEach((region) => {
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

/**
 * Collects the positions of oligo components (probes and gaps) from the provided probes.
 *
 * @param probes The array of probes from which to collect oligo components.
 * @returns An array of OligoPosition objects representing the positions and details of the oligo components.
 */
export const collectOligoComponents = (probes: Probe[]): OligoPosition[] => {
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

/**
 * Collects the bases from the probes that overlap with the specified range.
 *
 * @param probes The array of probes from which to collect bases.
 * @param start The start position of the range for which to collect bases.
 * @param end The end position of the range for which to collect bases.
 * @returns An array of Base objects representing the collected bases and their positions.
 */
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

/**
 * Computes the reverse complement of a base sequence (consisting of A, T, C, G).
 *
 * @param sequence The input base sequence for which to compute the reverse complement.
 * @returns The reverse complement of the input sequence.
 */
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

/**
 * Calculates the x position and width for a probe rectangle, ensuring a minimum width for visibility while keeping it centered on the probe's actual position.
 *
 * @param startX - The x position corresponding to the start of the probe.
 * @param endX - The x position corresponding to the end of the probe.
 * @param minWidth - The minimum width for the probe rectangle to ensure visibility.
 * @returns An object containing the adjusted x position and width for the probe rectangle.
 */
export const centeredMinWidthRect = (
    startX: number,
    endX: number,
    minWidth: number
) => {
    const width = endX - startX;
    if (width >= minWidth) {
        return { x: startX, width };
    }

    const center = (startX + endX) / 2;
    return {
        x: center - minWidth / 2,
        width: minWidth,
    };
};
