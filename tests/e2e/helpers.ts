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

export const SCRINSHOT_PIPELINE: PipelineDefinition = {
    route: "/pipelines/scrinshot",
    heading: /Scrinshot/i,
    pipeline: "scrinshot",
    expectedTabs: [
        /Target Probe Parameters/i,
        /Detection Oligo Parameters/i,
        /Developer Settings/i,
    ],
    representativeFieldChecks: [
        { tab: /Target Probe Parameters/i, label: /File Regions/i },
    ],
};

export const OLIGOSEQ_PIPELINE: PipelineDefinition = {
    route: "/pipelines/oligoSeq",
    heading: /OligoSeq Probe Designer/i,
    pipeline: "oligoseq",
    expectedTabs: [/Target Probe/i],
    representativeFieldChecks: [{ tab: /Target Probe/i, label: /Region Ids/i }],
};

export const MERFISH_PIPELINE: PipelineDefinition = {
    route: "/pipelines/merfish",
    heading: /MERFISH/i,
    pipeline: "merfish",
    expectedTabs: [
        /Target Probe Parameters/i,
        /Readout Probe Parameters/i,
        /Primer Parameters/i,
        /Developer Settings/i,
    ],
    representativeFieldChecks: [
        { tab: /Target Probe Parameters/i, label: /File Regions/i },
    ],
};

export const SEQFISH_PIPELINE: PipelineDefinition = {
    route: "/pipelines/seqfish",
    heading: /seqFISH/i,
    pipeline: "seqfish",
    expectedTabs: [
        /Target Probe Parameters/i,
        /Readout Probe Parameters/i,
        /Primer Parameters/i,
        /Developer Settings/i,
    ],
    representativeFieldChecks: [
        { tab: /Target Probe Parameters/i, label: /File Regions/i },
    ],
};

// pipelines disabled for now, since only oligoseq has pydantic
// integration yet
// TODO: reintegrate these pipelines
export const ALL_PIPELINES: PipelineDefinition[] = [
    // SCRINSHOT_PIPELINE,
    OLIGOSEQ_PIPELINE,
    // MERFISH_PIPELINE,
    // SEQFISH_PIPELINE,
];

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

export const clickTab = async (page: Page, name: RegExp) => {
    await page.getByRole("tab").and(page.getByTitle(name)).click();
};

export const openPipeline = async (
    page: Page,
    pipeline: PipelineDefinition
) => {
    await page.goto(pipeline.route);
    await expect(
        page.getByRole("heading", { name: pipeline.heading })
    ).toBeVisible();
};

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

export const submitPipelineAndOpenRun = async (page: Page) => {
    const submitButton = page
        .getByRole("button", { name: /Run Pipeline/i })
        .first();
    await submitButton.click();

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

    const toast = page
        .getByRole("alert")
        .filter({ hasText: /Pipeline Enqueued/i });
    const toastAppeared = await toast
        .waitFor({ state: "visible", timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
    if (!toastAppeared) {
        await submitButton.click();
    }
    await expect(toast).toBeVisible();

    await toast.getByRole("link", { name: "View the run here" }).click();
    await expect(page).toHaveURL(/\/runs\/[a-f0-9]{24}$/i);

    const runId = page.url().match(/\/runs\/([a-f0-9]{24})$/i)?.[1];
    expect(runId, "Expected run ID in run details URL").toBeTruthy();
    return runId as string;
};

const backendGet = (page: Page, apiPath: string) =>
    page.request.get(`${BACKEND_URL}${apiPath}`);

const backendGetOk = async (page: Page, apiPath: string) => {
    const res = await backendGet(page, apiPath);
    expect(
        res.ok(),
        `${apiPath}: ${res.status()} ${res.statusText()}`
    ).toBeTruthy();
    return res;
};

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

export const fillTargetProbeParameters = async (
    page: Page,
    options: {
        fileRegions: string;
        fastaTargetFiles: string[];
        fastaReferenceFiles: string[];
        fastaVcfFiles?: string[];
    }
) => {
    await page
        .getByRole("textbox", { name: /Region Ids/i })
        .fill(options.fileRegions);

    const genomicInput = {
        taxon: "Archaea",
        annotationRelease: "GCF_009428885.1_ASM942888v1",
        genomicRegions: {
            Gene: true,
            Exon: false,
            "Exon-exon-junction": false,
        },
    };

    await setGenomicInput(page, "files_fasta_probe_database", genomicInput);

    await setGenomicInput(page, "files_fasta_reference_database", genomicInput);

    if (options.fastaVcfFiles) {
        await page
            .locator("input[name=files_vcf_reference_database]")
            .setInputFiles(options.fastaVcfFiles);
    }
};

export const fillReadoutProbeParameters = async (
    page: Page,
    options: {
        fastaReferenceFiles: string[];
    }
) => {
    await clickTab(page, /Readout Probe Parameters/i);
    await page
        .getByRole("button", {
            name: /Files Fasta Reference Database Readout Probe/i,
        })
        .setInputFiles(options.fastaReferenceFiles);
};

export const fillPrimerParameters = async (
    page: Page,
    options: {
        fastaReferenceFiles: string[];
    }
) => {
    await clickTab(page, /Primer Parameters/i);
    await page
        .getByRole("button", { name: /Files Fasta Reference Database Primer/i })
        .setInputFiles(options.fastaReferenceFiles);
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
        await clickTab(page, /Target Probe/i);
        if (options.setSizeMin) {
            await page.getByLabel(/Set Size Min/i).fill(options.setSizeMin);
        }
        if (options.setSizeOpt) {
            await page.getByLabel(/Set Size Opt/i).fill(options.setSizeOpt);
        }
    }
};
