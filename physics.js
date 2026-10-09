export const STEP = 1 / 120;
export const INITIAL_SPEED = 100 / 3.6;
export const OVERLOAD_LIMIT = .4;
export const COOLING_RATE = 2;

export const LEVELS = Array.from({ length: 20 }, (_, i) => Object.freeze({
  number: i + 1,
  speed: INITIAL_SPEED,
  target: i === 1 ? 105 : 110 + [0, 8, -6, 4, -2][i % 5] + Math.floor(i / 5) * 3,
  halfWidth: i === 0 ? 12 : i === 1 ? 6 : i < 5 ? 5.5 - (i - 2) * .5 : i < 12 ? 4 - (i - 5) / 6 : 2.8 - (i - 12) / 7,
  timeLimit: i === 0 ? 12 : i === 1 ? 11 : i < 5 ? 10.5 : i < 12 ? 10 : i < 17 ? 9.5 : 9,
  pressureRise: i === 0 ? .28 : .18,
  perfectWidth: Math.max(.3, .95 - i * .035),
  maxDecel: 9,
}));

export function createRun(level, tutorial = false) {
  return { position: 0, speed: level.speed, pressure: 0, overload: 0, elapsed: 0, result: null, settled: false, tutorial: tutorial ? 'active' : null };
}

export function stepRun(run, level, held, dt = STEP) {
  if (run.result || !Number.isFinite(dt) || dt <= 0) return run;
  if (run.tutorial === 'release') {
    if (!held) run.tutorial = 'done';
    return run;
  }
  run.elapsed += dt;
  run.pressure += ((held ? 1 : 0) - run.pressure) * (1 - Math.exp(-dt / (held ? level.pressureRise : .18)));
  // Full pressure is explicit, so the displayed 100% and overload clock agree.
  if (held && run.pressure >= .98) run.pressure = 1;
  run.overload = run.pressure === 1
    ? Math.min(OVERLOAD_LIMIT, run.overload + dt)
    : Math.max(0, run.overload - dt * COOLING_RATE);
  if (run.overload >= OVERLOAD_LIMIT - 1e-9) {
    run.overload = OVERLOAD_LIMIT;
    run.pressure = 0;
    run.result = { success: false, reason: 'broken', error: run.position - level.target };
    return run;
  }
  const oldSpeed = run.speed;
  run.speed = Math.max(0, run.speed - (level.maxDecel * run.pressure + .025) * dt);
  run.position += (oldSpeed + run.speed) * .5 * dt;
  const error = run.position - level.target;
  if (error > level.halfWidth) {
    run.result = { success: false, reason: 'late', error };
  } else if (run.speed <= .025) {
    run.speed = 0;
    run.pressure = 0;
    run.overload = 0;
    const success = Math.abs(error) <= level.halfWidth;
    run.result = { success, reason: success ? 'parked' : 'early', error, perfect: success && Math.abs(error) <= level.perfectWidth };
  }
  if (!run.result && run.elapsed >= level.timeLimit - 1e-9) {
    run.elapsed = level.timeLimit;
    run.result = { success: false, reason: 'timeout', error };
    run.pressure = 0;
  }
  if (!run.result && run.tutorial === 'active' && run.pressure >= .9) run.tutorial = 'release';
  return run;
}

export function createProgress() {
  return { completed: 0, stops: 0, perfectStreak: 0 };
}

// Settling is idempotent: animation frames and duplicate callbacks cannot add stops twice.
export function settleAttempt(progress, run) {
  if (!run.result || run.settled) return false;
  run.settled = true;
  if (run.result.reason === 'parked' || run.result.reason === 'early') progress.stops++;
  if (run.result.success) {
    progress.completed++;
    progress.perfectStreak = run.result.perfect ? progress.perfectStreak + 1 : 0;
  } else progress.perfectStreak = 0;
  return true;
}
