import { test, expect } from '@playwright/test';
import path from 'path';

test.use({ browserName: 'chromium' });

test('E2E: Test genomic nbci through Scrinshot pipeline', async ({ page }) => {
  test.setTimeout(300_000); // ⏱️ Set test-wide timeout to 10 minutes
  const mockFnaPath = path.resolve(
    __dirname,
    'mock_data/utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna'
  );
  const jsonHeaders = { 'content-type': 'application/json' };

  await page.route('**/api/genomic/cascaded/**', async route => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        status: 'success',
        message: 'Mocked genomic response',
        output: [mockFnaPath],
        cached: []
      })
    });
  });

  await page.route('**/api/upload', async route => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ filePath: mockFnaPath })
    });
  });

  await page.route('**/api/scrinshot', async route => {
    await route.fulfill({
      status: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ status: 'success', message: 'Mocked scrinshot run', runId: 'mock-run-id' })
    });
  });

  // 1. Go to Scrinshot page
  await page.goto('http://localhost:3000/pipelines/scrinshot');

  // 2. Fill in the gene input
  const geneInput = page.locator('input[name="file_regions"]');
  await expect(geneInput).toBeVisible();
  await geneInput.fill('AARS1');

  // 4. Upload target probe database FASTA
  await page.locator('#generate-fasta-button').click();
  await page.selectOption('select#source', 'ensembl');
  // 5. Upload reference probe database FASTA
  const fastaRefInput = page.locator('input[name="files_fasta_reference_database_target_probe"]');
  await expect(fastaRefInput).toBeVisible();
  await fastaRefInput.setInputFiles(
    path.resolve(__dirname, 'mock_data/utr_annotation_source-NCBI_species-Homo_sapiens_annotation_release-110_genome_assemly-GRCh38.fna')
  );

  // 7. Click Submit button
  const submitButton = page.getByRole('button', { name: /submit/i });
  await expect(submitButton).toBeVisible();
  await submitButton.click();

  // 6. Wait for dialogs after submission and assert the FINAL success message
  const timeoutMs = 600_000; // up to 10 minutes for the whole pipeline
  let gotSuccess = false;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = Math.max(0, deadline - Date.now());
    const dialog = await page.waitForEvent('dialog', { timeout: remaining });
    const message = dialog.message();
    console.log('Alert:', message);
    await dialog.dismiss();

    // Ignore any intermediate alerts (e.g., RunID ...) and only pass when the final success appears
    if (/pipeline is successfully finished/i.test(message)) {
      gotSuccess = true;
      break;
    }
  }

  expect(gotSuccess, 'Expected a final "Pipeline is successfully finished" alert').toBeTruthy();
});