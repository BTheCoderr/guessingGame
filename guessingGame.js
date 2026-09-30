(() => {
  const STORAGE_KEY = 'guess-arcade-v2';
  const MODES = {
    classic: { label: 'Classic', startMax: 25, timed: false, hints: 3, subtitle: 'Find the target and build your score.' },
    sprint: { label: 'Sprint', startMax: 50, timed: true, seconds: 60, hints: 2, subtitle: 'Solve as many rounds as you can before time runs out.' },
    survival: { label: 'Survival', startMax: 40, timed: false, hints: 1, lives: 3, subtitle: 'Miss too many times and the run is over.' },
    endless: { label: 'Endless', startMax: 20, timed: false, hints: 3, subtitle: 'No finish line. Every win pushes the range higher.' },
    daily: { label: 'Daily', startMax: 100, timed: false, hints: 0, dailyAttempts: 7, subtitle: 'One date-seeded puzzle. Seven attempts.' }
  };

  const ACHIEVEMENTS = [
    { id: 'first-win', icon: '✓', name: 'First Hit', description: 'Win your first game.', test: s => s.wins >= 1 },
    { id: 'sharp', icon: '⌖', name: 'Sharpshooter', description: 'Solve a round in 3 guesses.', test: s => s.bestAttempts > 0 && s.bestAttempts <= 3 },
    { id: 'speed', icon: '⚡', name: 'Quick Read', description: 'Solve a round in under 10 seconds.', test: s => s.fastestWinMs > 0 && s.fastestWinMs < 10000 },
    { id: 'streak', icon: '↗', name: 'On Fire', description: 'Reach a 3-game win streak.', test: s => s.bestStreak >= 3 },
    { id: 'score', icon: '★', name: 'High Roller', description: 'Score 500+ in one run.', test: s => s.bestScore >= 500 },
    { id: 'daily', icon: '◫', name: 'Daily Mind', description: 'Complete a daily challenge.', test: s => s.dailyCompleted >= 1 }
  ];

  const defaultState = () => ({
    version: 2,
    stats: {
      gamesPlayed: 0,
      wins: 0,
      bestScore: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalGuesses: 0,
      fastestWinMs: 0,
      bestAttempts: 0,
      dailyCompleted: 0
    },
    history: [],
    unlocked: [],
    daily: {},
    settings: {
      theme: 'dark',
      sound: true,
      haptics: true
    }
  });

  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || typeof saved !== 'object') return defaultState();
      const base = defaultState();
      return {
        ...base,
        ...saved,
        stats: { ...base.stats, ...(saved.stats || {}) },
        settings: { ...base.settings, ...(saved.settings || {}) },
        history: Array.isArray(saved.history) ? saved.history : [],
        unlocked: Array.isArray(saved.unlocked) ? saved.unlocked : [],
        daily: saved.daily && typeof saved.daily === 'object' ? saved.daily : {}
      };
    } catch {
      return defaultState();
    }
  };

  let persistent = loadState();
  let session = {};
  let timerId = null;
  let deferredInstallPrompt = null;
  let toastTimer = null;

  const $ = id => document.getElementById(id);
  const els = {
    form: $('guess-form'),
    input: $('guess-input'),
    guessButton: $('guess-button'),
    modeKicker: $('mode-kicker'),
    modeTitle: $('mode-title'),
    modeDescription: $('mode-description'),
    rangePill: $('range-pill'),
    rangeCopy: $('range-copy'),
    signalCard: $('signal-card'),
    signalOrb: $('signal-orb'),
    signalLabel: $('signal-label'),
    signalText: $('signal-text'),
    meterFill: $('meter-fill'),
    score: $('score-value'),
    attempts: $('attempts-value'),
    timerLabel: $('timer-label'),
    timer: $('timer-value'),
    resourceLabel: $('resource-label'),
    resource: $('resource-value'),
    hintButton: $('hint-button'),
    hintsLeft: $('hints-left'),
    guessHistory: $('guess-history'),
    resultActions: $('result-actions'),
    nextButton: $('next-button'),
    shareButton: $('share-button'),
    newGameButton: $('new-game-button'),
    dailyDate: $('daily-date'),
    dailyStatus: $('daily-status'),
    playDailyButton: $('play-daily-button'),
    achievementList: $('achievement-list'),
    achievementCount: $('achievement-count'),
    heroBestScore: $('hero-best-score'),
    heroStreak: $('hero-streak'),
    heroGames: $('hero-games'),
    statsDialog: $('stats-dialog'),
    settingsDialog: $('settings-dialog'),
    statsGrid: $('stats-grid'),
    gameHistory: $('game-history'),
    soundToggle: $('sound-toggle'),
    hapticsToggle: $('haptics-toggle'),
    themeSelect: $('theme-select'),
    themeToggle: $('theme-toggle'),
    exportButton: $('export-button'),
    importInput: $('import-input'),
    resetDataButton: $('reset-data-button'),
    installButton: $('install-button'),
    toast: $('toast')
  };

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(persistent));
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const seededDailyTarget = dateString => {
    let hash = 2166136261;
    for (const ch of dateString) {
      hash ^= ch.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (Math.abs(hash) % 100) + 1;
  };

  const formatTime = ms => {
    if (!ms || ms < 0) return '—';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2,'0')}`;
  };

  const toast = message => {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  };

  const feedback = type => {
    if (persistent.settings.haptics && navigator.vibrate) {
      navigator.vibrate(type === 'win' ? [35, 30, 55] : type === 'miss' ? 25 : 15);
    }
    if (!persistent.settings.sound) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = type === 'win' ? 740 : type === 'miss' ? 180 : 420;
      gain.gain.setValueAtTime(.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .12);
      osc.start();
      osc.stop(ctx.currentTime + .12);
    } catch {}
  };

  const applyTheme = () => {
    let theme = persistent.settings.theme;
    if (theme === 'system') theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    els.themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#07111f' : '#eff5f1');
  };

  const getModeConfig = () => MODES[session.mode] || MODES.classic;

  const newSession = (mode = 'classic') => {
    stopTimer();
    const config = MODES[mode];
    const dailyRecord = persistent.daily[todayKey()];
    session = {
      mode,
      level: 1,
      max: config.startMax,
      target: mode === 'daily' ? seededDailyTarget(todayKey()) : randomTarget(config.startMax),
      score: 0,
      attempts: 0,
      roundAttempts: 0,
      hintsLeft: config.hints,
      lives: config.lives || 0,
      startedAt: 0,
      roundStartedAt: Date.now(),
      timeRemaining: config.seconds || 0,
      completed: false,
      runFinished: false,
      guesses: [],
      dailyLocked: mode === 'daily' && !!dailyRecord?.completed
    };
    setActiveMode(mode);
    renderAll();
    if (session.dailyLocked) {
      const won = dailyRecord.won;
      showSignal(won ? 'Daily complete' : 'Daily finished', won ? 'You already solved today’s challenge.' : `Today’s answer was ${dailyRecord.target}.`, won ? '✓' : '•', 100);
      lockRound();
    } else {
      els.input.focus({ preventScroll: true });
    }
  };

  const randomTarget = max => Math.floor(Math.random() * max) + 1;

  const setActiveMode = mode => {
    document.querySelectorAll('.mode-card').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  };

  const startClockIfNeeded = () => {
    const config = getModeConfig();
    if (session.startedAt) return;
    session.startedAt = Date.now();
    session.roundStartedAt = Date.now();
    if (config.timed) {
      timerId = setInterval(() => {
        session.timeRemaining -= 1;
        if (session.timeRemaining <= 0) {
          session.timeRemaining = 0;
          renderMetrics();
          finishRun(false, `Time. Final score: ${session.score}.`);
          return;
        }
        renderMetrics();
      }, 1000);
    } else {
      timerId = setInterval(renderMetrics, 1000);
    }
  };

  const stopTimer = () => {
    if (timerId) clearInterval(timerId);
    timerId = null;
  };

  const roundElapsed = () => Date.now() - session.roundStartedAt;

  const submitGuess = raw => {
    if (session.completed || session.runFinished || session.dailyLocked) return;
    const guess = Number(raw);
    if (!Number.isInteger(guess) || guess < 1 || guess > session.max) {
      toast(`Enter a whole number from 1 to ${session.max}.`);
      return;
    }

    startClockIfNeeded();
    session.attempts += 1;
    session.roundAttempts += 1;
    persistent.stats.totalGuesses += 1;

    const delta = guess - session.target;
    const distance = Math.abs(delta);
    const closeness = Math.max(0, 100 - (distance / session.max) * 180);
    const direction = delta === 0 ? 'correct' : delta > 0 ? 'lower' : 'higher';
    session.guesses.unshift({ value: guess, direction, distance, closeness });
    session.guesses = session.guesses.slice(0, 8);

    if (delta === 0) {
      handleWin(closeness);
    } else {
      feedback('miss');
      const descriptor = closeness >= 75 ? 'Burning hot' : closeness >= 48 ? 'Warm' : closeness >= 24 ? 'Cool' : 'Cold';
      showSignal(direction === 'higher' ? 'Go higher' : 'Go lower', `${descriptor}. ${guess} is ${direction === 'higher' ? 'below' : 'above'} the target.`, direction === 'higher' ? '↑' : '↓', closeness);

      if (session.mode === 'survival' && session.roundAttempts % 4 === 0) {
        session.lives -= 1;
        if (session.lives <= 0) {
          finishRun(false, `Run over. The number was ${session.target}.`);
        } else {
          toast(`Life lost. ${session.lives} ${session.lives === 1 ? 'life' : 'lives'} left.`);
        }
      }

      if (session.mode === 'daily' && session.roundAttempts >= MODES.daily.dailyAttempts) {
        persistent.daily[todayKey()] = { completed: true, won: false, target: session.target, attempts: session.roundAttempts, date: todayKey() };
        persistent.stats.dailyCompleted += 1;
        finishRun(false, `Daily finished. The number was ${session.target}.`);
      }
    }

    save();
    evaluateAchievements();
    renderAll();
    els.input.value = '';
    if (!session.completed && !session.runFinished) els.input.focus({ preventScroll: true });
  };

  const handleWin = () => {
    feedback('win');
    const elapsed = roundElapsed();
    const base = Math.max(30, 145 - session.roundAttempts * 9);
    const levelBonus = session.level * 12;
    const speedBonus = Math.max(0, 40 - Math.floor(elapsed / 1000));
    const gain = base + levelBonus + speedBonus;
    session.score += gain;
    session.completed = true;

    persistent.stats.wins += 1;
    persistent.stats.currentStreak += 1;
    persistent.stats.bestStreak = Math.max(persistent.stats.bestStreak, persistent.stats.currentStreak);
    persistent.stats.fastestWinMs = persistent.stats.fastestWinMs === 0 ? elapsed : Math.min(persistent.stats.fastestWinMs, elapsed);
    persistent.stats.bestAttempts = persistent.stats.bestAttempts === 0 ? session.roundAttempts : Math.min(persistent.stats.bestAttempts, session.roundAttempts);

    showSignal('Correct', `That was it. +${gain} points.`, '✓', 100);

    if (session.mode === 'daily') {
      persistent.daily[todayKey()] = { completed: true, won: true, target: session.target, attempts: session.roundAttempts, date: todayKey() };
      persistent.stats.dailyCompleted += 1;
      finishRun(true, `Daily solved in ${session.roundAttempts} ${session.roundAttempts === 1 ? 'guess' : 'guesses'}.`);
      return;
    }

    if (session.mode === 'sprint') {
      setTimeout(() => nextRound(), 650);
    } else {
      els.resultActions.classList.remove('hidden');
    }

    save();
    evaluateAchievements();
  };

  const nextRound = () => {
    if (session.runFinished) return;
    session.completed = false;
    session.level += 1;
    session.roundAttempts = 0;
    session.guesses = [];
    session.hintsLeft = getModeConfig().hints;
    session.max = Math.min(100000, Math.ceil(session.max * (session.mode === 'classic' ? 1.6 : session.mode === 'endless' ? 1.8 : 1.35)));
    session.target = randomTarget(session.max);
    session.roundStartedAt = Date.now();
    els.resultActions.classList.add('hidden');
    showSignal('New target', 'The signal reset. Read it again.', '?', 0);
    renderAll();
    els.input.focus({ preventScroll: true });
  };

  const finishRun = (won, message) => {
    if (session.runFinished) return;
    session.runFinished = true;
    session.completed = true;
    stopTimer();
    persistent.stats.gamesPlayed += 1;
    if (!won && session.mode !== 'sprint' && session.mode !== 'daily') persistent.stats.currentStreak = 0;
    persistent.stats.bestScore = Math.max(persistent.stats.bestScore, session.score);

    persistent.history.unshift({
      date: new Date().toISOString(),
      mode: session.mode,
      score: session.score,
      level: session.level,
      attempts: session.attempts,
      won
    });
    persistent.history = persistent.history.slice(0, 20);
    save();
    evaluateAchievements();

    showSignal(won ? 'Run complete' : 'Game over', message, won ? '✓' : '×', won ? 100 : 0);
    els.resultActions.classList.remove('hidden');
    els.nextButton.textContent = 'Play again';
    renderAll();
  };

  const endCurrentRunForRestart = () => {
    if (session.startedAt && !session.runFinished && session.mode !== 'daily') {
      persistent.stats.gamesPlayed += 1;
      persistent.stats.currentStreak = 0;
      persistent.stats.bestScore = Math.max(persistent.stats.bestScore, session.score);
      persistent.history.unshift({
        date: new Date().toISOString(),
        mode: session.mode,
        score: session.score,
        level: session.level,
        attempts: session.attempts,
        won: false
      });
      persistent.history = persistent.history.slice(0, 20);
      save();
    }
  };

  const useHint = () => {
    if (session.completed || session.runFinished || session.dailyLocked) return;
    if (session.hintsLeft <= 0) {
      toast('No hints left this round.');
      return;
    }
    startClockIfNeeded();
    session.hintsLeft -= 1;
    const spread = Math.max(2, Math.ceil(session.max * .12));
    const low = Math.max(1, session.target - spread);
    const high = Math.min(session.max, session.target + spread);
    showSignal('Hint', `The target sits between ${low} and ${high}.`, '≈', 55);
    feedback('hint');
    renderMetrics();
  };

  const showSignal = (label, text, orb, meter) => {
    els.signalLabel.textContent = label;
    els.signalText.textContent = text;
    els.signalOrb.textContent = orb;
    els.meterFill.style.width = `${Math.max(0, Math.min(100, meter))}%`;
  };

  const lockRound = () => {
    els.input.disabled = true;
    els.guessButton.disabled = true;
    els.hintButton.disabled = true;
  };

  const unlockRound = () => {
    els.input.disabled = false;
    els.guessButton.disabled = false;
    els.hintButton.disabled = false;
  };

  const renderAll = () => {
    renderGame();
    renderMetrics();
    renderGuessHistory();
    renderPersistent();
    renderDaily();
  };

  const renderGame = () => {
    const config = getModeConfig();
    els.modeKicker.textContent = `${config.label.toUpperCase()} MODE`;
    els.modeTitle.textContent = session.mode === 'daily' ? 'Today’s puzzle' : `Level ${session.level}`;
    els.modeDescription.textContent = config.subtitle;
    els.rangePill.textContent = `1–${session.max.toLocaleString()}`;
    els.rangeCopy.textContent = `Choose a number from 1 to ${session.max.toLocaleString()}.`;
    els.input.min = '1';
    els.input.max = String(session.max);
    els.hintsLeft.textContent = `(${session.hintsLeft})`;

    if (!session.completed && !session.runFinished && !session.dailyLocked) unlockRound();
    else lockRound();

    els.nextButton.textContent = session.runFinished ? 'Play again' : 'Next round';
    if (!session.completed) els.resultActions.classList.add('hidden');
  };

  const renderMetrics = () => {
    els.score.textContent = session.score.toLocaleString();
    els.attempts.textContent = session.attempts.toLocaleString();

    if (session.mode === 'sprint') {
      els.timerLabel.textContent = 'Time left';
      els.timer.textContent = `${session.timeRemaining}s`;
    } else {
      els.timerLabel.textContent = 'Time';
      els.timer.textContent = session.startedAt ? formatTime(Date.now() - session.startedAt) : '—';
    }

    if (session.mode === 'survival') {
      els.resourceLabel.textContent = 'Lives';
      els.resource.textContent = '♥'.repeat(Math.max(0, session.lives)) || '0';
    } else if (session.mode === 'daily') {
      els.resourceLabel.textContent = 'Tries left';
      els.resource.textContent = Math.max(0, MODES.daily.dailyAttempts - session.roundAttempts);
    } else {
      els.resourceLabel.textContent = 'Hints';
      els.resource.textContent = session.hintsLeft;
    }

    els.hintButton.classList.toggle('hidden', session.mode === 'daily');
  };

  const renderGuessHistory = () => {
    if (!session.guesses.length) {
      els.guessHistory.innerHTML = '<li class="empty-state">Your guesses will show up here.</li>';
      return;
    }
    els.guessHistory.innerHTML = session.guesses.map(g => `
      <li>
        <span class="guess-number">${g.value}</span>
        <span class="guess-direction">${g.direction === 'correct' ? 'Target found' : `Go ${g.direction}`}</span>
        <span class="guess-distance">${g.direction === 'correct' ? 'hit' : g.closeness >= 70 ? 'hot' : g.closeness >= 40 ? 'warm' : 'cold'}</span>
      </li>
    `).join('');
  };

  const renderPersistent = () => {
    els.heroBestScore.textContent = persistent.stats.bestScore.toLocaleString();
    els.heroStreak.textContent = persistent.stats.currentStreak;
    els.heroGames.textContent = persistent.stats.gamesPlayed;
    renderAchievements();
  };

  const renderDaily = () => {
    const key = todayKey();
    const record = persistent.daily[key];
    els.dailyDate.textContent = new Date().toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    els.dailyStatus.textContent = record?.completed ? (record.won ? 'Solved' : 'Finished') : 'Ready';
    els.dailyStatus.classList.toggle('done', !!record?.completed);
    els.playDailyButton.textContent = record?.completed ? 'View daily' : 'Play daily';
  };

  const renderAchievements = () => {
    els.achievementList.innerHTML = ACHIEVEMENTS.map(a => `
      <div class="achievement ${persistent.unlocked.includes(a.id) ? 'unlocked' : ''}">
        <span class="achievement-badge">${a.icon}</span>
        <span><strong>${a.name}</strong><small>${a.description}</small></span>
      </div>
    `).join('');
    els.achievementCount.textContent = `${persistent.unlocked.length}/${ACHIEVEMENTS.length}`;
  };

  const evaluateAchievements = () => {
    let changed = false;
    for (const achievement of ACHIEVEMENTS) {
      if (!persistent.unlocked.includes(achievement.id) && achievement.test(persistent.stats)) {
        persistent.unlocked.push(achievement.id);
        changed = true;
        toast(`Achievement unlocked: ${achievement.name}`);
      }
    }
    if (changed) save();
  };

  const openStats = () => {
    const s = persistent.stats;
    const accuracy = s.totalGuesses ? Math.round((s.wins / s.totalGuesses) * 100) : 0;
    const items = [
      ['Games', s.gamesPlayed],
      ['Wins', s.wins],
      ['Best score', s.bestScore.toLocaleString()],
      ['Best streak', s.bestStreak],
      ['Best guesses', s.bestAttempts || '—'],
      ['Fastest round', formatTime(s.fastestWinMs)],
      ['Total guesses', s.totalGuesses.toLocaleString()],
      ['Win/guess rate', `${accuracy}%`],
      ['Daily clears', s.dailyCompleted]
    ];
    els.statsGrid.innerHTML = items.map(([label,value]) => `<div class="stat-tile"><span>${label}</span><strong>${value}</strong></div>`).join('');

    els.gameHistory.innerHTML = persistent.history.length
      ? persistent.history.slice(0,8).map(item => `
        <div class="game-history-row">
          <strong>${MODES[item.mode]?.label || item.mode} · ${item.score} pts</strong>
          <span>${new Date(item.date).toLocaleDateString()} · L${item.level}</span>
        </div>
      `).join('')
      : '<p class="empty-state">No completed runs yet.</p>';
    els.statsDialog.showModal();
  };

  const openSettings = () => {
    els.soundToggle.checked = persistent.settings.sound;
    els.hapticsToggle.checked = persistent.settings.haptics;
    els.themeSelect.value = persistent.settings.theme;
    els.settingsDialog.showModal();
  };

  const shareResult = async () => {
    const text = session.mode === 'daily'
      ? `Guess Arcade Daily ${todayKey()} — ${session.roundAttempts}/${MODES.daily.dailyAttempts} guesses.`
      : `Guess Arcade ${MODES[session.mode].label} — ${session.score} points, level ${session.level}.`;
    try {
      if (navigator.share) await navigator.share({ title:'Guess Arcade', text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Result copied.');
      }
    } catch {}
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(persistent, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guess-arcade-backup-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const importData = async file => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !parsed.stats || !parsed.settings) throw new Error('invalid');
      const base = defaultState();
      persistent = {
        ...base,
        ...parsed,
        stats: { ...base.stats, ...parsed.stats },
        settings: { ...base.settings, ...parsed.settings },
        history: Array.isArray(parsed.history) ? parsed.history.slice(0,20) : [],
        unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked.filter(id => ACHIEVEMENTS.some(a => a.id === id)) : [],
        daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {}
      };
      save();
      applyTheme();
      newSession(session.mode || 'classic');
      toast('Backup imported.');
    } catch {
      toast('That backup file could not be imported.');
    } finally {
      els.importInput.value = '';
    }
  };

  const resetData = () => {
    const okay = confirm('Reset all local stats, achievements, settings, and daily history?');
    if (!okay) return;
    persistent = defaultState();
    save();
    applyTheme();
    newSession('classic');
    els.settingsDialog.close();
    toast('Local data reset.');
  };

  els.form.addEventListener('submit', event => {
    event.preventDefault();
    submitGuess(els.input.value);
  });

  document.querySelectorAll('.mode-card').forEach(button => {
    button.addEventListener('click', () => {
      endCurrentRunForRestart();
      newSession(button.dataset.mode);
    });
  });

  els.hintButton.addEventListener('click', useHint);
  els.nextButton.addEventListener('click', () => {
    if (session.runFinished) newSession(session.mode);
    else nextRound();
  });
  els.shareButton.addEventListener('click', shareResult);
  els.newGameButton.addEventListener('click', () => {
    endCurrentRunForRestart();
    newSession(session.mode);
  });
  els.playDailyButton.addEventListener('click', () => {
    endCurrentRunForRestart();
    newSession('daily');
  });

  $('stats-button').addEventListener('click', openStats);
  $('settings-button').addEventListener('click', openSettings);

  els.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    persistent.settings.theme = current === 'dark' ? 'light' : 'dark';
    save();
    applyTheme();
  });
  els.themeSelect.addEventListener('change', () => {
    persistent.settings.theme = els.themeSelect.value;
    save();
    applyTheme();
  });
  els.soundToggle.addEventListener('change', () => {
    persistent.settings.sound = els.soundToggle.checked;
    save();
  });
  els.hapticsToggle.addEventListener('change', () => {
    persistent.settings.haptics = els.hapticsToggle.checked;
    save();
  });

  els.exportButton.addEventListener('click', exportData);
  els.importInput.addEventListener('change', () => importData(els.importInput.files?.[0]));
  els.resetDataButton.addEventListener('click', resetData);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.classList.remove('hidden');
  });
  els.installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installButton.classList.add('hidden');
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
  }

  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (persistent.settings.theme === 'system') applyTheme();
  });

  applyTheme();
  evaluateAchievements();
  newSession('classic');
})();
