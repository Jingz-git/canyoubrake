import { LEVELS, STEP, OVERLOAD_LIMIT, createRun, stepRun, createProgress, settleAttempt } from './physics.js';
const $ = id => document.getElementById(id);
const canvas = $('track');
const ctx = canvas.getContext('2d');
let width = 0, height = 0, levelIndex = 0, state = 'ready', held = false;
let run = createRun(LEVELS[0]), lastTime = 0, accumulator = 0, countdown = 0;
let progress = createProgress(), best = { level: 0, precision: null }, muted = true;
let previousStop = null, pointerWasBrake = false, activePointer = null;
let breakTime = 0, visualDrift = 0, resultReadyAt = 0;
const arena = document.querySelector('.arena');
const settlement = $('settlement');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const car = new Image();
car.src = './assets/car.png';
try { const saved = JSON.parse(localStorage.getItem('brake-once-v2')); if (saved && Number.isInteger(saved.level) && saved.level >= 0 && saved.level <= 20) best = { level: saved.level, precision: Number.isFinite(saved.precision) && saved.precision >= 0 ? saved.precision : null }; muted = localStorage.getItem('brake-once-muted') !== 'false'; } catch {}
function storeBest() { try { localStorage.setItem('brake-once-v2', JSON.stringify(best)); } catch {} }
function resize() { const rect = canvas.getBoundingClientRect(); width = rect.width; height = rect.height; const ratio = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw(); }
new ResizeObserver(resize).observe(canvas);
function rounded(x, y, w, h, radius, fill) { ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill(); }
function draw() {
  if (!width || !height) return;
  const level = LEVELS[levelIndex];
  const anchor = Math.min(height * .73, height - 108);
  const viewPosition = run.position + visualDrift;
  const distance = level.target - viewPosition;
  const baseScale = Math.max(.55, (anchor - 55) / level.target);
  const zoom = Math.max(0, 1 - Math.max(distance, 0) / 25);
  const scale = baseScale + (8 - baseScale) * zoom * zoom;
  const cx = width / 2, roadWidth = width < 520 ? 144 : 174;
  const left = cx - roadWidth / 2, right = cx + roadWidth / 2;
  const project = pos => anchor - (pos - viewPosition) * scale;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f0f2f4'; ctx.fillRect(left, 0, roadWidth, height - 26);
  ctx.fillStyle = '#e9edf0'; ctx.fillRect(left - 7, 0, 2, height - 26); ctx.fillRect(right + 5, 0, 2, height - 26);
  ctx.save(); ctx.beginPath(); ctx.rect(left - 23, 0, roadWidth + 75, height - 26); ctx.clip();
  for (let pos = Math.floor((viewPosition - 140) / 5) * 5; pos < viewPosition + 500; pos += 5) {
    const y = project(pos); if (y < -25 || y > height) continue;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(left + 7, y); ctx.lineTo(left + 7, y - Math.min(15, scale * 2.2)); ctx.moveTo(right - 7, y); ctx.lineTo(right - 7, y - Math.min(15, scale * 2.2)); ctx.stroke();
    ctx.strokeStyle = '#d9dfe5'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(right + 14, y); ctx.lineTo(right + 20, y); ctx.stroke();
  }
  const targetY = project(level.target), targetHeight = level.halfWidth * 2 * scale;
  ctx.fillStyle = '#b8e8d6'; ctx.fillRect(left + 12, targetY - targetHeight / 2, roadWidth - 24, targetHeight);
  ctx.strokeStyle = '#239d7c'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.strokeRect(left + 12, targetY - targetHeight / 2, roadWidth - 24, targetHeight); ctx.setLineDash([]);
  ctx.fillStyle = '#228b6d'; ctx.fillRect(left + 12, targetY - 1, roadWidth - 24, 2);
  ctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#2c9376'; ctx.fillText('停车区', cx, targetY - targetHeight / 2 - 12);
  if (previousStop && previousStop.level === levelIndex && state === 'running') {
    const y = project(previousStop.position); ctx.strokeStyle = '#e1b9a8'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(left + 18, y); ctx.lineTo(right - 18, y); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  if (car.complete && car.naturalWidth) {
    const carWidth = 43, carHeight = 83;
    ctx.save(); ctx.shadowColor = '#1b243526'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
    ctx.drawImage(car, cx - carWidth / 2, anchor - 13, carWidth, carHeight); ctx.restore();
  } else { rounded(cx - 15, anchor + 5, 30, 48, 8, '#f26435'); }
  ctx.strokeStyle = '#f26435'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx - 28, anchor); ctx.lineTo(cx + 28, anchor); ctx.stroke();
  ctx.fillStyle = '#f26435'; ctx.beginPath(); ctx.arc(cx - 28, anchor, 3, 0, Math.PI * 2); ctx.arc(cx + 28, anchor, 3, 0, Math.PI * 2); ctx.fill();
  const fade = ctx.createLinearGradient(0, height - 55, 0, height - 24); fade.addColorStop(0, '#ffffff00'); fade.addColorStop(1, '#ffffff'); ctx.fillStyle = fade; ctx.fillRect(0, height - 55, width, 31);
}
function message(tag, title, copy, kind = '') { $('message').className = `scene-message ${kind}`; $('message').hidden = false; $('result-tag').textContent = tag; $('result-title').textContent = title; $('result-copy').textContent = copy; $('announcer').textContent = `${title} ${copy}`; }
function setPedal(label, note, success = false) { $('pedal-label').textContent = label; $('pedal-note').textContent = note; $('pedal').classList.toggle('success', success); }
function updateUI() {
  $('level').textContent = String(levelIndex + 1).padStart(2, '0');
  $('speed').textContent = Math.round(run.speed * 3.6);
  $('distance').textContent = Math.abs(LEVELS[levelIndex].target - run.position).toFixed(1);
  $('distance-label').textContent = run.position > LEVELS[levelIndex].target ? '已过目标中心' : '距目标中心';
  const pressure = run.pressure === 1 ? 100 : Math.min(99, Math.round(run.pressure * 100));
  $('pressure-fill').style.width = `${pressure}%`;
  const zone = pressure >= 95 ? 'danger' : pressure >= 75 ? 'warning' : 'normal';
  $('pressure-meter').dataset.zone = zone;
  $('pressure-meter').setAttribute('aria-valuenow', String(pressure));
  $('pressure-value').textContent = pressure;
  $('best').textContent = best.level ? `最佳 ${best.level} 关${best.precision !== null ? ` · 最准 ${best.precision.toFixed(2)} m` : ''}` : '提前停住可重试本关';
  $('stop-count').textContent = progress.stops;
  const overloadPercent = Math.min(100, Math.round(run.overload / OVERLOAD_LIMIT * 100));
  $('overload-fill').style.width = `${overloadPercent}%`;
  $('overload-meter').setAttribute('aria-valuenow', String(overloadPercent));
  $('overload-label').textContent = run.result?.reason === 'broken' ? '满力过载 · 刹车杆已断裂' : run.overload > .005 ? `过载 ${run.overload.toFixed(1)} / ${OVERLOAD_LIMIT.toFixed(1)} 秒${pressure < 100 ? ' · 消退中' : ''}` : '满力过载 0.8 秒会断杆';
  $('overload-label').classList.toggle('danger', run.overload > .35);
  if (state === 'running') $('control-hint').textContent = pressure === 100 ? '过载！松手减压' : run.overload > .01 ? '保持松手，让过载消退' : pressure >= 75 ? '接近满力，准备松手' : '停进绿区，满力要松手';
  $('pause').disabled = !['running', 'countdown', 'paused'].includes(state);
  $('pause').setAttribute('aria-label', state === 'paused' ? '继续游戏' : '暂停游戏');
  $('pause').title = state === 'paused' ? '继续游戏' : '暂停游戏';
  $('restart').hidden = ['ready', 'running', 'countdown'].includes(state);
  $('track-wrap').dataset.state = state;
  arena.dataset.state = state;
  arena.classList.toggle('is-broken', run.result?.reason === 'broken');
  arena.classList.toggle('is-overloaded', state === 'running' && run.overload > .35);
  $('pedal').classList.toggle('is-held', held && state === 'running');
  $('pedal').disabled = state === 'countdown' || state === 'breaking';
  $('streak').textContent = progress.perfectStreak > 1 ? `连续 ${progress.perfectStreak} 次 Perfect` : progress.completed ? `已闯过 ${progress.completed} 关` : state === 'ready' ? '20 关挑战' : '脚下留点余地';
}
function prepare(index, fresh = false) {
  levelIndex = index; run = createRun(LEVELS[index]); accumulator = 0; held = false;
  if (fresh) { progress = createProgress(); previousStop = null; }
  visualDrift = 0; breakTime = 0; resultReadyAt = 0;
  if (settlement.open) settlement.close();
  state = 'countdown'; countdown = .75; activePointer = null; $('message').hidden = true; $('countdown').hidden = false; $('countdown').textContent = index === 0 ? '准备出发' : `第 ${index + 1} 关`;
  setPedal('按住刹车', '松开减力'); $('control-hint').textContent = '停进绿区，满力要松手'; updateUI();
}
let audioContext;
function sound(success, perfect = false) { if (muted) return; try { audioContext ??= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume(); const now = audioContext.currentTime; [success ? 523.25 : 220, success ? (perfect ? 1046.5 : 659.25) : 164.8].forEach((freq, i) => { const osc = audioContext.createOscillator(), gain = audioContext.createGain(); osc.type = 'sine'; osc.frequency.value = freq; gain.gain.setValueAtTime(0, now + i * .11); gain.gain.linearRampToValueAtTime(.045, now + i * .11 + .015); gain.gain.exponentialRampToValueAtTime(.0001, now + i * .11 + .19); osc.connect(gain).connect(audioContext.destination); osc.start(now + i * .11); osc.stop(now + i * .11 + .2); }); } catch {} }
function finish() {
  if (state !== 'running' || !settleAttempt(progress, run)) return;
  held = false; activePointer = null; const result = run.result;
  previousStop = { level: levelIndex, position: run.position };
  resultReadyAt = performance.now() + 450;
  if (result.success) {
    best.level = Math.max(best.level, progress.completed); best.precision = Math.min(best.precision ?? Infinity, Math.abs(result.error)); storeBest();
    state = progress.completed === LEVELS.length ? 'complete' : 'success';
    message(state === 'complete' ? '20 / 20 · 全部通过' : `第 ${progress.completed} 关通过`, state === 'complete' ? '这一脚，满分收官。' : result.perfect ? 'Perfect！' : '稳稳停住。', `偏离中心 ${Math.abs(result.error).toFixed(2)} 米${result.perfect ? ' · 刚刚好' : ''}`, `success ${result.perfect ? 'perfect' : ''}`);
    setPedal(state === 'complete' ? '再挑战一次' : '下一关', state === 'complete' ? '刷新你的最佳精度' : `第 ${progress.completed + 1} 关，继续稳住`, true);
    $('control-hint').textContent = result.perfect ? '漂亮！这一脚刚刚好。' : '停进绿区，挑战成功。'; sound(true, result.perfect);
    if (state === 'complete') showSettlement();
  } else if (result.reason === 'early') {
    state = 'retry';
    message(`第 ${levelIndex + 1} 关 · 进度保留`, '提前停住，可以继续。', `距中心还差 ${Math.abs(result.error).toFixed(2)} 米 · 已计入刹停次数`, 'retry');
    setPedal('重试本关', `仍从 100 km/h 开始`);
    $('control-hint').textContent = '晚一点踩，或早点松手。'; sound(true);
  } else if (result.reason === 'broken') {
    state = 'breaking'; breakTime = 0; visualDrift = 0;
    $('message').hidden = true;
    setPedal('刹车杆断裂', '制动力已丢失');
    $('control-hint').textContent = '满力过载，刹车杆断裂。';
    $('announcer').textContent = '刹车杆断裂，本轮挑战结束。';
    sound(false);
  } else {
    state = 'failed';
    message(`第 ${levelIndex + 1} 关 · 挑战结束`, '错过停车区了。', '下次早点刹车，留足停车距离。', 'failure');
    setPedal('再来一轮', '从第 1 关重新挑战');
    $('control-hint').textContent = '下次早点踩，留足刹车距离。'; sound(false);
    showSettlement();
  }
  updateUI();
}
function showSettlement() {
  const broken = run.result?.reason === 'broken';
  $('settlement-tag').textContent = state === 'complete' ? '20 / 20 · 全部通过' : `第 ${levelIndex + 1} 关 · 本轮结束`;
  $('settlement-title').textContent = state === 'complete' ? '每一脚，都到位了。' : broken ? '刹车杆断裂' : '错过停车区了';
  $('completed-prefix').textContent = progress.completed ? '您已闯过' : '本轮尚未通过关卡，';
  $('settlement-level').hidden = !progress.completed;
  $('settlement-level').textContent = progress.completed;
  $('completed-suffix').hidden = !progress.completed;
  $('settlement-stops').textContent = progress.stops;
  $('settlement-note').textContent = state === 'complete' ? '20 关全部通过，试试更精准的停车。' : broken ? '满力过载 0.8 秒。下次松手减压，再稳稳刹停。' : '提前停住可以重试，越过停车区则本轮结束。';
  settlement.classList.toggle('is-success', state === 'complete');
  if (!settlement.open) settlement.showModal();
  $('announcer').textContent = `尊敬的车主，您已闯过 ${progress.completed} 关，顺利刹停 ${progress.stops} 次。`;
}
function pause() { if (!['running', 'countdown'].includes(state)) return; state = 'paused'; held = false; activePointer = null; accumulator = 0; $('countdown').hidden = true; message('休息一下', '稳住，随时继续。', '继续后会给你 1 秒准备时间。'); setPedal('继续挑战', '调整好，再出发'); $('control-hint').textContent = '游戏已暂停'; updateUI(); }
function resume() { if (state !== 'paused') return; held = false; state = 'countdown'; countdown = 1; $('message').hidden = true; $('countdown').hidden = false; $('countdown').textContent = '准备继续'; setPedal('按住刹车', '松开减力'); $('control-hint').textContent = '把橙色标记停进绿区'; lastTime = performance.now(); accumulator = 0; updateUI(); }
function action() { if (performance.now() < resultReadyAt || settlement.open) return; if (state === 'paused') resume(); else if (state === 'success') prepare(levelIndex + 1); else if (state === 'retry') prepare(levelIndex); else if (['ready', 'failed', 'complete'].includes(state)) prepare(0, true); }
$('pedal').addEventListener('pointerdown', event => { if (event.button !== 0 || activePointer !== null) return; pointerWasBrake = state === 'running'; if (state === 'running') { activePointer = event.pointerId; held = true; $('pedal').setPointerCapture(event.pointerId); updateUI(); event.preventDefault(); } });
$('pedal').addEventListener('pointerup', event => { if (activePointer !== event.pointerId) return; activePointer = null; held = false; updateUI(); });
$('pedal').addEventListener('lostpointercapture', event => { if (activePointer !== event.pointerId) return; activePointer = null; held = false; updateUI(); });
$('pedal').addEventListener('pointercancel', event => { if (activePointer !== event.pointerId) return; activePointer = null; held = false; pause(); });
$('pedal').addEventListener('click', () => { if (pointerWasBrake) { pointerWasBrake = false; return; } action(); });
window.addEventListener('keydown', event => { if (settlement.open) return; if (event.code === 'Space' && !['sound', 'pause', 'restart'].includes(document.activeElement?.id)) { event.preventDefault(); if (event.repeat) return; if (state === 'running') held = true; else action(); updateUI(); } else if (event.code === 'Escape') { if (state === 'paused') resume(); else pause(); } });
window.addEventListener('keyup', event => { if (event.code === 'Space') { held = false; updateUI(); } });
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
$('pause').addEventListener('click', () => state === 'paused' ? resume() : pause());
$('restart').addEventListener('click', () => prepare(0, true));
$('settlement-retry').addEventListener('click', () => { if (performance.now() >= resultReadyAt) prepare(0, true); });
$('settlement-close').addEventListener('click', () => settlement.close());
function updateSound() { $('sound').setAttribute('aria-pressed', String(!muted)); $('sound').setAttribute('aria-label', muted ? '开启声音' : '关闭声音'); $('sound').title = muted ? '开启声音' : '关闭声音'; $('sound-waves').setAttribute('d', muted ? 'm16 9 5 6m0-6-5 6' : 'M15 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14'); }
$('sound').addEventListener('click', () => { muted = !muted; try { localStorage.setItem('brake-once-muted', String(muted)); } catch {} updateSound(); if (!muted) sound(true); });
function frame(time) {
  const delta = Math.min(.1, Math.max(0, (time - (lastTime || time)) / 1000)); lastTime = time;
  if (state === 'countdown') { countdown -= delta; if (countdown <= 0) { state = 'running'; held = false; accumulator = 0; $('countdown').hidden = true; $('announcer').textContent = `第 ${levelIndex + 1} 关开始，按住刹车。`; } }
  else if (state === 'running') { accumulator += delta; while (accumulator >= STEP && state === 'running') { stepRun(run, LEVELS[levelIndex], held); accumulator -= STEP; if (run.result) finish(); } }
  else if (state === 'breaking') {
    breakTime += delta;
    if (!reducedMotion.matches) visualDrift = run.speed * Math.min(breakTime, .55);
    if (breakTime >= .55) {
      state = 'failed';
      setPedal('再来一轮', '从第 1 关重新挑战');
      message(`第 ${levelIndex + 1} 关 · 挑战结束`, '刹车杆断裂。', '满力时记得松手，让过载消退。', 'failure');
      showSettlement();
    }
  }
  updateUI(); draw(); requestAnimationFrame(frame);
}
updateSound(); updateUI(); requestAnimationFrame(frame);

