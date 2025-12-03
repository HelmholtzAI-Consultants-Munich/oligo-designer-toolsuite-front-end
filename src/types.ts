export interface User {
    id: number;
    email: string;
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
