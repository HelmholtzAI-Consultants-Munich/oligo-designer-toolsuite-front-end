// Shared Playwright helpers: pipeline definitions, form-filling, and
// run-submission utilities used by all e2e specs.

import { expect, type Page } from "@playwright/test";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKEND_URL =
    process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:8000";
const POLL_INTERVAL_MS = 2_000;
const RUN_TIMEOUT_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Generic polling utility
// ---------------------------------------------------------------------------

/**
 * Polls a condition function until it succeeds or times out.
 *
 * @param options.condition - Async function that returns true when done, false to keep polling
 * @param options.timeoutMs - Maximum time to wait in milliseconds
 * @param options.intervalMs - Polling interval in milliseconds
 * @param options.timeoutMessage - Error message if timeout occurs
 */
export const pollUntil = async <T = void>(options: {
    condition: () => Promise<T | false | null | undefined>;
    timeoutMs: number;
    intervalMs: number;
    timeoutMessage: string;
}): Promise<T> => {
    const deadline = Date.now() + options.timeoutMs;

    while (Date.now() < deadline) {
        const result = await options.condition();
        if (result !== false && result !== null && result !== undefined) {
            return result as T;
        }
        await new Promise((r) => setTimeout(r, options.intervalMs));
    }

    throw new Error(options.timeoutMessage);
};

// ---------------------------------------------------------------------------
// FASTA fixtures — only the smallest bundled files (~4.8 MB + ~6.4 MB)
// ---------------------------------------------------------------------------

const TEST_DATA_DIR = path.resolve(process.cwd(), "backend/data");

const GENOMIC_REGIONS_DIR = path.join(TEST_DATA_DIR, "genomic_regions");