// Optional browser-native agent access. Every action uses the same game state as the UI.
const modelContext = document.modelContext;
if (modelContext?.registerTool) {
  const lifecycle = new AbortController();
  const snapshot = () => ({ state, level: levelIndex + 1, completed: progress.completed, stops: progress.stops, speedKmh: +(run.speed * 3.6).toFixed(2), distanceToTarget: +(LEVELS[levelIndex].target - run.position).toFixed(3), pressure: +run.pressure.toFixed(3), overload: +run.overload.toFixed(3), braking: held, elapsed: +run.elapsed.toFixed(3), result: run.result, best });
  const register = tool => { try { Promise.resolve(modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} };
  register({ name: 'get_game_state', title: '查看游戏状态', description: 'Read the current braking game state, remaining distance, pressure, level, and outcome.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input) { if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('Expected an empty object.'); return snapshot(); } });
  register({ name: 'control_game', title: '控制挑战进度', description: 'Start, pause, resume, retry the current level after an early stop, restart the challenge, or advance after winning. Cannot skip levels.', inputSchema: { type: 'object', properties: { action: { type: 'string', enum: ['start', 'pause', 'resume', 'retry', 'restart', 'next'] } }, required: ['action'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { if (!input || typeof input !== 'object' || Object.keys(input).some(k => k !== 'action')) throw new Error('Invalid action input.'); const valid = { start: ['ready', 'failed', 'complete'], pause: ['running', 'countdown'], resume: ['paused'], retry: ['retry'], restart: ['success', 'retry', 'failed', 'complete', 'paused'], next: ['success'] }; if (!valid[input.action]?.includes(state)) throw new Error(`Action ${input.action} is not available in ${state}.`); if (input.action === 'pause') pause(); else if (input.action === 'resume') resume(); else if (input.action === 'next') prepare(levelIndex + 1); else if (input.action === 'retry') prepare(levelIndex); else prepare(0, true); updateUI(); return snapshot(); } });
  register({ name: 'set_brake_input', title: '按下或松开刹车', description: 'Hold or release the brake during a running level, equivalent to the pedal button. Time continues normally.', inputSchema: { type: 'object', properties: { pressed: { type: 'boolean' } }, required: ['pressed'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input) { if (!input || typeof input.pressed !== 'boolean' || Object.keys(input).some(k => k !== 'pressed')) throw new Error('pressed must be a boolean.'); if (state !== 'running') throw new Error('Brake input requires a running level.'); held = input.pressed; updateUI(); return snapshot(); } });
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
