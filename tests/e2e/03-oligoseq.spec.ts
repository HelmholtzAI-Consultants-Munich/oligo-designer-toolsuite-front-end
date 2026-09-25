// @smoke @full: this is the one full pipeline run wired into @smoke.

import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    OLIGOSEQ_PIPELINE,
    fillTargetProbeParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("@smoke @full oligoseq run completes and exposes artifacts", async ({
    page,
}) => {
    await openPipeline(page, OLIGOSEQ_PIPELINE);

    await fillTargetProbeParameters(page, {
        fileRegions: "GFB69_RS00135",
        fastaTargetFiles: [
            FASTA_FIXTURES.exon,
            FASTA_FIXTURES.exon_exon_junction,
        ],
        fastaReferenceFiles: [
            FASTA_FIXTURES.exon,
            FASTA_FIXTURES.exon_exon_junction,
        ],
    });

    await page
        .locator(
            "#root_target_probe_specificity_filters_variant_filter_enabled"
        )
        .uncheck();

    await submitAndVerifyRun(page);
});
