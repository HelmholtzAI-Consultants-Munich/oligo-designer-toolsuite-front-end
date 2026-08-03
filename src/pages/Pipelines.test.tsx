import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Pipelines from "./Pipelines";
import { AuthContext } from "../hooks/useAuth";

const anonymousAuth = {
    authenticated: false as const,
    user: null,
    legal: null,
    loading: false,
    acceptTerms: async () => false,
    checkAuth: async () => {},
    logout: () => {},
    logoutWithConfirmation: () => {},
};

test("shows all pipelines while disabling unavailable options", () => {
    render(
        <MemoryRouter>
            <AuthContext.Provider value={anonymousAuth}>
                <Pipelines />
            </AuthContext.Provider>
        </MemoryRouter>
    );

    expect(
        screen.getByRole("heading", { name: "Choose a Design Pipeline" })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("heading", { name: "OligoSeq" })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("heading", { name: "cycleHCR" })
    ).toBeInTheDocument();

    const actions = screen.getAllByRole("button", { name: /Use Pipeline/i });
    expect(actions).toHaveLength(6);
    expect(actions[0]).toBeEnabled();
    expect(actions[1]).toBeDisabled();
});
