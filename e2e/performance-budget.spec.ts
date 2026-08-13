import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('sassuolo-history-onboarded', '1')); });

test('budget di rendering sulle viste desktop e mobile', async ({ page }, testInfo) => {
  test.skip(!['chromium-desktop', 'chromium-mobile'].includes(testInfo.project.name), 'Budget misurato sui due viewport di riferimento');
  for (const route of ['/matches?season=2025%2F26', '/players', '/seasons/2025%2F26', '/data-manager']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible();
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return {
        domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? 0,
        loadMs: navigation?.loadEventEnd || performance.now(),
        domNodes: document.getElementsByTagName('*').length,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    });
    expect(metrics.domContentLoadedMs, `${route}: DOMContentLoaded`).toBeLessThan(5_000);
    expect(metrics.loadMs, `${route}: load`).toBeLessThan(7_500);
    expect(metrics.domNodes, `${route}: nodi DOM`).toBeLessThan(5_000);
    if (testInfo.project.name === 'chromium-mobile') expect(metrics.horizontalOverflow, `${route}: overflow mobile`).toBe(false);
  }
});
