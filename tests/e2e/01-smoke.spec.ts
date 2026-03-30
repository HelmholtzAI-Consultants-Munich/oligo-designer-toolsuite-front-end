import { expect, test } from "@playwright/test";
import { ALL_PIPELINES, expectPipelineFields, openPipeline } from "./helpers";

test("@smoke core pipeline pages render required fields", async ({ page }) => {
    await page.goto("/pipelines");
    await expect(
        page.getByRole("link", { name: /Go to Pipeline/i }).first()
    ).toBeVisible();

    for (const pipeline of ALL_PIPELINES) {
        await openPipeline(page, pipeline);
        await expectPipelineFields(page, pipeline);
    }
});
