import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    OLIGOSEQ_PIPELINE,
    fillDeveloperSettings,
    fillTargetProbeParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("@full oligoseq run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, OLIGOSEQ_PIPELINE);

    await fillTargetProbeParameters(page, {
        fileRegions: "AARS1",
        fastaTargetFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
        fastaReferenceFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
    });

    await fillDeveloperSettings(page, {
        maxGraphSize: "2500",
        nAttempts: "30000",
    });

    await submitAndVerifyRun(page);
});
