import { expect, type Page } from "@playwright/test";
import path from "node:path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BACKEND_URL =
    process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:5000";
const POLL_INTERVAL_MS = 2_000;
const RUN_TIMEOUT_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// FASTA fixtures — only the smallest bundled files (~4.8 MB + ~6.4 MB)
// ---------------------------------------------------------------------------

const GENOMIC_REGIONS_DIR = path.resolve(
    process.cwd(),
    "backend/data/genomic_regions"
);

const FASTA_FIXTURES = {
    utr: path.join(
        GENOMIC_REGIONS_DIR,
        "utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"
    ),
    cds: path.join(
        GENOMIC_REGIONS_DIR,
        "cds_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna"
    ),
} as const;

const SMALLEST_FASTA_PAIR = [FASTA_FIXTURES.cds, FASTA_FIXTURES.utr] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PipelineDefinition = {
    route: string;
    heading: RegExp;
    pipeline: string;
    expectedTabs: RegExp[];
    representativeFieldChecks?: Array<{ tab: RegExp; label: RegExp }>;
    needsReadoutProbe?: boolean;
    needsPrimer?: boolean;
};

type PipelineFastaFixtureSet = {
    target: string[];
    referenceTarget: string[];
    readout?: string[];
    primer?: string[];
};

type RunFile = { name: string; type: string; size: number };

// ---------------------------------------------------------------------------
// Pipeline fixture mappings & definitions
// ---------------------------------------------------------------------------

const PIPELINE_FASTA_FIXTURES: Record<string, PipelineFastaFixtureSet> = {
    scrinshot: {
        target: [FASTA_FIXTURES.utr],
        referenceTarget: [FASTA_FIXTURES.utr],
    },
    oligoseq: {
        target: [...SMALLEST_FASTA_PAIR],
        referenceTarget: [...SMALLEST_FASTA_PAIR],
    },
    merfish: {
        target: [...SMALLEST_FASTA_PAIR],
        referenceTarget: [...SMALLEST_FASTA_PAIR],
        readout: [...SMALLEST_FASTA_PAIR],
        primer: [...SMALLEST_FASTA_PAIR],
    },
    seqfish: {
        target: [...SMALLEST_FASTA_PAIR],
        referenceTarget: [...SMALLEST_FASTA_PAIR],
        readout: [...SMALLEST_FASTA_PAIR],
        primer: [...SMALLEST_FASTA_PAIR],
    },
};

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
    heading: /OligoSeq/i,
    pipeline: "oligoseq",
    expectedTabs: [/Target Probe Parameters/i, /Developer Settings/i],
    representativeFieldChecks: [
        { tab: /Target Probe Parameters/i, label: /File Regions/i },
    ],
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
    needsReadoutProbe: true,
    needsPrimer: true,
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
    needsReadoutProbe: true,
    needsPrimer: true,
};

export const ALL_PIPELINES: PipelineDefinition[] = [
    SCRINSHOT_PIPELINE,
    OLIGOSEQ_PIPELINE,
    MERFISH_PIPELINE,
    SEQFISH_PIPELINE,
];

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const clickTab = async (page: Page, name: RegExp) => {
    await page.getByRole("tab", { name }).click();
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

    await clickTab(page, /Target Probe Parameters/i);
    await expect(page.getByLabel(/File Regions/i)).toBeVisible();
    await expect(
        page.getByLabel(/Files Fasta Target Probe Database/i)
    ).toBeVisible();
    await expect(
        page.getByLabel(/Files Fasta Reference Database Target Probe/i)
    ).toBeVisible();

    for (const check of pipeline.representativeFieldChecks ?? []) {
        await clickTab(page, check.tab);
        await expect(page.getByLabel(check.label)).toBeVisible();
    }
};

// Reduce computation-heavy params to keep E2E runtime reasonable.
const applyPipelineE2EOverrides = async (
    page: Page,
    pipeline: PipelineDefinition
) => {
    await clickTab(page, /Developer Settings/i);
    await page.getByLabel(/Max Graph Size/i).fill("2500");
    await page.getByLabel(/^N Attempts$/i).fill("30000");

    if (pipeline.pipeline === "merfish") {
        await clickTab(page, /Target Probe Parameters/i);
        await page.getByLabel(/Set Size Min/i).fill("24");
        await page.getByLabel(/Set Size Opt/i).fill("24");
        return;
    }

    if (pipeline.pipeline === "seqfish") {
        await page
            .getByLabel(/Readout Probe Initial Num Sequences/i)
            .fill("10000");
        await page.getByLabel(/Primer Initial Num Sequences/i).fill("50000");
    }
};

