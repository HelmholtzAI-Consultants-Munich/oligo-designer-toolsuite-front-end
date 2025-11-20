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
