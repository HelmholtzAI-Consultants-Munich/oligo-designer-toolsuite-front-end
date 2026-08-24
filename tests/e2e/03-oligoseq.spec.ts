// @smoke @full: this is the one full pipeline run wired into @smoke.

import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    OLIGOSEQ_PIPELINE,
    clearBlastnSearchOverrides,
    fillConfig,
    fillRequiredParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("@smoke @full oligoseq run completes and exposes artifacts", async ({
    page,
}) => {
    await openPipeline(page, OLIGOSEQ_PIPELINE);

    await fillRequiredParameters(page, {
        targets: "GFB69_RS14600",
        fastaVcfFiles: [FASTA_FIXTURES.vcf],
    });

    await fillConfig(page, {
        nAttemptsGraph: "60",
        setSizeMin: "1",
    });

    for (const locator of await page.getByLabel(/Coverage/i).all()) {
        await locator.fill("20");
    }

    await clearBlastnSearchOverrides(page);

    await page
        .locator(
            "#root_target_probes_property_filters_homopolymeric_runs_filter_enabled"
        )
        .uncheck();

    await submitAndVerifyRun(page);
});
