import { useState, useEffect } from "react";
import type { User } from "../types";
import { BACKEND_URL } from "../config";
import { AuthContext } from "../hooks/useAuth";
import { useRuns } from "../hooks/useRuns";

export default function AuthProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const { updateRuns } = useRuns();

    const checkAuth = async () => {
        setLoading(true);
        try {
            const response = await fetch(BACKEND_URL + "/api/check_auth", {
                credentials: "include",
            });
            const data = await response.json();
            setUser(data.authenticated ? data.user : null);
        } catch (error) {
            console.error("Auth check failed:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const logout = () => {
        setUser(null);
        updateRuns();
    };

    return (
        <AuthContext.Provider value={{ user, loading, checkAuth, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