export const FASTA_FIXTURES = {
    utr: path.join(
        GENOMIC_REGIONS_DIR,
        "utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"
    ),
    cds: path.join(
        GENOMIC_REGIONS_DIR,
        "cds_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"
    ),
    exon: path.join(
        GENOMIC_REGIONS_DIR,
        "exon_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"
    ),
    exon_exon_junction: path.join(
        GENOMIC_REGIONS_DIR,
        "exon_exon_junction_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"
    ),
    vcf: path.join(
        TEST_DATA_DIR,
        "annotations/custom_GCF_000001405.40.chr16.vcf"
    ),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineDefinition = {
    route: string;
    heading: RegExp;
    pipeline: string;
    expectedTabs: RegExp[];
    representativeFieldChecks?: Array<{ tab: RegExp; label: RegExp }>;
};

// ---------------------------------------------------------------------------
// Pipeline definitions (used by the smoke test)
// ---------------------------------------------------------------------------

// Tab labels are the schema's top-level sections, title-cased. `general` is not among them:
// the backend keeps it out of the front-end schemas.

export const SCRINSHOT_PIPELINE: PipelineDefinition = {
    route: "/pipelines/scrinshot",
    heading: /Scrinshot/i,
    pipeline: "scrinshot",
    expectedTabs: [/Target Probes/i, /Detection Oligo/i],
    representativeFieldChecks: [{ tab: /Target Probes/i, label: /Targets/i }],
};

export const OLIGOSEQ_PIPELINE: PipelineDefinition = {
    route: "/pipelines/oligoSeq",
    heading: /OligoSeq Probe Designer/i,
    pipeline: "oligoseq",
    expectedTabs: [/Target Probes/i],
    representativeFieldChecks: [{ tab: /Target Probes/i, label: /Targets/i }],
};

export const MERFISH_PIPELINE: PipelineDefinition = {
    route: "/pipelines/merfish",
    heading: /MERFISH/i,
    pipeline: "merfish",
    expectedTabs: [/Target Probes/i, /Readout Probes/i, /Primers/i],
    representativeFieldChecks: [
        { tab: /Target Probes/i, label: /Targets/i },
        // a readout-probe quick setting, so it must not leak into the first tab
        { tab: /Readout Probes/i, label: /N Bits/i },
    ],
};

export const SEQFISH_PIPELINE: PipelineDefinition = {
    route: "/pipelines/seqfish",
    heading: /seqFISH/i,
    pipeline: "seqfish",
    expectedTabs: [/Target Probes/i, /Readout Probes/i, /Primers/i],
    representativeFieldChecks: [
        { tab: /Target Probes/i, label: /Targets/i },
        { tab: /Readout Probes/i, label: /N Barcode Rounds/i },
    ],
};

export const HCR_PIPELINE: PipelineDefinition = {
    route: "/pipelines/hcr",
    heading: /HCR Probe Designer/i,
    pipeline: "hcr",
    expectedTabs: [
        /Target Probes/i,
        /Initiator Probes/i,
        /Hybridization Probes/i,
    ],
    representativeFieldChecks: [{ tab: /Target Probes/i, label: /Targets/i }],
};

export const CYCLEHCR_PIPELINE: PipelineDefinition = {
    route: "/pipelines/cyclehcr",
    heading: /Cycle HCR Probe Designer/i,
    pipeline: "cyclehcr",
    expectedTabs: [
        /Target Probes/i,
        /Readout Probes/i,
        /Primers/i,
        /Hybridization Probes/i,
    ],
    representativeFieldChecks: [{ tab: /Target Probes/i, label: /Targets/i }],
};

/**
 * Pipelines checked by the `@smoke` test's page-render sweep.
 *
 * @remarks
 * All of them, now that every pipeline has an ODT pydantic model. The sweep only renders the
 * pages and spot-checks a field per tab, so it stays cheap.
 */
export const ALL_PIPELINES: PipelineDefinition[] = [
    SCRINSHOT_PIPELINE,
    OLIGOSEQ_PIPELINE,
    MERFISH_PIPELINE,
    SEQFISH_PIPELINE,
    HCR_PIPELINE,
    CYCLEHCR_PIPELINE,
];

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/** Bound on the expand loop, in case a toggle ever fails to flip when clicked. */
const MAX_COLLAPSED_SECTIONS = 100;

/**
 * Opens every section of the visible tab, which starts with only the first one expanded, and
 * then the `x-collapsed` groups nested inside them, which carry their own toggle. Anything
 * still collapsed is `display: none`, so its fields fail Playwright's actionability checks.
 *
 * @remarks
 * "Expand all" rather than clicking each header: a header click closes the other sections,
 * so expanding them one by one would re-collapse whatever an earlier step opened.
 */
export const expandSections = async (page: Page) => {
    // scoped to the tab on screen: a toggle in another pane is `display: none` forever, so
    // clicking it just burns the timeout. Inside this pane the hidden block still needs the
    // visibility check below.
    const activeTab = page.locator(".tab-pane.active");

    for (const button of await activeTab
        .getByRole("button", { name: "Expand all" })
        .all()) {
        if (await button.isVisible()) {
            await button.click();
        }
    }
    // recounted each pass: opening a section reveals the collapsed groups nested inside it
    const collapsed = activeTab.locator(
        '[aria-controls^="collapsible-section"][aria-expanded="false"]:visible'
    );
    for (
        let guard = 0;
        guard < MAX_COLLAPSED_SECTIONS && (await collapsed.count()) > 0;
        guard++
    ) {
        await collapsed.first().click();
    }
};

/**
 * Empties the blastn search fields the schema pre-fills on both specificity filters, leaving
 * blastn to use its own defaults.
 *
 * @remarks
 * The pre-filled `-strand minus`, `-word_size 10` and `-perc_identity 80` search the reference
 * far more sensitively than blastn would by default. Every remaining oligo then matches
 * something and is dropped as non-specific, and the run ends on an empty database.
 */
export const clearBlastnSearchOverrides = async (page: Page) => {
    for (const strand of await page
        .getByLabel("-Strand", { exact: true })
        .all()) {
        await strand.selectOption("");
    }
    for (const label of ["-Word Size", "-Perc Identity"]) {
        for (const input of await page
            .getByLabel(label, { exact: true })
            .all()) {
            await input.fill("");
        }
    }
};

export const clickTab = async (page: Page, name: RegExp) => {
    await page.getByRole("tab").and(page.getByTitle(name)).click();
    // each tab owns its sections, so the one just revealed may still be collapsed
    await expandSections(page);
};

export const openPipeline = async (
    page: Page,
    pipeline: PipelineDefinition
) => {
    await page.goto(pipeline.route);
    await expect(
        page.getByRole("heading", { name: pipeline.heading })
    ).toBeVisible();
    await expandSections(page);
};

/**
 * Asserts a pipeline's expected tabs are present, then spot-checks one
 * representative field per tab to catch form-schema regressions.
 */
export const expectPipelineFields = async (
    page: Page,
    pipeline: PipelineDefinition
) => {
    for (const tab of pipeline.expectedTabs) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }

    for (const check of pipeline.representativeFieldChecks ?? []) {
        await clickTab(page, check.tab);
        await expect(page.getByLabel(check.label)).toBeVisible();
    }
};

