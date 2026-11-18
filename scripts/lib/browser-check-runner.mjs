export const BROWSER_CASE_TIMEOUT_MS = 180_000;
export const BROWSER_CLEANUP_TIMEOUT_MS = 10_000;
export const BROWSER_SUITE_TIMEOUT_MS = 20 * 60_000;

export async function browserDeadline(operation, milliseconds, label, {
  setTimer = setTimeout, clearTimer = clearTimeout,
} = {}) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimer(() => {
          const error = new Error(`${label} timed out after ${milliseconds} ms (no retry)`);
          error.code = 'BROWSER_CHECK_TIMEOUT';
          reject(error);
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimer(timer);
  }
}

// Checkpoint is a synchronous report sink: persist the first failure before
// awaiting any browser cleanup, which can itself be the failed operation.
export async function runBoundedBrowserCase({
  id, result, run, cleanup, forceKill, hardKill, checkpoint, log = console.log,
  caseTimeout = BROWSER_CASE_TIMEOUT_MS, cleanupTimeout = BROWSER_CLEANUP_TIMEOUT_MS,
  timers,
}) {
  result.status = 'running';
  result.phase = 'start';
  result.failures ||= [];
  result.phases ||= [];
  let running = true;
  const failure = (error, phase) => {
    const entry = { phase, message: error.message, ...(error.code && { code: error.code }) };
    result.failures.push(entry);
    result.firstFailure ||= entry;
    result.problems.push(`${phase}: ${error.message}`);
  };
  const phase = (enabled, name, operation) => {
    if (!enabled()) throw new Error(`Case ${id} has already stopped; no further phase may start`);
    result.phase = name;
    result.phases.push({ phase: name, startedAt: new Date().toISOString() });
    log(`START ${id}: ${name}`);
    checkpoint();
    return Promise.resolve().then(() => {
      if (!enabled()) throw new Error(`Case ${id} has already stopped; no further phase may start`);
      return operation();
    });
  };
  log(`START ${id}: case`);
  checkpoint();
  try {
    await browserDeadline(() => run((name, operation) => phase(() => running, name, operation), () => running), caseTimeout, `${id} / case`, timers);
  } catch (error) {
    failure(error, result.phase);
  } finally {
    running = false;
  }
  result.status = result.problems.length ? 'failed' : 'checked';
  result.phase = 'cleanup';
  checkpoint();
  let cleaning = true;
  // Reserve part of the single cleanup budget for the browser process tree's
  // forceful shutdown. A stuck graceful close cannot consume that reserve.
  const killTimeout = Math.min(2000, cleanupTimeout / 5);
  try {
    await browserDeadline(() => cleanup((name, operation) => phase(() => cleaning, name, operation)), cleanupTimeout - killTimeout, `${id} / cleanup`, timers);
  } catch (error) {
    failure(error, result.phase);
    cleaning = false;
    result.phase = 'force kill';
    log(`START ${id}: force kill`);
    checkpoint();
    try { await browserDeadline(forceKill, killTimeout, `${id} / force kill`, timers); }
    catch (killError) {
      failure(killError, 'force kill');
      try { hardKill(); }
      catch (hardKillError) { failure(hardKillError, 'hard kill'); }
    }
  } finally {
    cleaning = false;
  }
  result.status = result.problems.length ? 'failed' : 'passed';
  result.phase = 'complete';
  checkpoint();
  return result;
}
