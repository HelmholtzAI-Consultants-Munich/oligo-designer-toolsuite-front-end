import { useState, useEffect } from "react";
import type { AuthState, TermsAcceptanceStatus, User } from "../types";
import { BACKEND_URL } from "../config";
import { AuthContext } from "./authContext";

type AuthCheckResponse =
    | {
          authenticated: true;
          user: User;
          legal?: {
              scope: "user";
              current_terms_version: string;
              accepted_terms_version?: string | null;
              terms_accepted_at?: string | null;
              requires_terms_acceptance: boolean;
          } | null;
      }
    | {
          authenticated: false;
          legal?: TermsAcceptanceStatus | null;
      };

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [authState, setAuthState] = useState<AuthState>({
        kind: "unauthenticated",
        legal: null,
    });
    const [loading, setLoading] = useState(true);

    const loadAuth = async (showLoading: boolean) => {
        if (showLoading) {
            setLoading(true);
        }
        try {
            const response = await fetch(BACKEND_URL + "/api/check_auth", {
                credentials: "include",
            });
            const data = (await response.json()) as AuthCheckResponse;
            setAuthState(
                data.authenticated
                    ? {
                          kind: "authenticated",
                          user: data.user,
                      }
                    : {
                          kind: "unauthenticated",
                          legal: data.legal ?? null,
                      }
            );
        } catch (error) {
            console.error("Auth check failed:", error);
            setAuthState({
                kind: "unauthenticated",
                legal: null,
            });
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
                ...authState,
                loading,
                acceptTerms,
                checkAuth,
                logout,
            }}
        >
            {!loading && children}
        </AuthContext.Provider>
    );
}
