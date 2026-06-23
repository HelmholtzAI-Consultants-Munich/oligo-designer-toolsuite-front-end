export interface User {
    id: string;
    username?: string;
    role?: "user" | "admin";
    helmholtz_sub?: string;
}

export interface TermsAcceptanceStatus {
    current_terms_version: string;
    accepted_terms_version?: string | null;
    terms_accepted_at?: string | null;
}

export type AuthState =
    | {
          authenticated: true;
          user: User;
          legal: TermsAcceptanceStatus | null;
      }
    | {
          authenticated: false;
          user: null;
          legal: TermsAcceptanceStatus | null;
      };

export interface LegalDocument {
    document: string;
    title: string;
    version: string;
    body: string;
    published_at?: string | null;
}

export type AuthContextType = AuthState & {
    loading: boolean;
    acceptTerms: () => Promise<boolean>;
    checkAuth: () => Promise<void>;
    logout: () => void;
    logoutWithConfirmation: () => void;
};

export interface GenomicRegion {
    start: number;
    end: number;
    sequence: string;
    strand?: "+" | "-";
    regiontype?: string;
    inferred?: boolean;
    exon_number?: number;
}

export interface GenomicRegions {
    [transcript_id: string]: GenomicRegion[];
}

export interface BaseProbe {
    oligo_id: string;
    components: {
        start: number;
        end: number;
        type: "probe" | "gap";
    }[];
    transcript_ids: string[];
    start: number;
    end: number;
    details: BaseProbeDetails;
}

interface BaseProbeDetails {
    oligo_id: string;
    source: string;
    species: string;
    annotation_release: string;
    genome_assembly: string;
    regiontype: string;
    gene_id: string;
    transcript_id: string[];
    exon_number: number[];
    chromosome: string;
    start: number;
    end: number;
    strand: "+" | "-";
    length: number;
}

interface ScrinshotProbeDetails {
    sequence_padlock_probe: string;
    sequence_detection_oligo: string;
    sequence_padlock_arm1: string;
    sequence_padlock_accessory1: string;
    sequence_padlock_ISS_anchor: string;
    barcode: string;
    sequence_padlock_accessory2: string;
    sequence_padlock_arm2: string;
    sequence_target: string;
    sequence_target_probe: string;
    ligation_site: number;
    Tm_arm1: number;
    Tm_arm2: number;
    Tm_diff_arms: number;
    Tm_detection_oligo: number;
    isoform_consensus: number;
}

export type ScrinshotProbe = BaseProbe & {
    pipeline: "scrinshot";
    details: ScrinshotProbeDetails;
};

interface SeqFishProbeDetails {
    sequence_seqfish_plus_probe: string;
    sequence_encoding_probe: string;
    sequence_readout_probe_1: string;
    sequence_readout_probe_2: string;
    sequence_readout_probe_3: string;
    sequence_readout_probe_4: string;
    sequence_forward_primer: string;
    sequence_reverse_primer: string;
    sequence_target: string;
    sequence_target_probe: string;
    GC_content: number;
}

export type SeqFishProbe = BaseProbe & {
    pipeline: "seqfish";
    details: SeqFishProbeDetails;
};

interface MerfishProbeDetails {
    sequence_merfish_probe: string;
    sequence_encoding_probe: string;
    sequence_readout_probe_1: string;
    sequence_readout_probe_2: string;
    sequence_forward_primer: string;
    sequence_reverse_primer: string;
    sequence_target: string;
    sequence_target_probe: string;
    GC_content: number;
}

export type MerfishProbe = BaseProbe & {
    pipeline: "merfish";
    details: MerfishProbeDetails;
};

interface OligoSeqProbeDetails {
    oligo: string;
    target: string;
    GC_content: number;
    TmNN: number;
    num_targeted_transcripts: number;
    number_total_transcripts: string; // TODO: this should be a number
    isoform_consensus: number;
    length_selfcomplement: number;
}

export type OligoSeqProbe = BaseProbe & {
    pipeline: "oligoseq";
    details: OligoSeqProbeDetails;
};

export type Probe =
    | ScrinshotProbe
    | SeqFishProbe
    | MerfishProbe
    | OligoSeqProbe;
export type ProbeDetails = BaseProbeDetails &
    (
        | ScrinshotProbeDetails
        | SeqFishProbeDetails
        | MerfishProbeDetails
        | OligoSeqProbeDetails
    );

export interface Probesets {
    [probeset_name: string]: Probe[];
}

export interface ProbesetScores {
    [probeset_name: string]: ProbeScore;
}

export interface ProbeScore {
    average: number;
    worst: number;
}

export type ProbeDetailsValue = string | number | string[] | number[];

export type RunState =
    | "started"
    | "success"
    | "failure"
    | "pending"
    | "timeout"
    | "empty_result";

export interface RunMetrics {
    started_at?: string;
    finished_at?: string;
    queue_wait_seconds?: number;
    execution_seconds?: number;
    total_seconds?: number;
}

export interface PipelineRun {
    _id: string;
    pipeline: string;
    status: RunState;
    timestamp: string;
    user_id: string;
    error_message?: string;
    priority: "high" | "default";
    queue_position: [number, number]; // [highPriorityAhead, defaultPriorityAhead]
    metrics?: RunMetrics;
}
