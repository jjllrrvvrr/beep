/**
 * beep - Sport Timer
 */

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const fmtMs = (ms) => {
  const t = Math.floor(ms / 10);
  const s = Math.floor(t / 100);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const centi = t % 100;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${centi.toString().padStart(2, '0')}`;
};

// Audio
let audioCtx = null;
function getAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, vol = 0.2) {
  try {
    const ctx = getAudio();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function playBell() { playTone(520, 1.0, 0.25); playTone(1040, 0.8, 0.1); }
function playDing() { playTone(880, 0.25, 0.15); }
function playFinish() {
  setTimeout(() => playTone(660, 1.0, 0.2), 0);
  setTimeout(() => playTone(880, 1.2, 0.2), 350);
  setTimeout(() => playTone(1100, 1.5, 0.2), 800);
}
function playTick() { playTone(600, 0.06, 0.06); }

// ================= TIMER ENGINE =================
class TimerEngine {
  constructor(tickCb, doneCb) {
    this.running = false;
    this.intervalId = null;
    this.onTick = tickCb;
    this.onDone = doneCb;
  }

  start() {
    if (this.running) return;
    this.running = true;
    getAudio();
    this.intervalId = setInterval(() => {
      const done = this.onTick();
      if (done) this.stop();
    }, 1000);
  }

  pause() {
    this.running = false;
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
  }

  stop() {
    this.pause();
    if (this.onDone) this.onDone();
  }

  toggle() {
    this.running ? this.pause() : this.start();
  }
}

// ================= STOPWATCH =================
class StopwatchTimer {
  constructor() {
    this.startTime = 0;
    this.elapsed = 0;
    this.running = false;
    this.raf = null;
    this.laps = [];
    this.display = document.getElementById('chronoDisplay');
    this.startBtn = document.getElementById('chronoStartBtn');
    this.lapBtn = document.getElementById('chronoLapBtn');
    this.lapsList = document.getElementById('chronoLaps');
    this.configEl = document.getElementById('chronoConfig');
    this.timerEl = document.getElementById('chronoTimer');
  }

  start() {
    this.configEl.classList.add('hidden');
    this.timerEl.classList.remove('hidden');
    const cdOn = document.getElementById('chronoCountdownToggle')?.checked || false;
    const cdSec = parseInt(document.getElementById('chronoCountdownSec')?.value || 0);
    if (cdOn && cdSec > 0) {
      this.countdown = cdSec;
      this.phase = 'countdown';
      this.timeLeft = cdSec;
      this.engine = new TimerEngine(() => this.tickCd(), () => {});
      this.updateCdUI();
      this.engine.start();
    } else {
      this.toggle();
    }
  }

  tickCd() {
    this.timeLeft--;
    if (this.timeLeft <= 3 && this.timeLeft > 0) playTick();
    if (this.timeLeft <= 0) {
      this.engine.stop();
      this.phase = 'running';
      this.toggle();
      return true;
    }
    this.updateCdUI();
    return false;
  }

  updateCdUI() {
    this.display.textContent = fmtTime(this.timeLeft);
    document.querySelector('#chronoTimer .phase-badge').textContent = 'Get ready';
    document.querySelector('#chronoTimer .phase-badge').className = 'phase-badge countdown';
    if (this.timeLeft <= 3 && this.timeLeft > 0) this.display.classList.add('pulsing');
    else this.display.classList.remove('pulsing');
  }

  tick = () => {
    this.elapsed = Date.now() - this.startTime;
    this.display.textContent = fmtMs(this.elapsed);
    if (this.running) this.raf = requestAnimationFrame(this.tick);
  };

  toggle() {
    if (this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.startBtn.textContent = 'Resume';
      this.startBtn.classList.add('paused');
    } else {
      this.startTime = Date.now() - this.elapsed;
      this.running = true;
      this.startBtn.textContent = 'Pause';
      this.startBtn.classList.remove('paused');
      this.tick();
    }
  }

  lap() {
    if (!this.running) return;
    this.laps.push(this.elapsed);
    const row = document.createElement('div');
    row.className = 'lap-row';
    const prev = this.laps.length > 1 ? this.laps[this.laps.length - 2] : 0;
    const diff = this.elapsed - prev;
    row.innerHTML = `<span>Lap ${this.laps.length}</span><span>${fmtMs(diff)}</span>`;
    this.lapsList.prepend(row);
  }

  reset() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.elapsed = 0;
    this.laps = [];
    this.display.textContent = '00:00.00';
    this.startBtn.textContent = 'Start';
    this.startBtn.classList.remove('paused');
    this.lapsList.innerHTML = '';
    this.configEl.classList.remove('hidden');
    this.timerEl.classList.add('hidden');
  }
}

// ================= COUNTDOWN =================
class CountdownTimer {
  constructor() {
    this.engine = new TimerEngine(() => this.tick(), () => this.finish());
    this.totalDuration = 0;
    this.timeLeft = 0;
    this.elapsed = 0;

    this.phaseEl = document.getElementById('cdPhase');
    this.displayEl = document.getElementById('cdDisplay');
    this.progressEl = document.getElementById('cdProgress');
    this.metaEl = document.getElementById('cdMeta');
    this.pauseBtn = document.getElementById('cdPauseBtn');
    this.configEl = document.getElementById('countdownConfig');
    this.timerEl = document.getElementById('countdownTimer');
  }

  startFromConfig() {
    this.totalDuration = (parseInt(document.getElementById('cdMin').value || 0) * 60) + parseInt(document.getElementById('cdSec').value || 0);
    if (this.totalDuration <= 0) { alert('Set a time > 0'); return; }

    const cdOn = document.getElementById('cdCountdownToggle')?.checked || false;
    const cdSec = parseInt(document.getElementById('cdCountdownSec')?.value || 0);

    this.configEl.classList.add('hidden');
    this.timerEl.classList.remove('hidden');

    if (cdOn && cdSec > 0) {
      this.countdown = cdSec;
      this.phase = 'countdown';
      this.timeLeft = cdSec;
      this.updateUI();
      this.engine.start();
    } else {
      this.timeLeft = this.totalDuration;
      this.elapsed = 0;
      this.phase = 'active';
      this.updateUI();
      this.engine.start();
    }
  }

  tick() {
    this.timeLeft--;

    if (this.timeLeft <= 3 && this.timeLeft > 0) playTick();

    if (this.timeLeft <= 0) {
      if (this.phase === 'countdown') {
        this.phase = 'active';
        this.timeLeft = this.totalDuration;
        this.elapsed = 0;
        playBell();
      } else {
        this.timeLeft = 0;
        this.updateUI();
        return true;
      }
    } else {
      if (this.phase !== 'countdown') this.elapsed++;
    }
    this.updateUI();
    return false;
  }

  updateUI() {
    const done = this.timeLeft <= 0 && this.elapsed > 0 && this.phase !== 'countdown';
    if (done) {
      this.phaseEl.textContent = 'Done';
      this.phaseEl.className = 'phase-badge';
      this.displayEl.textContent = '00:00';
      this.displayEl.style.color = 'var(--yellow)';
      this.progressEl.style.width = '100%';
      this.progressEl.style.background = 'var(--yellow)';
      this.metaEl.textContent = '-';
      this.pauseBtn.textContent = 'Start';
      this.pauseBtn.classList.remove('paused');
      this.displayEl.classList.remove('pulsing');
      return;
    }

    if (this.phase === 'countdown') {
      this.phaseEl.textContent = 'Get ready';
      this.phaseEl.className = 'phase-badge countdown';
      this.displayEl.textContent = this.timeLeft;
      this.displayEl.style.color = 'var(--yellow)';
      const pct = this.countdown > 0 ? ((this.countdown - this.timeLeft) / this.countdown) * 100 : 0;
      this.progressEl.style.width = `${pct}%`;
      this.progressEl.style.background = 'var(--yellow)';
      this.metaEl.textContent = '-';
      this.displayEl.classList.add('pulsing');
      this.pauseBtn.textContent = this.engine.running ? 'Pause' : 'Resume';
      return;
    }

    this.displayEl.textContent = fmtTime(this.timeLeft);
    this.phaseEl.textContent = 'Remaining';
    this.phaseEl.className = 'phase-badge';
    this.displayEl.style.color = '';

    const pct = ((this.totalDuration - this.timeLeft) / this.totalDuration) * 100;
    this.progressEl.style.width = `${pct}%`;
    this.progressEl.style.background = 'var(--green)';
    this.metaEl.textContent = `${fmtTime(this.timeLeft)} / ${fmtTime(this.totalDuration)}`;

    if (this.timeLeft <= 3 && this.timeLeft > 0) this.displayEl.classList.add('pulsing');
    else this.displayEl.classList.remove('pulsing');

    this.pauseBtn.textContent = this.engine.running ? 'Pause' : 'Resume';
    if (!this.engine.running) this.pauseBtn.classList.add('paused');
    else this.pauseBtn.classList.remove('paused');
  }

  finish() {
    this.engine.pause();
    playFinish();
    this.updateUI();
  }

  toggle() {
    this.engine.toggle();
    this.updateUI();
  }

  reset() {
    this.engine.pause();
    this.configEl.classList.remove('hidden');
    this.timerEl.classList.add('hidden');
    this.displayEl.classList.remove('pulsing');
    this.displayEl.style.color = '';
    this.pauseBtn.classList.remove('paused');
  }
}

// ================= ROUNDS =================
class RoundTimer {
  constructor() {
    this.engine = new TimerEngine(() => this.tick(), () => this.finish());
    this.roundCount = 5;
    this.roundDuration = 180;
    this.restDuration = 60;
    this.currentRound = 1;
    this.timeLeft = 0;
    this.phase = 'ready'; // 'round' | 'rest' | 'done'
    this.totalDuration = 0;
    this.elapsed = 0;

    this.phaseEl = document.getElementById('roundPhase');
    this.displayEl = document.getElementById('roundDisplay');
    this.progressEl = document.getElementById('roundProgress');
    this.currentEl = document.getElementById('roundCurrent');
    this.totalEl = document.getElementById('roundTotalTime');
    this.pauseBtn = document.getElementById('roundPauseBtn');
    this.configEl = document.getElementById('roundConfig');
    this.timerEl = document.getElementById('roundTimer');

    ['roundCount','roundDurMin','roundDurSec','roundRestMin','roundRestSec'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateTotal());
    });
    document.getElementById('roundRestToggle')?.addEventListener('change', () => this.updateTotal());
  }

  updateTotal() {
    const rounds = parseInt(document.getElementById('roundCount')?.value || 1);
    const dur = (parseInt(document.getElementById('roundDurMin')?.value || 0) * 60) + parseInt(document.getElementById('roundDurSec')?.value || 0);
    const restOn = document.getElementById('roundRestToggle')?.checked || false;
    const rest = restOn
      ? (parseInt(document.getElementById('roundRestMin')?.value || 0) * 60) + parseInt(document.getElementById('roundRestSec')?.value || 0)
      : 0;
    const total = (dur * rounds) + (rest * (rounds - 1));
    document.getElementById('roundTotal').textContent = `Total: ~${Math.ceil(total/60)} min`;
  }

  startFromConfig() {
    this.roundCount = parseInt(document.getElementById('roundCount').value);
    this.roundDuration = (parseInt(document.getElementById('roundDurMin').value || 0) * 60) + parseInt(document.getElementById('roundDurSec').value || 0);
    const restOn = document.getElementById('roundRestToggle')?.checked || false;
    this.restDuration = restOn
      ? (parseInt(document.getElementById('roundRestMin').value || 0) * 60) + parseInt(document.getElementById('roundRestSec').value || 0)
      : 0;

    if (this.roundDuration <= 0) { alert('Round duration must be > 0'); return; }

    const cdOn = document.getElementById('roundCountdownToggle')?.checked || false;
    const cdSec = parseInt(document.getElementById('roundCountdownSec')?.value || 0);

    this.configEl.classList.add('hidden');
    this.timerEl.classList.remove('hidden');

    if (cdOn && cdSec > 0) {
      this.countdown = cdSec;
      this.phase = 'countdown';
      this.timeLeft = cdSec;
      this.totalDuration = (this.roundDuration * this.roundCount) + (this.restDuration * (this.roundCount - 1));
      this.elapsed = 0;
      this.updateUI();
      this.engine.start();
    } else {
      this.currentRound = 1;
      this.elapsed = 0;
      this.phase = 'round';
      this.timeLeft = this.roundDuration;
      this.totalDuration = (this.roundDuration * this.roundCount) + (this.restDuration * (this.roundCount - 1));
      this.updateUI();
      this.engine.start();
    }
  }

  tick() {
    this.timeLeft--;

    if (this.timeLeft <= 3 && this.timeLeft > 0) playTick();

    if (this.timeLeft <= 0) {
      if (this.phase === 'countdown') {
        this.currentRound = 1;
        this.elapsed = 0;
        this.phase = 'round';
        this.timeLeft = this.roundDuration;
        playBell();
      } else if (this.phase === 'round') {
        if (this.currentRound >= this.roundCount) {
          this.phase = 'done';
          this.timeLeft = 0;
          this.updateUI();
          return true;
        }
        if (this.restDuration > 0) {
          this.phase = 'rest';
          this.timeLeft = this.restDuration;
          playDing();
        } else {
          this.currentRound++;
          this.timeLeft = this.roundDuration;
          playDing();
        }
      } else if (this.phase === 'rest') {
        this.currentRound++;
        this.phase = 'round';
        this.timeLeft = this.roundDuration;
        playBell();
      }
    } else {
      if (this.phase !== 'countdown') this.elapsed++;
    }
    this.updateUI();
    return this.phase === 'done';
  }

  updateUI() {
    if (this.phase === 'done') {
      this.phaseEl.textContent = 'Done';
      this.phaseEl.className = 'phase-badge';
      this.displayEl.textContent = '00:00';
      this.displayEl.style.color = 'var(--yellow)';
      this.progressEl.style.width = '100%';
      this.progressEl.style.background = 'var(--yellow)';
      this.currentEl.textContent = '-';
      this.totalEl.textContent = '-';
      this.pauseBtn.textContent = 'Start';
      this.pauseBtn.classList.remove('paused');
      this.displayEl.classList.remove('pulsing');
      return;
    }

    if (this.phase === 'countdown') {
      this.phaseEl.textContent = 'Get ready';
      this.phaseEl.className = 'phase-badge countdown';
      this.displayEl.textContent = this.timeLeft;
      this.displayEl.style.color = 'var(--yellow)';
      const pct = this.countdown > 0 ? ((this.countdown - this.timeLeft) / this.countdown) * 100 : 0;
      this.progressEl.style.width = `${pct}%`;
      this.progressEl.style.background = 'var(--yellow)';
      this.currentEl.textContent = '-';
      this.totalEl.textContent = '-';
      this.displayEl.classList.add('pulsing');
      this.pauseBtn.textContent = this.engine.running ? 'Pause' : 'Resume';
      return;
    }

    const isRound = this.phase === 'round';
    this.displayEl.textContent = fmtTime(this.timeLeft);
    this.phaseEl.textContent = isRound ? `Round ${this.currentRound}` : 'Rest';
    this.phaseEl.className = 'phase-badge ' + (isRound ? 'effort' : 'rest');
    this.displayEl.style.color = '';

    const totalPhase = isRound ? this.roundDuration : this.restDuration;
    const pct = totalPhase > 0 ? ((totalPhase - this.timeLeft) / totalPhase) * 100 : 0;
    this.progressEl.style.width = `${pct}%`;
    this.progressEl.style.background = isRound ? 'var(--red)' : 'var(--green)';

    this.currentEl.textContent = `${this.currentRound} / ${this.roundCount}`;
    this.totalEl.textContent = `${fmtTime(this.elapsed)} / ${fmtTime(this.totalDuration)}`;

    if (this.timeLeft <= 3 && this.timeLeft > 0) this.displayEl.classList.add('pulsing');
    else this.displayEl.classList.remove('pulsing');

    this.pauseBtn.textContent = this.engine.running ? 'Pause' : 'Resume';
    if (!this.engine.running) this.pauseBtn.classList.add('paused');
    else this.pauseBtn.classList.remove('paused');
  }

  finish() {
    this.engine.pause();
    playFinish();
    this.updateUI();
  }

  toggle() {
    this.engine.toggle();
    this.updateUI();
  }

  reset() {
    this.engine.pause();
    this.configEl.classList.remove('hidden');
    this.timerEl.classList.add('hidden');
    this.displayEl.classList.remove('pulsing');
    this.displayEl.style.color = '';
    this.pauseBtn.classList.remove('paused');
  }
}

// ================= TABATA =================
class TabataTimer {
  constructor() {
    this.engine = new TimerEngine(() => this.tick(), () => this.finish());
    this.workTime = 20;
    this.restTime = 10;
    this.rounds = 8;
    this.series = 1;
    this.seriesRest = 60;
    this.countdown = 0;
    this.timeLeft = 0;
    this.phase = 'ready';
    this.currentSeries = 1;
    this.currentRound = 1;

    this.phaseEl = document.getElementById('tabPhase');
    this.displayEl = document.getElementById('tabDisplay');
    this.progressEl = document.getElementById('tabProgress');
    this.roundEl = document.getElementById('tabRound');
    this.seriesEl = document.getElementById('tabSeriesDisplay');
    this.pauseBtn = document.getElementById('tabPauseBtn');
    this.configEl = document.getElementById('tabataConfig');
    this.timerEl = document.getElementById('tabataTimer');

    ['tabWorkMin','tabWorkSec','tabRestMin','tabRestSec','tabRounds','tabCountdown','tabRepeatCount','tabSeriesRestMin','tabSeriesRestSec'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateTotal());
    });
    document.getElementById('tabRepeatToggle')?.addEventListener('change', (e) => {
      document.getElementById('tabRepeatOptions').classList.toggle('hidden', !e.target.checked);
      if (!e.target.checked) document.getElementById('tabRepeatCount').value = 1;
      this.updateTotal();
    });
  }

  updateTotal() {
    const w = (parseInt(document.getElementById('tabWorkMin')?.value || 0) * 60) + parseInt(document.getElementById('tabWorkSec')?.value || 0);
    const r = (parseInt(document.getElementById('tabRestMin')?.value || 0) * 60) + parseInt(document.getElementById('tabRestSec')?.value || 0);
    const rounds = parseInt(document.getElementById('tabRounds')?.value || 1);
    const repeatOn = document.getElementById('tabRepeatToggle')?.checked || false;
    const count = repeatOn ? (parseInt(document.getElementById('tabRepeatCount')?.value || 1)) : 1;
    const sr = repeatOn ? ((parseInt(document.getElementById('tabSeriesRestMin')?.value || 0) * 60) + parseInt(document.getElementById('tabSeriesRestSec')?.value || 0)) : 0;
    const total = ((w + r) * rounds * count) + (sr * (count - 1));
    document.getElementById('tabTotal').textContent = `Total: ~${Math.ceil(total/60)} min`;
  }

  startFromConfig() {
    this.workTime = (parseInt(document.getElementById('tabWorkMin').value) * 60) + parseInt(document.getElementById('tabWorkSec').value);
    this.restTime = (parseInt(document.getElementById('tabRestMin').value) * 60) + parseInt(document.getElementById('tabRestSec').value);
    this.rounds = parseInt(document.getElementById('tabRounds').value);
    this.countdown = (document.getElementById('tabCountdownToggle')?.checked ? parseInt(document.getElementById('tabCountdownSec')?.value || 0) : 0);
    const repeatOn = document.getElementById('tabRepeatToggle')?.checked || false;
    this.series = repeatOn ? parseInt(document.getElementById('tabRepeatCount').value) : 1;
    this.seriesRest = repeatOn ? ((parseInt(document.getElementById('tabSeriesRestMin').value) * 60) + parseInt(document.getElementById('tabSeriesRestSec').value)) : 0;

    if (this.workTime <= 0) { alert('Work time must be > 0'); return; }

    this.configEl.classList.add('hidden');
    this.timerEl.classList.remove('hidden');

    if (this.countdown > 0) {
      this.phase = 'countdown';
      this.timeLeft = this.countdown;
      this.updateUI();
      this.engine.start();
    } else {
      this.currentSeries = 1;
      this.currentRound = 1;
      this.phase = 'work';
      this.timeLeft = this.workTime;
      this.updateUI();
      this.engine.start();
    }
  }

  tick() {
    this.timeLeft--;
    if (this.timeLeft <= 3 && this.timeLeft > 0) playTick();

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      if (this.phase === 'countdown') {
        this.currentSeries = 1;
        this.currentRound = 1;
        this.phase = 'work';
        this.timeLeft = this.workTime;
        playBell();
      } else {
        this.nextPhase();
      }
    }
    this.updateUI();
    return this.phase === 'done';
  }

  nextPhase() {
    if (this.phase === 'work') {
      this.phase = 'rest';
      this.timeLeft = this.restTime;
      playDing();
    } else if (this.phase === 'rest') {
      if (this.currentRound >= this.rounds) {
        if (this.currentSeries >= this.series) { this.phase = 'done'; return; }
        this.phase = 'seriesRest';
        this.timeLeft = this.seriesRest;
        this.currentSeries++;
        this.currentRound = 1;
        playBell();
      } else {
        this.currentRound++;
        this.phase = 'work';
        this.timeLeft = this.workTime;
        playDing();
      }
    } else if (this.phase === 'seriesRest') {
      this.phase = 'work';
      this.timeLeft = this.workTime;
      playBell();
    }
  }

  updateUI() {
    if (this.phase === 'done') {
      this.phaseEl.textContent = 'Done';
      this.phaseEl.className = 'phase-badge';
      this.displayEl.textContent = '00:00';
      this.displayEl.style.color = 'var(--yellow)';
      this.progressEl.style.width = '100%';
      this.progressEl.style.background = 'var(--yellow)';
      this.roundEl.textContent = '-';
      this.seriesEl.textContent = '-';
      this.pauseBtn.textContent = 'Start';
      this.pauseBtn.classList.remove('paused');
      this.displayEl.classList.remove('pulsing');
      return;
    }

    if (this.phase === 'countdown') {
      this.phaseEl.textContent = 'Get ready';
      this.phaseEl.className = 'phase-badge countdown';
      this.displayEl.textContent = this.timeLeft;
      this.displayEl.style.color = 'var(--yellow)';
      const pct = this.countdown > 0 ? ((this.countdown - this.timeLeft) / this.countdown) * 100 : 0;
      this.progressEl.style.width = `${pct}%`;
      this.progressEl.style.background = 'var(--yellow)';
      this.roundEl.textContent = '-';
      this.seriesEl.textContent = '-';
      this.displayEl.classList.add('pulsing');
      this.pauseBtn.textContent = 'Pause';
      this.pauseBtn.classList.remove('paused');
      return;
    }

    const isWork = this.phase === 'work';
    this.displayEl.textContent = fmtTime(this.timeLeft);
    this.phaseEl.textContent = isWork ? 'Work' : (this.phase === 'rest' ? 'Rest' : 'Cycle rest');
    this.phaseEl.className = 'phase-badge ' + (isWork ? 'effort' : 'rest');
    this.displayEl.style.color = '';

    const totalPhase = isWork ? this.workTime : (this.phase === 'rest' ? this.restTime : this.seriesRest);
    const pct = totalPhase > 0 ? ((totalPhase - this.timeLeft) / totalPhase) * 100 : 0;
    this.progressEl.style.width = `${pct}%`;
    this.progressEl.style.background = isWork ? 'var(--red)' : 'var(--green)';

    this.roundEl.textContent = `Round ${this.currentRound}/${this.rounds}`;
    this.seriesEl.textContent = `Cycle ${this.currentSeries}/${this.series}`;

    if (isWork && this.timeLeft <= 3 && this.timeLeft > 0) {
      this.displayEl.classList.add('pulsing');
    } else {
      this.displayEl.classList.remove('pulsing');
    }

    this.pauseBtn.textContent = this.engine.running ? 'Pause' : 'Resume';
    if (!this.engine.running && this.phase !== 'done') this.pauseBtn.classList.add('paused');
    else this.pauseBtn.classList.remove('paused');
  }

  finish() {
    this.engine.pause();
    playFinish();
    this.updateUI();
  }

  toggle() {
    this.engine.toggle();
    this.updateUI();
  }

  reset() {
    this.engine.pause();
    this.configEl.classList.remove('hidden');
    this.timerEl.classList.add('hidden');
    this.displayEl.classList.remove('pulsing');
    this.displayEl.style.color = '';
    this.pauseBtn.classList.remove('paused');
  }
}

// ================= EMOM =================
class EmomTimer {
  constructor() {
    this.engine = new TimerEngine(() => this.tick(), () => this.finish());
    this.minutes = 10;
    this.interval = 60;
    this.currentRound = 1;
    this.timeLeft = 60;
    this.countdown = 0;

    this.phaseEl = document.getElementById('emomPhase');
    this.displayEl = document.getElementById('emomDisplay');
    this.progressEl = document.getElementById('emomProgress');
    this.roundEl = document.getElementById('emomRound');
    this.totalEl = document.getElementById('emomTotalTime');
    this.pauseBtn = document.getElementById('emomPauseBtn');
    this.configEl = document.getElementById('emomConfig');
    this.timerEl = document.getElementById('emomTimer');

    document.getElementById('emomMinutes')?.addEventListener('input', () => {
      const m = parseInt(document.getElementById('emomMinutes').value) || 1;
      document.getElementById('emomTotal').textContent = `Total: ${m} min`;
    });
  }

  startFromConfig() {
    this.minutes = parseInt(document.getElementById('emomMinutes').value);
    if (this.minutes <= 0) { alert('At least 1 minute'); return; }
    this.totalTime = this.minutes * 60;
    this.countdown = (document.getElementById('emomCountdownToggle')?.checked ? parseInt(document.getElementById('emomCountdownSec')?.value || 0) : 0);

    this.configEl.classList.add('hidden');
    this.timerEl.classList.remove('hidden');

    if (this.countdown > 0) {
      this.phase = 'countdown';
      this.timeLeft = this.countdown;
      this.updateUI();
      this.engine.start();
    } else {
      this.currentRound = 1;
      this.timeLeft = this.interval;
      this.elapsedTotal = 0;
      this.updateUI();
      this.engine.start();
    }
  }

  tick() {
    this.timeLeft--;
    if (this.timeLeft <= 3 && this.timeLeft > 0) playTick();

    if (this.timeLeft <= 0) {
      if (this.phase === 'countdown') {
        this.currentRound = 1;
        this.timeLeft = this.interval;
        this.elapsedTotal = 0;
        this.phase = 'active';
        playBell();
      } else {
        this.currentRound++;
        if (this.currentRound > this.minutes) {
          this.timeLeft = 0;
          this.updateUI();
          return true;
        }
        this.timeLeft = this.interval;
        playDing();
      }
    } else {
      this.elapsedTotal++;
    }
    this.updateUI();
    return false;
  }

  updateUI() {
    const done = this.currentRound > this.minutes && this.phase !== 'countdown';
    if (done) {
      this.phaseEl.textContent = 'Done';
      this.phaseEl.className = 'phase-badge';
      this.displayEl.textContent = '00';
      this.displayEl.style.color = 'var(--yellow)';
      this.progressEl.style.width = '100%';
      this.progressEl.style.background = 'var(--yellow)';
      this.roundEl.textContent = '-';
      this.totalEl.textContent = '-';
      this.pauseBtn.textContent = 'Start';
      this.pauseBtn.classList.remove('paused');
      this.displayEl.classList.remove('pulsing');
      return;
    }

    if (this.phase === 'countdown') {
      this.phaseEl.textContent = 'Get ready';
      this.phaseEl.className = 'phase-badge countdown';
      this.displayEl.textContent = this.timeLeft;
      this.displayEl.style.color = 'var(--yellow)';
      const pct = this.countdown > 0 ? ((this.countdown - this.timeLeft) / this.countdown) * 100 : 0;
      this.progressEl.style.width = `${pct}%`;
      this.progressEl.style.background = 'var(--yellow)';
      this.roundEl.textContent = '-';
      this.totalEl.textContent = '-';
      this.displayEl.classList.add('pulsing');
      this.pauseBtn.textContent = 'Pause';
      this.pauseBtn.classList.remove('paused');
      return;
    }

    this.displayEl.textContent = this.timeLeft;
    this.phaseEl.textContent = `Round ${this.currentRound}`;
    this.phaseEl.className = 'phase-badge';
    this.displayEl.style.color = '';
    this.progressEl.style.width = `${((this.interval - this.timeLeft) / this.interval) * 100}%`;
    this.progressEl.style.background = 'var(--yellow)';
    this.roundEl.textContent = `${this.currentRound} / ${this.minutes}`;
    this.totalEl.textContent = `${fmtTime(this.elapsedTotal)} / ${fmtTime(this.totalTime)}`;

    if (this.timeLeft <= 3 && this.timeLeft > 0) this.displayEl.classList.add('pulsing');
    else this.displayEl.classList.remove('pulsing');

    this.pauseBtn.textContent = this.engine.running ? 'Pause' : 'Resume';
    if (!this.engine.running) this.pauseBtn.classList.add('paused');
    else this.pauseBtn.classList.remove('paused');
  }

  finish() {
    this.engine.pause();
    playFinish();
    this.updateUI();
  }

  toggle() {
    this.engine.toggle();
    this.updateUI();
  }

  reset() {
    this.engine.pause();
    this.configEl.classList.remove('hidden');
    this.timerEl.classList.add('hidden');
    this.displayEl.classList.remove('pulsing');
    this.displayEl.style.color = '';
    this.pauseBtn.classList.remove('paused');
  }
}

// ================= COMPLEX =================
class ComplexTimer {
  constructor() {
    this.engine = new TimerEngine(() => this.tick(), () => this.finish());
    this.steps = [];
    this.currentStep = 0;
    this.timeLeft = 0;
    this.totalDuration = 0;
    this.elapsed = 0;
    this.stepIdCounter = 1;
    this.countdown = 0;
    this.flatSteps = [];

    this.phaseEl = document.getElementById('complexPhase');
    this.displayEl = document.getElementById('complexDisplay');
    this.progressEl = document.getElementById('complexProgress');
    this.stepEl = document.getElementById('complexStep');
    this.totalEl = document.getElementById('complexTotalTime');
    this.nextEl = document.getElementById('complexNext');
    this.pauseBtn = document.getElementById('complexPauseBtn');
    this.timelineEl = document.getElementById('complexTimeline');
    this.listEl = document.getElementById('complexList');
    this.configEl = document.getElementById('complexConfig');
    this.timerEl = document.getElementById('complexTimer');

    this.renderList();
  }



  addGroup(data = {}) {
    const group = {
      id: this.stepIdCounter++,
      kind: 'group',
      name: data.name || 'Group',
      repeat: data.repeat || 1,
      steps: (data.steps || []).map((s, i) => ({
        id: this.stepIdCounter++,
        name: s.name || 'Step ' + i,
        type: s.type || 'work',
        duration: ((s.min || 0) * 60) + (s.sec || 30)
      }))
    };
    this.steps.push(group);
  }

  addStep(data = {}) {
    this.steps.push({
      id: this.stepIdCounter++,
      kind: 'step',
      name: data.name || 'Step ' + this.steps.length,
      type: data.type || 'work',
      duration: ((data.min || 0) * 60) + (data.sec || 30)
    });
  }

  addStepUI() {
    this.addStep({ name: 'New step', type: 'work', min: 0, sec: 30 });
    this.renderList();
  }

  addGroupUI() {
    this.addGroup({ name: 'New group', repeat: 2, steps: [
      { name: 'Work', type: 'work', min: 0, sec: 30 },
      { name: 'Rest', type: 'rest', min: 0, sec: 15 }
    ] });
    this.renderList();
  }

  removeItem(id) { this.steps = this.steps.filter(s => s.id !== id); this.renderList(); }

  moveItem(id, dir) {
    const i = this.steps.findIndex(s => s.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= this.steps.length) return;
    [this.steps[i], this.steps[j]] = [this.steps[j], this.steps[i]];
    this.renderList();
  }

  updateGroup(id, field, value) {
    const g = this.steps.find(x => x.id === id);
    if (!g || g.kind !== 'group') return;
    if (field === 'name') g.name = value;
    else if (field === 'repeat') g.repeat = Math.max(1, parseInt(value) || 1);
  }

  toggleGroup(id) {
    const el = document.getElementById(`group-body-${id}`);
    if (!el) return;
    el.classList.toggle('hidden');
  }

  addSubStep(groupId) {
    const g = this.steps.find(x => x.id === groupId);
    if (!g || g.kind !== 'group') return;
    g.steps.push({ id: this.stepIdCounter++, name: 'New step', type: 'work', duration: 30 });
    this.renderList();
    const el = document.getElementById(`group-body-${groupId}`);
    if (el) el.classList.remove('hidden');
  }

  removeSubStep(groupId, stepId) {
    const g = this.steps.find(x => x.id === groupId);
    if (!g || g.kind !== 'group') return;
    g.steps = g.steps.filter(s => s.id !== stepId);
    this.renderList();
  }

  moveSubStep(groupId, stepId, dir) {
    const g = this.steps.find(x => x.id === groupId);
    if (!g || g.kind !== 'group') return;
    const i = g.steps.findIndex(s => s.id === stepId);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= g.steps.length) return;
    [g.steps[i], g.steps[j]] = [g.steps[j], g.steps[i]];
    this.renderList();
  }

  updateSubStep(groupId, stepId, field, value) {
    let s;
    if (groupId === 0) {
      // root step
      s = this.steps.find(x => x.id === stepId);
    } else {
      const g = this.steps.find(x => x.id === groupId);
      if (!g || g.kind !== 'group') return;
      s = g.steps.find(x => x.id === stepId);
    }
    if (!s) return;
    if (field === 'name') s.name = value;
    else if (field === 'type') s.type = value;
    else if (field === 'min') s.duration = (parseInt(value) || 0) * 60 + (s.duration % 60);
    else if (field === 'sec') {
      const v = Math.min(59, Math.max(0, parseInt(value) || 0));
      s.duration = Math.floor(s.duration / 60) * 60 + v;
    }
    if (field === 'type') this.renderList();
  }

  clearAll() { this.steps = []; this.stepIdCounter = 1; this.renderList(); }

  computeItems() {
    const items = [];
    this.steps.forEach(s => {
      if (s.kind === 'group') {
        for (let r = 0; r < s.repeat; r++) {
          s.steps.forEach(sub => items.push({ ...sub }));
        }
      } else {
        items.push({ ...s });
      }
    });
    return items;
  }

  renderList() {
    this.listEl.innerHTML = '';
    this.steps.forEach((s) => {
      if (s.kind === 'group') {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group-card';
        groupDiv.dataset.itemId = s.id;
        const totalDur = s.steps.reduce((a, st) => a + st.duration, 0);
        const itemCount = s.steps.length * s.repeat;
        const durStr = fmtTime(totalDur * s.repeat);
        groupDiv.innerHTML = `
          <div class="group-card-header" onclick="app.complex.toggleGroup(${s.id})">
            <input type="text" class="group-name" value="${s.name}" onclick="event.stopPropagation()" onchange="app.complex.updateGroup(${s.id}, 'name', this.value)">
            <span class="group-tag">Repeat ${s.repeat}x</span>
            <span class="group-summary">${itemCount} steps · ${durStr}</span>
            <div class="group-actions" onclick="event.stopPropagation()">
              <button class="step-action-btn" onclick="app.complex.moveItem(${s.id}, -1)">&#8593;</button>
              <button class="step-action-btn" onclick="app.complex.moveItem(${s.id}, 1)">&#8595;</button>
              <button class="step-action-btn del" onclick="app.complex.removeItem(${s.id})">&#10005;</button>
            </div>
          </div>
          <div class="group-card-body" id="group-body-${s.id}">
            ${s.steps.map(sub => {
              const mins = Math.floor(sub.duration / 60);
              const secs = sub.duration % 60;
              return `
                <div class="step-card ${sub.type === 'work' ? 'step-work' : 'step-rest'}">
                  <div class="step-card-header">
                    <input type="text" value="${sub.name}" onchange="app.complex.updateSubStep(${s.id}, ${sub.id}, 'name', this.value)">
                    <select class="step-type-select" onchange="app.complex.updateSubStep(${s.id}, ${sub.id}, 'type', this.value)">
                      <option value="work" ${sub.type === 'work' ? 'selected' : ''}>Work</option>
                      <option value="rest" ${sub.type === 'rest' ? 'selected' : ''}>Rest</option>
                    </select>
                    <div class="step-actions">
                      <button class="step-action-btn" onclick="app.complex.moveSubStep(${s.id}, ${sub.id}, -1)">&#8593;</button>
                      <button class="step-action-btn" onclick="app.complex.moveSubStep(${s.id}, ${sub.id}, 1)">&#8595;</button>
                      <button class="step-action-btn del" onclick="app.complex.removeSubStep(${s.id}, ${sub.id})">&#10005;</button>
                    </div>
                  </div>
                  <div class="step-card-body">
                    <div><label>Min</label><input type="number" value="${mins}" min="0" onchange="app.complex.updateSubStep(${s.id}, ${sub.id}, 'min', this.value)"></div>
                    <div><label>Sec</label><input type="number" value="${secs}" min="0" max="59" onchange="app.complex.updateSubStep(${s.id}, ${sub.id}, 'sec', this.value)"></div>
                  </div>
                </div>
              `;
            }).join('')}
            <button class="btn-add-step" onclick="app.complex.addSubStep(${s.id})" style="margin-top:4px;">+ Add a step</button>
            <div class="group-repeat-row">
              <label>Repeat</label>
              <input type="number" value="${s.repeat}" min="1" max="99" onchange="app.complex.updateGroup(${s.id}, 'repeat', this.value)">
            </div>
          </div>
        `;
        this.listEl.appendChild(groupDiv);
      } else {
        const mins = Math.floor(s.duration / 60);
        const secs = s.duration % 60;
        const div = document.createElement('div');
        div.className = `step-card ${s.type === 'work' ? 'step-work' : 'step-rest'}`;
        div.dataset.itemId = s.id;
        div.innerHTML = `
          <div class="step-card-header">
            <input type="text" value="${s.name}" onchange="app.complex.updateSubStep(0, ${s.id}, 'name', this.value)">
            <select class="step-type-select" onchange="app.complex.updateSubStep(0, ${s.id}, 'type', this.value)">
              <option value="work" ${s.type === 'work' ? 'selected' : ''}>Work</option>
              <option value="rest" ${s.type === 'rest' ? 'selected' : ''}>Rest</option>
            </select>
            <div class="step-actions" style="margin-left:auto;">
              <button class="step-action-btn" onclick="app.complex.moveItem(${s.id}, -1)">&#8593;</button>
              <button class="step-action-btn" onclick="app.complex.moveItem(${s.id}, 1)">&#8595;</button>
              <button class="step-action-btn del" onclick="app.complex.removeItem(${s.id})">&#10005;</button>
            </div>
          </div>
          <div class="step-card-body">
            <div><label>Min</label><input type="number" value="${mins}" min="0" onchange="app.complex.updateSubStep(0, ${s.id}, 'min', this.value)"></div>
            <div><label>Sec</label><input type="number" value="${secs}" min="0" max="59" onchange="app.complex.updateSubStep(0, ${s.id}, 'sec', this.value)"></div>
          </div>
        `;
        this.listEl.appendChild(div);
      }
    });
  }

  renderTimeline() {
    const list = (this.flatSteps && this.flatSteps.length > 0) ? this.flatSteps : this.steps;
    this.timelineEl.innerHTML = '';
    list.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      if (idx === this.currentStep) item.classList.add('active');
      if (s.type === 'work' && idx === this.currentStep) item.classList.add('effort');
      if (idx < this.currentStep) item.classList.add('done');
      const label = s.name.length > 8 ? s.name.slice(0, 8) + '...' : s.name;
      item.innerHTML = `<span>${label}</span><span class="tl-dur">${fmtTime(s.duration)}</span>`;
      this.timelineEl.appendChild(item);
    });
    const active = this.timelineEl.querySelector('.active');
    if (active) active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  startFromConfig() {
    this.flatSteps = this.computeItems();
    if (this.flatSteps.length === 0) { alert('Add at least one step'); return; }
    this.countdown = (document.getElementById('complexCountdownToggle')?.checked ? parseInt(document.getElementById('complexCountdownSec')?.value || 0) : 0);
    this.currentStep = 0;
    this.elapsed = 0;
    this.totalDuration = this.flatSteps.reduce((a, s) => a + s.duration, 0);

    this.configEl.classList.add('hidden');
    this.timerEl.classList.remove('hidden');

    if (this.countdown > 0) {
      this.phase = 'countdown';
      this.timeLeft = this.countdown;
      this.updateUI();
      this.engine.start();
    } else {
      this.timeLeft = this.flatSteps[0]?.duration || 0;
      this.updateUI();
      this.engine.start();
    }
  }

  tick() {
    this.timeLeft--;
    if (this.timeLeft <= 3 && this.timeLeft > 0) playTick();

    if (this.timeLeft <= 0) {
      if (this.phase === 'countdown') {
        this.phase = 'active';
        this.currentStep = 0;
        this.timeLeft = this.flatSteps[0]?.duration || 0;
        this.elapsed = 0;
        playBell();
      } else {
        this.currentStep++;
        if (this.currentStep >= this.flatSteps.length) { this.timeLeft = 0; this.updateUI(); return true; }
        this.timeLeft = this.flatSteps[this.currentStep].duration;
        playDing();
      }
    } else {
      if (this.phase !== 'countdown') this.elapsed++;
    }
    this.updateUI();
    return false;
  }

  updateUI() {
    const done = this.currentStep >= this.flatSteps.length;
    if (done) {
      this.phaseEl.textContent = 'Done';
      this.phaseEl.className = 'phase-badge';
      this.displayEl.textContent = '00:00';
      this.displayEl.style.color = 'var(--yellow)';
      this.progressEl.style.width = '100%';
      this.progressEl.style.background = 'var(--yellow)';
      this.stepEl.textContent = '-';
      this.totalEl.textContent = '-';
      this.nextEl.textContent = '';
      this.pauseBtn.textContent = 'Start';
      this.pauseBtn.classList.remove('paused');
      this.renderTimeline();
      return;
    }

    if (this.phase === 'countdown') {
      this.phaseEl.textContent = 'Get ready';
      this.phaseEl.className = 'phase-badge countdown';
      this.displayEl.textContent = this.timeLeft;
      this.displayEl.style.color = 'var(--yellow)';
      const pct = this.countdown > 0 ? ((this.countdown - this.timeLeft) / this.countdown) * 100 : 0;
      this.progressEl.style.width = `${pct}%`;
      this.progressEl.style.background = 'var(--yellow)';
      this.stepEl.textContent = '-';
      this.totalEl.textContent = '-';
      this.nextEl.textContent = '';
      this.displayEl.classList.add('pulsing');
      this.pauseBtn.textContent = 'Pause';
      this.pauseBtn.classList.remove('paused');
      this.renderTimeline();
      return;
    }

    const step = this.flatSteps[this.currentStep];
    const nextStep = this.flatSteps[this.currentStep + 1];

    this.displayEl.textContent = fmtTime(this.timeLeft);
    this.phaseEl.textContent = step.name;
    this.phaseEl.className = 'phase-badge ' + (step.type === 'work' ? 'effort' : 'rest');
    this.displayEl.style.color = '';

    const pct = step.duration > 0 ? ((step.duration - this.timeLeft) / step.duration) * 100 : 0;
    this.progressEl.style.width = `${pct}%`;
    this.progressEl.style.background = step.type === 'work' ? 'var(--red)' : 'var(--green)';

    this.stepEl.textContent = `Step ${this.currentStep + 1} / ${this.flatSteps.length}`;
    this.totalEl.textContent = `${fmtTime(this.elapsed)} / ${fmtTime(this.totalDuration)}`;
    this.nextEl.textContent = nextStep ? `Up next: ${nextStep.name} (${fmtTime(nextStep.duration)})` : '';

    if (this.timeLeft <= 3 && this.timeLeft > 0) this.displayEl.classList.add('pulsing');
    else this.displayEl.classList.remove('pulsing');

    this.pauseBtn.textContent = this.engine.running ? 'Pause' : 'Resume';
    if (!this.engine.running) this.pauseBtn.classList.add('paused');
    else this.pauseBtn.classList.remove('paused');

    this.renderTimeline();
  }

  finish() { this.engine.pause(); playFinish(); this.updateUI(); }
  toggle() { this.engine.toggle(); this.updateUI(); }

  reset() {
    this.engine.pause();
    this.configEl.classList.remove('hidden');
    this.timerEl.classList.add('hidden');
    this.displayEl.classList.remove('pulsing');
    this.displayEl.style.color = '';
    this.pauseBtn.classList.remove('paused');
  }
}

// ================= APP =================
class App {
  constructor() {
    this.chrono = new StopwatchTimer();
    this.countdown = new CountdownTimer();
    this.round = new RoundTimer();
    this.tabata = new TabataTimer();
    this.emom = new EmomTimer();
    this.complex = new ComplexTimer();
  }

  openMode(mode) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`${mode}View`).classList.add('active');
    document.getElementById('mainHeader').classList.remove('hidden');
    const titles = { chrono: 'Stopwatch', countdown: 'Countdown', round: 'Rounds', tabata: 'Tabata', emom: 'EMOM', complex: 'Complex' };
    document.getElementById('navTitle').textContent = titles[mode] || 'Timer';
  }

  goHome() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('homeView').classList.add('active');
    document.getElementById('mainHeader').classList.add('hidden');
  }

  toggleMenu() {
    const drawer = document.getElementById('menuDrawer');
    const burger = document.getElementById('homeBurger');
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.remove('open');
      burger.classList.remove('open');
      burger.setAttribute('aria-label', 'Menu');
    } else {
      drawer.classList.add('open');
      burger.classList.add('open');
      burger.setAttribute('aria-label', 'Close menu');
    }
  }

  toggleTheme() {
    const html = document.documentElement;
    const toggle = document.getElementById('darkModeToggle');
    const metaTheme = document.getElementById('themeColor');
    const isDark = toggle?.checked ?? true;

    if (isDark) {
      html.removeAttribute('data-theme');
      metaTheme?.setAttribute('content', '#000000');
    } else {
      html.setAttribute('data-theme', 'light');
      metaTheme?.setAttribute('content', '#ffffff');
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  initTheme() {
    const saved = localStorage.getItem('theme');
    const toggle = document.getElementById('darkModeToggle');
    const metaTheme = document.getElementById('themeColor');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (toggle) toggle.checked = false;
      metaTheme?.setAttribute('content', '#ffffff');
    }
  }
}

const app = new App();