// ---------------------------------------------------------------------------
// Submission & consent
// ---------------------------------------------------------------------------

/**
 * Submits the currently-open pipeline form and navigates to its run page.
 *
 * Handles the one-time Terms of Service consent checkbox if present, and
 * retries the submit click once if the "Pipeline Enqueued" toast doesn't
 * appear in time (the first click can be swallowed by the consent dialog
 * mounting).
 *
 * @returns the created run's ID, extracted from the resulting URL
 */
export const submitPipelineAndOpenRun = async (page: Page) => {
    const submitButton = page
        .getByRole("button", { name: /Run Pipeline/i })
        .first();
    await submitButton.click();

    const confirmationModal = page.getByRole("dialog");
    await expect(confirmationModal).toBeVisible();

    const runNameInput = confirmationModal.getByRole("textbox");
    await runNameInput.fill("playwright-test-run");
    await expect(runNameInput).toHaveValue("playwright-test-run");

    const termsCheckbox = page.getByRole("checkbox", {
        name: /I accept the Terms of Service and acknowledge the Privacy Policy/i,
    });

    const needsConsent = await termsCheckbox
        .waitFor({ state: "visible", timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
    if (needsConsent) {
        await termsCheckbox.check();
        await expect(termsCheckbox).toBeChecked();
    }

    await expect(
        page.locator('input[name="cf-turnstile-response"]')
    ).not.toHaveValue("");

    const confirmationButton = confirmationModal.getByRole("button", {
        name: /Run Pipeline/i,
    });
    await confirmationButton.click();

    await expect(page).toHaveURL(/\/runs\/[a-f0-9]{24}$/i);

    const runId = page.url().match(/\/runs\/([a-f0-9]{24})$/i)?.[1];
    expect(runId, "Expected run ID in run details URL").toBeTruthy();
    return runId as string;
};

const backendGet = (page: Page, apiPath: string) =>
    page.request.get(`${BACKEND_URL}${apiPath}`);

/**
 * Asserts here (not just in each caller) so a non-2xx response fails with
 * the status/path instead of an opaque JSON-parse error further down.
 */
const backendGetOk = async (page: Page, apiPath: string) => {
    const res = await backendGet(page, apiPath);
    expect(
        res.ok(),
        `${apiPath}: ${res.status()} ${res.statusText()}`
    ).toBeTruthy();
    return res;
};

/**
 * Fails fast on "failure" instead of letting the poll run out the clock,
 * since a failed run will never reach "success".
 */
const pollRunState = async (page: Page, runId: string, timeoutMs: number) => {
    return pollUntil({
        condition: async () => {
            const res = await backendGetOk(page, `/api/runs/${runId}/status`);
            const { state } = await res.json();
            if (state === "success") return true;
            if (state === "failure") {
                throw new Error(`Pipeline run ${runId} finished with failure.`);
            }
            return false;
        },
        timeoutMs,
        intervalMs: POLL_INTERVAL_MS,
        timeoutMessage: `Timed out waiting for pipeline run ${runId} to succeed.`,
    });
};

/**
 * Run status flips to "success" before its output artifacts are
 * necessarily written to disk, so this is polled separately.
 */
const pollGenomicRegionsFile = async (
    page: Page,
    runId: string,
    timeoutMs: number
): Promise<boolean> => {
    return pollUntil({
        condition: async () => {
            const res = await backendGetOk(
                page,
                `/api/runs/${runId}/files/genomic_regions.yaml`
            );
            return res.ok();
        },
        timeoutMs,
        intervalMs: POLL_INTERVAL_MS,
        timeoutMessage: `Timed out waiting for run ${runId} to expose genomic and config artifacts.`,
    });
};

/** Also waits for the genomic regions artifact to be downloadable — a `success` state alone doesn't guarantee it's ready. */
export const waitForSuccessfulRun = async (
    page: Page,
    runId: string,
    timeoutMs: number = RUN_TIMEOUT_MS
) => {
    const deadline = Date.now() + timeoutMs;
    await pollRunState(page, runId, timeoutMs);
    return pollGenomicRegionsFile(page, runId, deadline - Date.now());
};

export const submitAndVerifyRun = async (page: Page) => {
    const runId = await submitPipelineAndOpenRun(page);
    await waitForSuccessfulRun(page, runId);
    await expectRunDetailToRenderResults(page);
};

export const expectRunDetailToRenderResults = async (page: Page) => {
    // After long Node.js-side API polling the browser tab has been idle;
    // reload so the page reflects the final backend state.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("Oligo Visualization")).toBeVisible({
        timeout: 30_000,
    });
};

