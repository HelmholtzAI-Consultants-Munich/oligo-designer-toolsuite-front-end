import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    MERFISH_PIPELINE,
    clickTab,
    expectRunDetailToRenderResults,
    openPipeline,
    submitPipelineAndOpenRun,
    waitForSuccessfulRun,
} from "./helpers";

test("@full merfish run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, MERFISH_PIPELINE);

    // Fill target inputs
    await page.getByLabel(/File Regions/i).fill("AARS1");
    await page
        .getByLabel(/Files Fasta Target Probe Database/i)
        .setInputFiles([FASTA_FIXTURES.cds, FASTA_FIXTURES.utr]);
    await page
        .getByLabel(/Files Fasta Reference Database Target Probe/i)
        .setInputFiles([FASTA_FIXTURES.cds, FASTA_FIXTURES.utr]);

    // Fill readout probe inputs
    await clickTab(page, /Readout Probe Parameters/i);
    await page
        .getByLabel(/Files Fasta Reference Database Readout Probe/i)
        .setInputFiles([FASTA_FIXTURES.cds, FASTA_FIXTURES.utr]);

    // Fill primer inputs
    await clickTab(page, /Primer Parameters/i);
    await page
        .getByLabel(/Files Fasta Reference Database Primer/i)
        .setInputFiles([FASTA_FIXTURES.cds, FASTA_FIXTURES.utr]);

    // E2E overrides
    await clickTab(page, /Developer Settings/i);
    await page.getByLabel(/Max Graph Size/i).fill("2500");
    await page.getByLabel(/^N Attempts$/i).fill("30000");
    await clickTab(page, /Target Probe Parameters/i);
    await page.getByLabel(/Set Size Min/i).fill("24");
    await page.getByLabel(/Set Size Opt/i).fill("24");

    const runId = await submitPipelineAndOpenRun(page);
    await waitForSuccessfulRun(page, runId);
    await expectRunDetailToRenderResults(page);
});
