export interface User {
    id: string;
    username?: string;
    role?: "user" | "admin";
    helmholtz_sub?: string;
}

export interface AuthContextType {
    user: User | null;
    loading: boolean;
    checkAuth: () => Promise<void>;
    logout: () => void;
}

/** JSON-serializable value (matches YAML/JSON pipeline output structure) */
export type OligoValue =
    | string
    | number
    | boolean
    | null
    | OligoValue[]
    | { [key: string]: OligoValue };

export interface Oligo {
    oligo_id: string;
    [key: string]: OligoValue;
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
    [key: string]: GenomicRegion[];
}

export type RunState = "started" | "success" | "failure" | "pending";
