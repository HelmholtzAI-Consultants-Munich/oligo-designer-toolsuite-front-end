import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders page", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: /Documentation/i })
    ).toHaveAttribute(
        "href",
        "https://oligo-designer-toolsuite.readthedocs.io/en/latest/index.html"
    );
    expect(
        screen.getByRole("link", { name: /View the publication/i })
    ).toHaveAttribute("href", "https://doi.org/10.5281/zenodo.7823048");
    expect(
        screen.getByRole("button", { name: /Start Designing/i })
    ).toBeInTheDocument();
});
