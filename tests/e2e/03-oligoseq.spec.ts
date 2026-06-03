import { test } from "@playwright/test";
import {
    FASTA_FIXTURES,
    OLIGOSEQ_PIPELINE,
    fillDeveloperSettings,
    fillTargetProbeParameters,
    openPipeline,
    submitAndVerifyRun,
} from "./helpers";

test("@smoke @full oligoseq run completes and exposes artifacts", async ({
    page,
}) => {
    await openPipeline(page, OLIGOSEQ_PIPELINE);

    await fillTargetProbeParameters(page, {
        fileRegions: "GFB69_RS14600",
        fastaTargetFiles: [
            FASTA_FIXTURES.exon,
            FASTA_FIXTURES.exon_exon_junction,
        ],
        fastaReferenceFiles: [
            FASTA_FIXTURES.exon,
            FASTA_FIXTURES.exon_exon_junction,
        ],
        fastaVcfFiles: [FASTA_FIXTURES.vcf],
    });

    await fillDeveloperSettings(page, {
        nAttemptsGraph: "60",
        setSizeMin: "1",
    });

    for (const locator of await page.getByLabel(/Coverage/i).all()) {
        await locator.fill("20");
    }

    await page
        .locator(
            "#root_target_probe_property_filters_homopolymeric_runs_filter_enabled"
        )
        .uncheck();

    await submitAndVerifyRun(page);
});
