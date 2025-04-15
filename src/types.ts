export interface User {
    id: number;
    email: string;
}

export interface AuthContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
    loading: boolean;

}