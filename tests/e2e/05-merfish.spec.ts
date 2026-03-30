import { expect, test } from "@playwright/test";
import {
    MERFISH_PIPELINE,
    expectRunDetailToRenderResults,
    openPipeline,
    submitPipelineAndOpenRun,
    uploadStandardPipelineInputs,
    waitForSuccessfulRun,
} from "./helpers";

test("@full merfish run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, MERFISH_PIPELINE);
    await uploadStandardPipelineInputs(page, MERFISH_PIPELINE);

    const runId = await submitPipelineAndOpenRun(page);
    const files = await waitForSuccessfulRun(page, runId);

    expect(files.some((file) => file.name === "genomic_regions.yaml")).toBe(
        true
    );
    await expectRunDetailToRenderResults(page);
});