export const uploadStandardPipelineInputs = async (
    page: Page,
    pipeline: PipelineDefinition
) => {
    const fixtures = PIPELINE_FASTA_FIXTURES[pipeline.pipeline];

    await page.getByLabel(/File Regions/i).fill("AARS1");
    await page
        .getByLabel(/Files Fasta Target Probe Database/i)
        .setInputFiles(fixtures.target);
    await page
        .getByLabel(/Files Fasta Reference Database Target Probe/i)
        .setInputFiles(fixtures.referenceTarget);

    if (pipeline.needsReadoutProbe) {
        await clickTab(page, /Readout Probe Parameters/i);
        await page
            .getByLabel(/Files Fasta Reference Database Readout Probe/i)
            .setInputFiles(fixtures.readout ?? fixtures.referenceTarget);
    }

    if (pipeline.needsPrimer) {
        await clickTab(page, /Primer Parameters/i);
        await page
            .getByLabel(/Files Fasta Reference Database Primer/i)
            .setInputFiles(fixtures.primer ?? fixtures.referenceTarget);
    }

    await applyPipelineE2EOverrides(page, pipeline);
};

export const submitPipelineAndOpenRun = async (page: Page) => {
    const submitButton = page.getByRole("button", { name: /submit/i });
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

    const modal = page
        .getByRole("dialog")
        .filter({ hasText: /Pipeline Enqueued/i });
    const modalAppeared = await modal
        .waitFor({ state: "visible", timeout: 1_000 })
        .then(() => true)
        .catch(() => false);
    if (!modalAppeared) {
        await submitButton.click();
    }
    await expect(modal).toBeVisible();

    await modal.getByRole("button", { name: "Show Run" }).click();
    await expect(page).toHaveURL(/\/runs\/[a-f0-9]{24}$/i);

    const runId = page.url().match(/\/runs\/([a-f0-9]{24})$/i)?.[1];
    expect(runId, "Expected run ID in run details URL").toBeTruthy();
    return runId as string;
};

// ---------------------------------------------------------------------------
// Backend API polling via page.request
//
// page.request is Playwright's built-in APIRequestContext that automatically
// shares cookies with the browser context. Requests run in Node.js — never
// inside the browser's JS heap — which prevents Chromium OOM crashes during
// long-running pipeline polls.
//
// https://playwright.dev/docs/api-testing#sending-api-requests-from-ui-tests
// ---------------------------------------------------------------------------

const backendGet = (page: Page, apiPath: string) =>
    page.request.get(`${BACKEND_URL}${apiPath}`);

const pollRunState = async (page: Page, runId: string, timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const res = await backendGet(page, `/api/runs/${runId}/state`);
        expect(
            res.ok(),
            `Run state: ${res.status()} ${res.statusText()}`
        ).toBeTruthy();

        const { state } = await res.json();
        if (state === "success") return;
        if (state === "failure") {
            throw new Error(`Pipeline run ${runId} finished with failure.`);
        }

        await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(`Timed out waiting for pipeline run ${runId} to succeed.`);
};

const pollRunFiles = async (
    page: Page,
    runId: string,
    timeoutMs: number
): Promise<RunFile[]> => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        const res = await backendGet(page, `/api/runs/${runId}/files`);
        expect(
            res.ok(),
            `Run files: ${res.status()} ${res.statusText()}`
        ).toBeTruthy();

        const files: RunFile[] = await res.json();
        const hasGenomic = files.some((f) => f.name === "genomic_regions.yaml");
        const hasConfig = files.some((f) =>
            /\.(?:ya?ml|txt|log)$/i.test(f.name)
        );

        if (hasGenomic && hasConfig) return files;

        await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
        `Timed out waiting for run ${runId} to expose genomic and config artifacts.`
    );
};

export const waitForSuccessfulRun = async (
    page: Page,
    runId: string,
    timeoutMs: number = RUN_TIMEOUT_MS
) => {
    const deadline = Date.now() + timeoutMs;
    await pollRunState(page, runId, deadline - Date.now());
    return pollRunFiles(page, runId, deadline - Date.now());
};

export const expectRunDetailToRenderResults = async (page: Page) => {
    // After long Node.js-side API polling the browser tab has been idle;
    // reload so the page reflects the final backend state.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(
        page.getByRole("heading", { name: "Run Files" })
    ).toBeVisible();
    await expect(page.getByText("Gene Analysis")).toBeVisible({
        timeout: 60_000,
    });
};
