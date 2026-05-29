import { useState, useEffect } from "react";
import type { AuthState, TermsAcceptanceStatus, User } from "../types";
import { BACKEND_URL } from "../config";
import { AuthContext } from "../hooks/useAuth";
import { useRuns } from "../hooks/useRuns";
import { confirmWithModal } from "../utils/modalUtil";
import { showToast } from "../utils/toastUtil";

export default function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [authState, setAuthState] = useState<AuthState>({
        authenticated: false,
        user: null,
        legal: null,
    });
    const [loading, setLoading] = useState(true);
    const { updateRuns } = useRuns();

    const checkAuth = async () => {
        setLoading(true);
        try {
            const response = await fetch(BACKEND_URL + "/api/check_auth", {
                credentials: "include",
            });
            const data = await response.json();
            setAuthState({
                authenticated: data.authenticated,
                user: data.authenticated ? (data.user as User) : null,
                legal: (data.legal as TermsAcceptanceStatus) ?? null,
            });
        } catch (error) {
            console.error("Auth check failed:", error);
            setAuthState({ authenticated: false, user: null, legal: null });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const acceptTerms = async (): Promise<boolean> => {
        try {
            const response = await fetch(
                BACKEND_URL + "/api/legal/terms/accept",
                { method: "POST", credentials: "include" }
            );
            if (!response.ok) return false;
            await checkAuth();
            return true;
        } catch (error) {
            console.error("Terms acceptance failed:", error);
            return false;
        }
    };

    const logout = () => {
        fetch(BACKEND_URL + "/logout", {
            method: "POST",
            credentials: "include",
        })
            .then(() => {
                setAuthState({ authenticated: false, user: null, legal: null });
                updateRuns();
            })
            .catch(() => {
                showToast({
                    title: "Logout Failed",
                    content:
                        "An error occurred while logging out. Please try again.",
                    type: "danger",
                });
            });
    };

    const logoutWithConfirmation = () => {
        confirmWithModal({
            title: "Confirm Logout",
            content: "Are you sure you want to log out?",
            primaryAction: {
                label: "Logout",
                callback: logout,
                variant: "danger",
            },
        });
    };

    return (
        <AuthContext.Provider
            value={{
                ...authState,
                loading,
                acceptTerms,
                checkAuth,
                logout,
                logoutWithConfirmation,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
