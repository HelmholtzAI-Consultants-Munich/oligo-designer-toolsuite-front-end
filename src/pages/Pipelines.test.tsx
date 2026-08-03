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

test("shows an equal-height card for each enabled pipeline only", () => {
    render(
        <MemoryRouter>
            <AuthContext.Provider value={anonymousAuth}>
                <Pipelines />
            </AuthContext.Provider>
        </MemoryRouter>
    );

    expect(
        screen.getByRole("heading", { name: "Pipeline Overview" })
    ).toBeInTheDocument();
    expect(screen.getByText("OligoSeq Probe Designer")).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Use Pipeline" })
    ).toBeInTheDocument();
    expect(
        screen.queryByText("Merfish Probe Designer")
    ).not.toBeInTheDocument();
});
