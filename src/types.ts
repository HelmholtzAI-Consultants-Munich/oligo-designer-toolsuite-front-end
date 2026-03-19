export interface User {
    id: string;
    username?: string;
    role?: "user" | "admin";
    helmholtz_sub?: string;
    accepted_terms_version?: string | null;
    terms_accepted_at?: string | null;
    current_terms_version?: string;
}

export interface TermsAcceptanceStatus {
    scope: "user" | "session";
    current_terms_version: string;
    accepted_terms_version?: string | null;
    terms_accepted_at?: string | null;
    requires_terms_acceptance: boolean;
}

export interface LegalDocument {
    document: string;
    title: string;
    version: string;
    body: string;
    status: "published" | "archived";
    published_at?: string | null;
}

export interface AuthContextType {
    user: User | null;
    loading: boolean;
    legal: TermsAcceptanceStatus | null;
    acceptTerms: () => Promise<boolean>;
    checkAuth: () => Promise<void>;
    logout: () => void;
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

export interface BaseProbe {
    oligo_id: string;
    components: {
        start: number;
        end: number;
        type: "probe" | "gap";
    }[];
    transcript_ids: string[];
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

export type ProbeDetailsValue = string | number | string[] | number[];

export type RunState = "started" | "success" | "failure" | "pending";
