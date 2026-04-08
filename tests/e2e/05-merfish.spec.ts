import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    MERFISH_PIPELINE,
    expectRunDetailToRenderResults,
    fillDeveloperSettings,
    fillPrimerParameters,
    fillReadoutProbeParameters,
    fillTargetProbeParameters,
    openPipeline,
    submitPipelineAndOpenRun,
    waitForSuccessfulRun,
} from "./helpers";

test("@full merfish run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, MERFISH_PIPELINE);

    await fillTargetProbeParameters(page, {
        fileRegions: "AARS1",
        fastaTargetFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
        fastaReferenceFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
    });

    await fillReadoutProbeParameters(page, {
        fastaReferenceFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
    });

    await fillPrimerParameters(page, {
        fastaReferenceFiles: [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr],
    });

    await fillDeveloperSettings(page, {
        maxGraphSize: "2500",
        nAttempts: "30000",
        setSizeMin: "24",
        setSizeOpt: "24",
    });

    const runId = await submitPipelineAndOpenRun(page);
    await waitForSuccessfulRun(page, runId);
    await expectRunDetailToRenderResults(page);
});
