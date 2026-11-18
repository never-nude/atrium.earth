import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { browserDeadline, runBoundedBrowserCase } from './lib/browser-check-runner.mjs';

class FakeClock {
  now = 0;
  sequence = 0;
  pending = new Map();
  cleared = [];
  timers = {
    setTimer: (callback, milliseconds) => {
      const id = ++this.sequence;
      this.pending.set(id, { callback, at: this.now + milliseconds });
      return id;
    },
    clearTimer: id => {
      this.cleared.push(id);
      this.pending.delete(id);
    },
  };

  async flush() {
    // Drain nested promise/phase/finally continuations without wall-clock sleeps.
    for (let index = 0; index < 40; index++) await Promise.resolve();
  }

  async advance(milliseconds) {
    const target = this.now + milliseconds;
    await this.flush();
    for (;;) {
      const next = [...this.pending.entries()]
        .filter(([, entry]) => entry.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      this.now = next[1].at;
      this.pending.delete(next[0]);
      next[1].callback();
      await this.flush();
    }
    this.now = target;
    await this.flush();
  }
}

const never = () => new Promise(() => {});
const silent = () => {};

test('a hung case checkpoints before cleanup, exhausts one cleanup budget and never retries', async context => {
  const directory = mkdtempSync(join(tmpdir(), 'atrium-browser-runner-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const reportPath = join(directory, 'first.json');
  const clock = new FakeClock();
  const result = { id: 'first', problems: [] };
  const history = [];
  let bodyCalls = 0, cleanupCalls = 0, forceCalls = 0, hardCalls = 0;
  let staleRunPhase, staleCleanupPhase, isRunning;
  const checkpoint = () => {
    const snapshot = structuredClone(result);
    history.push(snapshot);
    writeFileSync(reportPath, JSON.stringify(snapshot));
  };
  const completed = runBoundedBrowserCase({
    id: 'first', result, timers: clock.timers, log: silent, checkpoint,
    run(phase, running) {
      bodyCalls++;
      staleRunPhase = phase; isRunning = running;
      return phase('navigate', never);
    },
    cleanup(phase) {
      cleanupCalls++;
      const saved = JSON.parse(readFileSync(reportPath, 'utf8'));
      assert.equal(saved.status, 'failed');
      assert.equal(saved.phase, 'cleanup');
      assert.equal(saved.firstFailure.phase, 'navigate');
      assert.equal(saved.firstFailure.code, 'BROWSER_CHECK_TIMEOUT');
      staleCleanupPhase = phase;
      return phase('close context', never);
    },
    forceKill() { forceCalls++; return never(); },
    hardKill() { hardCalls++; },
  });

  await clock.advance(180_000);
  assert.equal(bodyCalls, 1);
  assert.equal(cleanupCalls, 1);
  assert.equal(isRunning(), false);
  assert.equal(forceCalls, 0);
  await clock.advance(8_000);
  assert.equal(forceCalls, 1);
  assert.equal(hardCalls, 0);
  await clock.advance(2_000);
  await completed;
  assert.equal(clock.now, 190_000, 'Cleanup and force-kill together receive ten seconds.');
  assert.equal(hardCalls, 1);
  assert.equal(result.status, 'failed');
  assert.equal(result.phase, 'complete');
  assert.equal(result.failures.length, 3);
  assert.equal(result.firstFailure, result.failures[0]);
  assert.deepEqual(result.failures.map(failure => failure.phase), ['navigate', 'close context', 'force kill']);
  assert(history.some(snapshot => snapshot.status === 'failed' && snapshot.phase === 'cleanup'));
  assert.equal(clock.pending.size, 0);

  const preserved = readFileSync(reportPath, 'utf8');
  let staleEffects = 0;
  assert.throws(() => staleRunPhase('late navigation', () => { staleEffects++; }), /already stopped/);
  assert.throws(() => staleCleanupPhase('late close', () => { staleEffects++; }), /already stopped/);
  await clock.flush();
  assert.equal(staleEffects, 0);
  assert.equal(readFileSync(reportPath, 'utf8'), preserved, 'A completed checkpoint cannot be rewritten by a stale phase.');

  const nextResult = { id: 'next', problems: [] };
  let nextCalls = 0, nextCleanupCalls = 0;
  const next = runBoundedBrowserCase({
    id: 'next', result: nextResult, timers: clock.timers, log: silent,
    checkpoint() { writeFileSync(join(directory, 'next.json'), JSON.stringify(structuredClone(nextResult))); },
    run(phase) { nextCalls++; return phase('inspect', () => { nextResult.inspected = true; }); },
    cleanup(phase) { nextCleanupCalls++; return phase('close context', silent); },
    forceKill() { assert.fail('The healthy next case must not be killed.'); },
    hardKill() { assert.fail('The healthy next case must not be hard-killed.'); },
  });
  await clock.flush();
  await next;
  assert.equal(nextResult.status, 'passed');
  assert.equal(nextCalls, 1);
  assert.equal(nextCleanupCalls, 1);
  assert.equal(bodyCalls, 1, 'The timed-out first case is not retried.');
  assert.equal(cleanupCalls, 1);
  assert.equal(readFileSync(reportPath, 'utf8'), preserved);
  assert.equal(clock.pending.size, 0);
});

test('successful assertions followed by failed cleanup remain a failed case', async () => {
  const clock = new FakeClock();
  const result = { problems: [] };
  const checkpoints = [];
  let forceCalls = 0;
  await runBoundedBrowserCase({
    id: 'cleanup-failure', result, timers: clock.timers, log: silent,
    checkpoint() { checkpoints.push(structuredClone(result)); },
    run: phase => phase('assertions', () => { result.assertionsPassed = true; }),
    cleanup: phase => phase('close context', () => { throw new Error('close failed'); }),
    forceKill() { forceCalls++; },
    hardKill() { assert.fail('A successful force kill needs no fallback.'); },
  });
  assert.equal(result.assertionsPassed, true);
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.firstFailure, { phase: 'close context', message: 'close failed' });
  assert.equal(forceCalls, 1);
  assert(checkpoints.some(snapshot => snapshot.status === 'checked' && snapshot.phase === 'cleanup'));
  assert.equal(checkpoints.at(-1).status, 'failed');
  assert.equal(clock.pending.size, 0);
});

test('the original failure survives graceful, forceful and hard-kill errors', async () => {
  const clock = new FakeClock();
  const result = { problems: [] };
  await runBoundedBrowserCase({
    id: 'all-failures', result, timers: clock.timers, log: silent, checkpoint: silent,
    run: phase => phase('axe', () => { throw new Error('original accessibility failure'); }),
    cleanup: phase => phase('close context', () => { throw new Error('cleanup failure'); }),
    forceKill() { throw new Error('force kill failure'); },
    hardKill() { throw new Error('hard kill failure'); },
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.firstFailure, result.failures[0]);
  assert.deepEqual(result.failures.map(failure => [failure.phase, failure.message]), [
    ['axe', 'original accessibility failure'],
    ['close context', 'cleanup failure'],
    ['force kill', 'force kill failure'],
    ['hard kill', 'hard kill failure'],
  ]);
  assert.equal(clock.pending.size, 0);
});

test('browserDeadline preserves an immediate rejection and clears its timer', async () => {
  const clock = new FakeClock();
  const original = new Error('navigation refused');
  await assert.rejects(browserDeadline(() => { throw original; }, 25, 'case / navigation', clock.timers),
    error => error === original);
  assert.equal(clock.pending.size, 0);
  assert.equal(clock.cleared.length, 1);
});

test('browserDeadline reports the timed-out phase and clears its timer without a second attempt', async () => {
  const clock = new FakeClock();
  let calls = 0;
  const completed = browserDeadline(() => { calls++; return never(); }, 25, 'case / axe', clock.timers);
  const rejected = assert.rejects(completed, error => error.code === 'BROWSER_CHECK_TIMEOUT'
    && error.message === 'case / axe timed out after 25 ms (no retry)');
  await clock.advance(25);
  await rejected;
  assert.equal(calls, 1);
  assert.equal(clock.pending.size, 0);
  assert.equal(clock.cleared.length, 1);
});
