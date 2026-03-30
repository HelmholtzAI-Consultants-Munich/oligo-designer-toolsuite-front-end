import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    SCRINSHOT_PIPELINE,
    clickTab,
    expectRunDetailToRenderResults,
    openPipeline,
    submitPipelineAndOpenRun,
    waitForSuccessfulRun,
} from "./helpers";

test("@smoke @full scrinshot run completes and exposes artifacts", async ({
    page,
}) => {
    await openPipeline(page, SCRINSHOT_PIPELINE);

    // Fill target inputs
    await page.getByLabel(/File Regions/i).fill("AARS1");
    await page
        .getByLabel(/Files Fasta Target Probe Database/i)
        .setInputFiles([FASTA_FIXTURES.utr]);
    await page
        .getByLabel(/Files Fasta Reference Database Target Probe/i)
        .setInputFiles([FASTA_FIXTURES.utr]);

    // E2E overrides
    await clickTab(page, /Developer Settings/i);
    await page.getByLabel(/Max Graph Size/i).fill("2500");
    await page.getByLabel(/^N Attempts$/i).fill("30000");

    const runId = await submitPipelineAndOpenRun(page);
    await waitForSuccessfulRun(page, runId);
    await expectRunDetailToRenderResults(page);
});
