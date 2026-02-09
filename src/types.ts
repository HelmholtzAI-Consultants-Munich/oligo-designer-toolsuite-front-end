export interface User {
    id: string;
    email: string;
    name?: string;
    role?: "user" | "admin";
}

export interface AuthContextType {
    user: User | null;
    loading: boolean;
    checkAuth: () => Promise<void>;
    logout: () => void;
}

export interface Oligo {
    oligo_id: string;
    [key: string]: any;
}

export interface GenomicRegion {
    start: number;
    end: number;
    sequence: string;
    reading_grid_offset?: 0 | 1 | 2;
    strand?: "+" | "-";
    regiontype?: string;
    inferred?: boolean;
    exon_number?: number;
}

export interface GenomicRegions {
    [transcript_id: string]: GenomicRegion[];
}

export interface Probe {
    oligo_id: string;
    components: {
        start: number;
        end: number;
        type: "probe" | "gap";
    }[];
    transcript_ids: string[];
    details: ProbeDetails;
}

export type ProbeDetails = ScrinshotProbeDetails | SeqFishProbeDetails | MerfishProbeDetails | OligoSeqProbeDetails;

interface BaseProbeDetails {
    oligo_id: string;
    start: number;
    end: number;
    chromosome: string;
    source: string;
    species: string;
    annotation_release: string;
    genome_assembly: string;
    strand: "+" | "-";
    length: number;
    sequence_target: string;
    sequence_target_probe: string;
}

interface ScrinshotProbeDetails extends BaseProbeDetails {
    type: "scrinshot";
    sequence_padlock_probe: string;
    sequence_detection_oligo: string;
    sequence_padlock_arm1: string;
    sequence_padlock_accessory1: string;
    sequence_padlock_ISS_anchor: string;
    barcode: string;
    sequence_padlock_accessory2: string;
    sequence_padlock_arm2: string;
    ligation_site: number;
    Tm_arm1: number;
    Tm_arm2: number;
    Tm_diff_arms: number;
    Tm_detection_oligo: number;
    isoform_consensus: number;
}

interface SeqFishProbeDetails extends BaseProbeDetails {
    type: "seqfish";
    sequence_seqfish_plus_probe: string;
    sequence_encoding_probe: string;
    sequence_readout_probe_1: string;
    sequence_readout_probe_2: string;
    sequence_readout_probe_3: string;
    sequence_readout_probe_4: string;
    sequence_forward_primer: string;
    sequence_reverse_primer: string;
    GC_content: number;
}

interface MerfishProbeDetails extends BaseProbeDetails {
    type: "merfish";
    sequence_merfish_probe: string;
    sequence_encoding_probe: string;
    sequence_readout_probe_1: string;
    sequence_readout_probe_2: string;
    sequence_forward_primer: string;
    sequence_reverse_primer: string;
    GC_content: number;
}

interface OligoSeqProbeDetails extends BaseProbeDetails {
    type: "oligoseq";
    oligo: string;
    target: string;
    GC_content: number;
    TmNN: number;
    num_targeted_transcripts: number;
    number_total_transcripts: string; // TODO: this should be a number
    isoform_consensus: number;
    length_selfcomplement: number;
}

export interface Probesets {
    [probeset_name: string]: Probe[];
}

export type RunState = "started" | "success" | "failure" | "pending";
