import { useState, useEffect } from "react";
import type { TermsAcceptanceStatus, User } from "../types";
import { BACKEND_URL } from "../config";
import { AuthContext } from "./authContext";

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [legal, setLegal] = useState<TermsAcceptanceStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [termsPromptOpen, setTermsPromptOpen] = useState(false);

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
            setTermsPromptOpen(
                Boolean(
                    data.authenticated && data.legal?.requires_terms_acceptance
                )
            );
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
        setTermsPromptOpen(false);
        void loadAuth(false);
    };

    const ensureTermsAccepted = async () => {
        if (!legal?.requires_terms_acceptance) {
            return true;
        }

        setTermsPromptOpen(true);
        return false;
    };

    const closeTermsPrompt = () => {
        setTermsPromptOpen(false);
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
            setTermsPromptOpen(false);
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
                termsPromptOpen,
                ensureTermsAccepted,
                acceptTerms,
                closeTermsPrompt,
                checkAuth,
                logout,
            }}
        >
            {!loading && children}
        </AuthContext.Provider>
    );
}
