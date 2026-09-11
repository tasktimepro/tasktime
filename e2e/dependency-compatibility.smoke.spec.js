import { expect, test } from '@playwright/test';

test('patched PDF dependencies preserve the real blob pipeline and sanitize active HTML', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const { generatePDFBlob } = await import('/src/utils/pdfUtils.ts');
        window.__pdfDependencyCanary = 0;
        const blob = await generatePDFBlob(`
            <section style="color: black; background: white">
                <h1>Invoice compatibility check</h1>
                <p>Consulting — €120.00</p>
                <img src="data:image/png;base64,invalid" onerror="window.__pdfDependencyCanary = 1">
                <script>window.__pdfDependencyCanary = 2</script>
            </section>
        `);
        const bytes = await blob.text();
        return {
            type: blob.type,
            size: blob.size,
            header: bytes.slice(0, 5),
            hasPage: /\/Type\s*\/Page\b/.test(bytes),
            complete: bytes.trimEnd().endsWith('%%EOF'),
            canary: window.__pdfDependencyCanary,
        };
    });
    expect(result.type).toBe('application/pdf');
    expect(result.size).toBeGreaterThan(1000);
    expect(result.header).toBe('%PDF-');
    expect(result.hasPage).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.canary).toBe(0);
});
