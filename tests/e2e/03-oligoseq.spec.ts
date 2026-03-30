import { expect, test } from "@playwright/test";
import {
    OLIGOSEQ_PIPELINE,
    expectRunDetailToRenderResults,
    openPipeline,
    submitPipelineAndOpenRun,
    uploadStandardPipelineInputs,
    waitForSuccessfulRun,
} from "./helpers";

test("@full oligoseq run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, OLIGOSEQ_PIPELINE);
    await uploadStandardPipelineInputs(page, OLIGOSEQ_PIPELINE);

    const runId = await submitPipelineAndOpenRun(page);
    const files = await waitForSuccessfulRun(page, runId);

    expect(files.some((file) => file.name === "genomic_regions.yaml")).toBe(
        true
    );
    await expectRunDetailToRenderResults(page);
});
