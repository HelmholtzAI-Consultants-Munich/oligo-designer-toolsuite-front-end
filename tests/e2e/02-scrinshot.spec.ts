import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    SCRINSHOT_PIPELINE,
    expectRunDetailToRenderResults,
    fillDeveloperSettings,
    fillTargetProbeParameters,
    openPipeline,
    submitPipelineAndOpenRun,
    waitForSuccessfulRun,
} from "./helpers";

test("@smoke @full scrinshot run completes and exposes artifacts", async ({
    page,
}) => {
    await openPipeline(page, SCRINSHOT_PIPELINE);

    await fillTargetProbeParameters(page, {
        fileRegions: "AARS1",
        fastaTargetFiles: [FASTA_FIXTURES.utr],
        fastaReferenceFiles: [FASTA_FIXTURES.utr],
    });

    await fillDeveloperSettings(page, {
        maxGraphSize: "2500",
        nAttempts: "30000",
    });

    const runId = await submitPipelineAndOpenRun(page);
    await waitForSuccessfulRun(page, runId);
    await expectRunDetailToRenderResults(page);
});
