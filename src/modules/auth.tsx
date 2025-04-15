import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const response = await fetch('http://localhost:5000/api/check_auth', {
                credentials: 'include',
            });
            const data = await response.json();
            if (data.authenticated) {
                setUser(data.user);
            }
        } catch (error) {
            console.error('Auth check failed:', error);
        }finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = (user: User) => setUser(user);
    const logout = () => setUser(null);

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);