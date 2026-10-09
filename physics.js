export const STEP = 1 / 120;
export const INITIAL_SPEED = 100 / 3.6;
export const OVERLOAD_LIMIT = .4;
export const COOLING_RATE = 2;

export const LEVELS = Array.from({ length: 20 }, (_, i) => Object.freeze({
  number: i + 1,
  speed: INITIAL_SPEED,
  target: 110 + [0, 8, -6, 4, -2][i % 5] + Math.floor(i / 5) * 3,
  halfWidth: i < 3 ? [10, 8, 6.5][i] : Math.max(1.8, 5.5 - (i - 3) * .23),
  timeLimit: i < 3 ? [12, 11.5, 11][i] : i < 7 ? 10.5 : i < 12 ? 10 : i < 17 ? 9.5 : 9,
  perfectWidth: Math.max(.3, .95 - i * .035),
  maxDecel: 9,
}));

export function createRun(level) {
  return { position: 0, speed: level.speed, pressure: 0, overload: 0, elapsed: 0, result: null, settled: false };
}

export function stepRun(run, level, held, dt = STEP) {
  if (run.result || !Number.isFinite(dt) || dt <= 0) return run;
  run.elapsed += dt;
  run.pressure += ((held ? 1 : 0) - run.pressure) * (1 - Math.exp(-dt / (held ? .28 : .18)));
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
