import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { serveBrowserChecks } from './serve-browser-checks.mjs';

const output = resolve(process.env.PERFORMANCE_REPORT_DIR || 'test-results/performance');
const budgets = { lcpMs: 2500, transferredBytes: 1_500_000 };
await mkdir(output, { recursive: true });
let site;
try {
  site = await serveBrowserChecks();
  const report = join(output, 'homepage.report.json');
  await promisify(execFile)(process.execPath, [
    resolve('node_modules/lighthouse/cli/index.js'), site.origin,
    '--only-categories=performance', '--output=json', '--output=html',
    `--output-path=${join(output, 'homepage')}`, '--max-wait-for-load=25000',
    '--chrome-flags=--headless --no-sandbox', '--quiet',
  ], { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, timeout: 65000 });
  const { audits, runtimeError } = JSON.parse(await readFile(report, 'utf8'));
  const measured = {
    lcpMs: Math.round(audits['largest-contentful-paint'].numericValue),
    transferredBytes: Math.round(audits['total-byte-weight'].numericValue),
  };
  if (Object.values(measured).some(value => !Number.isFinite(value))) {
    throw new Error(runtimeError?.message || 'Lighthouse did not report both measurements');
  }
  const underBudget = Object.fromEntries(Object.keys(budgets).map(key => [key, measured[key] <= budgets[key]]));
  await writeFile(join(output, 'budget.json'), JSON.stringify({ measured, budgets, underBudget }, null, 2) + '\n');
  console.log('Homepage performance (report only)', { measured, budgets, underBudget });
} catch (error) {
  const message = error.killed ? 'Lighthouse timed out' : error.message;
  await writeFile(join(output, 'budget.json'), JSON.stringify({ budgets, error: message }, null, 2) + '\n');
  console.warn('Homepage performance could not be measured:', message);
} finally {
  await site?.close();
}
