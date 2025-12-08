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
    strand?: "+" | "-";
    regiontype?: string;
}

export interface GenomicRegions {
    [key: string]: GenomicRegion[];
}
export type RunState = "STARTED" | "SUCCESS" | "FAILURE" | "PENDING"
