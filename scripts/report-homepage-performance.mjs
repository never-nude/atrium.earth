import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import { serveBrowserChecks } from './serve-browser-checks.mjs';

const output = process.env.PERFORMANCE_REPORT_DIR || 'test-results/performance';
const budgets = { lcpMs: 2500, transferredBytes: 1_500_000 };
await mkdir(output, { recursive: true });
let site;
let browser;
try {
  site = await serveBrowserChecks();
  browser = await chromium.launch({
    executablePath: chromium.executablePath(),
    args: ['--remote-debugging-port=9222'],
  });
  const result = await Promise.race([lighthouse(site.origin, {
    port: 9222, maxWaitForLoad: 25000, logLevel: 'error', output: 'html', onlyCategories: ['performance'],
  }), new Promise((_, reject) => setTimeout(() => reject(new Error('Lighthouse timed out')), 55000).unref())]);
  const audits = result.lhr.audits;
  const measured = {
    lcpMs: Math.round(audits['largest-contentful-paint'].numericValue),
    transferredBytes: Math.round(audits['total-byte-weight'].numericValue),
  };
  if (Object.values(measured).some(value => !Number.isFinite(value))) {
    throw new Error(result.lhr.runtimeError?.message || 'Lighthouse did not report both measurements');
  }
  const underBudget = Object.fromEntries(Object.keys(budgets).map(key => [key, measured[key] <= budgets[key]]));
  await writeFile(join(output, 'homepage.html'), result.report);
  await writeFile(join(output, 'budget.json'), JSON.stringify({ measured, budgets, underBudget }, null, 2) + '\n');
  console.log('Homepage performance (report only)', { measured, budgets, underBudget });
} catch (error) {
  await writeFile(join(output, 'budget.json'), JSON.stringify({ budgets, error: error.message }, null, 2) + '\n');
  console.warn('Homepage performance could not be measured:', error.message);
} finally {
  await browser?.close();
  await site?.close();
}
