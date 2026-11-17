import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { serveBrowserChecks } from './serve-browser-checks.mjs';
import { HOMEPAGE_PERFORMANCE_BUDGETS as budgets, summarizeHomepagePerformance } from './homepage-performance.mjs';

const output = resolve(process.env.PERFORMANCE_REPORT_DIR || 'test-results/performance');
await mkdir(output, { recursive: true });
let site;
try {
  // Lighthouse visits a loopback origin. Relay only the built homepage's
  // public model assets so the CDN's production CORS policy does not omit them.
  site = await serveBrowserChecks('dist', { measureModels: true });
  const report = join(output, 'homepage.report.json');
  await promisify(execFile)(process.execPath, [
    resolve('node_modules/lighthouse/cli/index.js'), site.origin,
    '--only-categories=performance', '--output=json', '--output=html',
    `--output-path=${join(output, 'homepage')}`, '--max-wait-for-load=25000', '--save-assets',
    '--chrome-flags=--headless --no-sandbox', '--quiet',
  // This covers browser startup, analysis and artifact writes as well as the
  // separately capped 25-second navigation. A successful CI report took 61s.
  ], { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, timeout: 120000 });
  const [lighthouse, trace, devtoolsLog] = await Promise.all([
    report, join(output, 'homepage-0.trace.json'), join(output, 'homepage-0.devtoolslog.json'),
  ].map(async file => JSON.parse(await readFile(file, 'utf8'))));
  if (lighthouse.runtimeError) throw new Error(lighthouse.runtimeError.message);
  const result = summarizeHomepagePerformance({ lighthouse, trace, devtoolsLog });
  await writeFile(join(output, 'budget.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('Homepage performance (report only)', result);
} catch (error) {
  const message = error.killed ? 'Lighthouse timed out' : error.message;
  await writeFile(join(output, 'budget.json'), JSON.stringify({ status: 'measurement-error', budgets, error: message }, null, 2) + '\n');
  console.warn('Homepage performance could not be measured:', message);
} finally {
  await site?.close();
}
