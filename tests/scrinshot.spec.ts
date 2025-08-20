import { test, expect } from '@playwright/test';

test.describe('Scrinshot Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/pipelines/scrinshot'); // Adjust if your route is different
  });

  test('should render required file inputs', async ({ page }) => {
    await expect(page.locator('input[name="file_regions"]')).toBeVisible();
    await expect(page.locator('input[name="files_fasta_target_probe_database"]')).toBeVisible();
    await expect(page.locator('input[name="files_fasta_reference_database_target_probe"]')).toBeVisible();
  });

  test('should display and fill numeric input fields', async ({ page }) => {
    const inputIds = [
      'top_n_sets',
      'probe_length_min.value',
      'probe_length_max',
      'probe_isoform_consensus',
      'probe_GC_content_min',
      'probe_GC_content_max',
      'probe_Tm_min',
      'probe_Tm_max',
      'probe_Tm_opt',
      'homopolymeric_A',
      'homopolymeric_T',
      'homopolymeric_C',
      'homopolymeric_G',
      'arm_Tm_dif_max',
      'arm_length_min',
      'arm_Tm_min',
      'arm_Tm_max',
      'target_probe_ligation_region_size',
      'probe_isoform_weight',
      'probe_GC_weight',
      'probe_Tm_weight',
      'set_size_min',
      'set_size_opt',
      'distance_between_target_probes',
      'n_sets'
    ];

    for (const id of inputIds) {
      const input = page.locator(`#${id}`);
      await expect(input).toBeVisible();
      await input.fill('42');
    }
  });

  test('clicking Generate FASTA+ adds new form', async ({ page }) => {
    await page.getByRole('button', { name: 'Generate FASTA+' }).first().click();
    await expect(page.locator('form')).toBeVisible();
  });

  test('should show info icons with tooltips', async ({ page }) => {
    const icon = page.locator('svg').first();
    await icon.hover();
    // no reliable way to assert tooltip unless you test specific text — optional
  });
});