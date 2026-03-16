import { useState, useEffect } from "react";
import type { TermsAcceptanceStatus, User } from "../types";
import { BACKEND_URL } from "../config";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [legal, setLegal] = useState<TermsAcceptanceStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const loadAuth = async (showLoading: boolean) => {
        if (showLoading) {
            setLoading(true);
        }
        try {
            const response = await fetch(BACKEND_URL + "/api/check_auth", {
                credentials: "include",
            });
            const data = await response.json();
            setUser(data.authenticated ? data.user : null);
            setLegal(data.legal ?? null);
        } catch (error) {
            console.error("Auth check failed:", error);
            setUser(null);
            setLegal(null);
        } finally {
            if (showLoading) {
                setLoading(false);
            }
        }
    };

    const checkAuth = async () => {
        await loadAuth(true);
    };

    useEffect(() => {
        void loadAuth(true);
    }, []);

    const logout = () => {
        void loadAuth(false);
    };

    const acceptTerms = async () => {
        try {
            const response = await fetch(
                BACKEND_URL + "/api/legal/terms/accept",
                {
                    method: "POST",
                    credentials: "include",
                }
            );
            if (!response.ok) {
                return false;
            }

            await loadAuth(false);
            return true;
        } catch (error) {
            console.error("Terms acceptance failed:", error);
            return false;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                legal,
                acceptTerms,
                checkAuth,
                logout,
            }}
        >
            {!loading && children}
        </AuthContext.Provider>
    );
}
