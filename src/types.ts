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
    strand: "+" | "-";
    components: {
        start: number;
        end: number;
        type: "probe" | "gap";
    }[];
    transcript_ids: string[];
}

export interface Probesets {
    [probeset_name: string]: Probe[];
}
    

export type RunState = "started" | "success" | "failure" | "pending";