// ---------------------------------------------------------------------------
// Form filling helpers
// ---------------------------------------------------------------------------

/** Opens the "Configure Genomic Regions" dialog for the given file field and fills it in. */
const setGenomicInput = async (
    page: Page,
    fieldName: string,
    genomicInput: {
        source?: string;
        taxon?: string;
        species?: string;
        annotationRelease?: string;
        genomicRegions?: { [key: string]: boolean };
    }
) => {
    const SELECT_NAME_MAP = {
        source: "Select Source",
        taxon: "Taxon",
        species: "Species",
        annotationRelease: "Annotation Release",
    };
    await page.locator(`button[name=${fieldName}]`).click();

    await expect(
        page.getByText("Configure Genomic Regions", { exact: true })
    ).toBeVisible();

    for (const [key, property] of Object.entries(genomicInput)) {
        if (key === "genomicRegions") {
            for (const [genomicKey, genomicRegionChecked] of Object.entries(
                property
            )) {
                await page
                    .getByRole("checkbox", { name: genomicKey, exact: true })
                    .setChecked(genomicRegionChecked);
            }
            continue;
        }
        if (key === "annotationRelease") {
            // Annotation release options load asynchronously once taxon/species
            // are selected; no loading indicator to wait on instead.
            await page.waitForTimeout(4000);
        }
        await page
            .getByRole("combobox", {
                name: SELECT_NAME_MAP[key as keyof typeof SELECT_NAME_MAP],
            })
            .selectOption(property);
    }
    await page
        .getByRole("button", {
            name: "Save",
        })
        .click();
};

/**
 * Fills the inputs a run cannot start without, plus the VCF upload where a pipeline has one.
 *
 * @remarks
 * Every pipeline shares these three, and `reference_genome` now covers the readout-probe and
 * primer specificity filters that used to take a fasta file each.
 */
export const fillRequiredParameters = async (
    page: Page,
    options: {
        targets: string;
        fastaVcfFiles?: string[];
    }
) => {
    await page.getByRole("textbox", { name: /Targets/i }).fill(options.targets);

    const genomicInput = {
        taxon: "Archaea",
        annotationRelease: "GCF_009428885.1_ASM942888v1",
        genomicRegions: {
            Gene: true,
            Exon: false,
            "Exon-exon-junction": false,
        },
    };

    await setGenomicInput(page, "target_genome", genomicInput);
    await setGenomicInput(page, "reference_genome", genomicInput);

    if (options.fastaVcfFiles) {
        await page
            .locator("input[name=files_vcf_reference_database]")
            .setInputFiles(options.fastaVcfFiles);
    }
};

export const fillConfig = async (
    page: Page,
    options: {
        nAttemptsGraph?: string;
        readoutProbeInitialNumSequences?: string;
        primerInitialNumSequences?: string;
        setSizeMin?: string;
        setSizeOpt?: string;
    }
) => {
    if (options.nAttemptsGraph) {
        await page
            .getByRole("spinbutton", { name: "N Attempts Graph", exact: true })
            .fill(options.nAttemptsGraph);
    }
    if (options.readoutProbeInitialNumSequences) {
        await page
            .getByLabel(/Readout Probe Initial Num Sequences/i)
            .fill(options.readoutProbeInitialNumSequences);
    }
    if (options.primerInitialNumSequences) {
        await page
            .getByLabel(/Primer Initial Num Sequences/i)
            .fill(options.primerInitialNumSequences);
    }
    if (options.setSizeMin || options.setSizeOpt) {
        // set size is a target-probe quick setting, so it is only on that tab's panel
        await clickTab(page, /Target Probes/i);
        if (options.setSizeMin) {
            await page.getByLabel(/Set Size Min/i).fill(options.setSizeMin);
        }
        if (options.setSizeOpt) {
            await page.getByLabel(/Set Size Opt/i).fill(options.setSizeOpt);
        }
    }
};
