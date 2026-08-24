// Runs a full pipeline, so it carries no @smoke/@full tag and CI skips it; run it
// manually with an untagged `playwright test`.

import { test } from "@playwright/test";
import {
    MERFISH_PIPELINE,
    fillConfig,
    fillRequiredParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("merfish run completes and exposes artifacts", async ({ page }) => {
    await openPipeline(page, MERFISH_PIPELINE);

    await fillRequiredParameters(page, {
        targets: "AARS1",
    });

    await fillConfig(page, {
        nAttemptsGraph: "60",
        setSizeMin: "24",
        setSizeOpt: "24",
    });

    await submitAndVerifyRun(page);
});
