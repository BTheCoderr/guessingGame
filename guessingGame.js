(() => {
  const STORAGE_KEY = 'guess-arcade-v2';

  const MODES = {
    classic: { label:'Classic', startMax:25, hints:3, subtitle:'Climb levels, build combos, hit jackpot rounds.' },
    sprint: { label:'Sprint', startMax:50, hints:2, timed:true, seconds:60, subtitle:'Solve as many targets as possible before time disappears.' },
    survival: { label:'Survival', startMax:40, hints:1, lives:3, subtitle:'Four misses costs a life. Protect all three.' },
    endless: { label:'Endless', startMax:20, hints:3, subtitle:'No finish line. The range keeps getting meaner.' },
    daily: { label:'Daily', startMax:100, hints:0, dailyAttempts:7, subtitle:'One date-seeded target. Seven tries. No boosts.' },
    duel: { label:'Duel', startMax:50, hints:0, subtitle:'Pass the phone. Alternate guesses. First player to three rounds wins.' },
    custom: { label:'Custom', startMax:100, hints:2, subtitle:'Your rules. Your range. Your run.' },
    challenge: { label:'Challenge', startMax:100, hints:1, subtitle:'A shareable seeded puzzle that plays the same on any device.' },
    tournament: { label:'Tournament', startMax:100, hints:0, subtitle:'Local party play for 3–6 saved players.' }
  };

  const ACHIEVEMENTS = [
    { id:'first-win', icon:'✓', name:'First Hit', description:'Win your first solo round.', test:s => s.wins >= 1 },
    { id:'sharp', icon:'⌖', name:'Sharpshooter', description:'Solve a round in 3 guesses or fewer.', test:s => s.bestAttempts > 0 && s.bestAttempts <= 3 },
    { id:'ace', icon:'1', name:'Called It', description:'Hit a target on the first guess.', test:s => s.perfectWins >= 1 },
    { id:'speed', icon:'⚡', name:'Quick Read', description:'Solve a round in under 10 seconds.', test:s => s.fastestWinMs > 0 && s.fastestWinMs < 10000 },
    { id:'streak', icon:'↗', name:'On Fire', description:'Reach a 3-round win streak.', test:s => s.bestStreak >= 3 },
    { id:'combo', icon:'🔥', name:'Combo King', description:'Reach a 4-hit combo.', test:s => s.bestCombo >= 4 },
    { id:'score', icon:'★', name:'High Roller', description:'Score 500+ in one run.', test:s => s.bestScore >= 500 },
    { id:'jackpot', icon:'×2', name:'Jackpot', description:'Clear a double-score jackpot round.', test:s => s.bonusWins >= 1 },
    { id:'daily', icon:'◫', name:'Daily Mind', description:'Complete a daily challenge.', test:s => s.dailyCompleted >= 1 },
    { id:'duel', icon:'⚔', name:'Face Off', description:'Finish a two-player Duel match.', test:s => s.duelMatches >= 1 },
    { id:'challenger', icon:'#', name:'Code Cracker', description:'Beat a shared Challenge Code.', test:s => s.challengeWins >= 1 },
    { id:'host', icon:'☰', name:'Party Starter', description:'Finish your first local tournament.', test:s => s.tournamentMatches >= 1 },
    { id:'champ', icon:'♛', name:'House Champ', description:'Win a local tournament.', test:s => s.tournamentWins >= 1 }
  ];

  const defaultState = () => ({
    version:4,
    stats:{
      gamesPlayed:0, wins:0, bestScore:0, currentStreak:0, bestStreak:0,
      totalGuesses:0, fastestWinMs:0, bestAttempts:0, dailyCompleted:0,
      perfectWins:0, bestCombo:0, bonusWins:0, duelMatches:0,
      challengeWins:0, tournamentMatches:0, tournamentWins:0
    },
    history:[],
    unlocked:[],
    daily:{},
    profiles:[{ id:'guest', name:'Guest', stats:{ games:0, wins:0, bestScore:0, challengesWon:0, tournamentWins:0 } }],
    activeProfileId:'guest',
    settings:{ theme:'dark', sound:true, haptics:true }
  });

  const loadState = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const base = defaultState();
      if (!saved || typeof saved !== 'object') return base;
      return {
        ...base,
        ...saved,
        stats:{ ...base.stats, ...(saved.stats || {}) },
        settings:{ ...base.settings, ...(saved.settings || {}) },
        history:Array.isArray(saved.history) ? saved.history : [],
        unlocked:Array.isArray(saved.unlocked) ? saved.unlocked : [],
        daily:saved.daily && typeof saved.daily === 'object' ? saved.daily : {},
        profiles:Array.isArray(saved.profiles) && saved.profiles.length ? saved.profiles.slice(0,6) : base.profiles,
        activeProfileId:saved.activeProfileId || (saved.profiles?.[0]?.id ?? 'guest')
      };
    } catch {
      return defaultState();
    }
  };

  let persistent = loadState();
  let session = {};
  let timerId = null;
  let toastTimer = null;
  let deferredInstallPrompt = null;

  const $ = id => document.getElementById(id);
  const els = {
    gameCard:$('game-card'),
    form:$('guess-form'), input:$('guess-input'), guessButton:$('guess-button'), guessLabel:$('guess-label'),
    modeKicker:$('mode-kicker'), modeTitle:$('mode-title'), modeDescription:$('mode-description'),
    rangePill:$('range-pill'), rangeCopy:$('range-copy'),
    comboPill:$('combo-pill'), comboValue:$('combo-value'), jackpotPill:$('jackpot-pill'),
    duelBoard:$('duel-scoreboard'), duelP1:$('duel-player-1'), duelP2:$('duel-player-2'),
    duelScore1:$('duel-score-1'), duelScore2:$('duel-score-2'), duelRound:$('duel-round'),
    signalCard:$('signal-card'), signalOrb:$('signal-orb'), signalLabel:$('signal-label'), signalText:$('signal-text'),
    meterFill:$('meter-fill'), score:$('score-value'), attempts:$('attempts-value'),
    metricOneLabel:$('metric-one-label'), metricTwoLabel:$('metric-two-label'),
    timerLabel:$('timer-label'), timer:$('timer-value'), resourceLabel:$('resource-label'), resource:$('resource-value'),
    hintButton:$('hint-button'), hintsLeft:$('hints-left'),
    powerDeck:$('power-deck'), powerScan:$('power-scan'), powerDouble:$('power-double'), powerLucky:$('power-lucky'),
    guessHistory:$('guess-history'), resultActions:$('result-actions'), nextButton:$('next-button'), shareButton:$('share-button'),
    newGameButton:$('new-game-button'),
    challengeTitle:$('challenge-title'), challengeStatus:$('challenge-status'), challengeCopy:$('challenge-copy'), challengeFill:$('challenge-fill'),
    dailyDate:$('daily-date'), dailyStatus:$('daily-status'), playDailyButton:$('play-daily-button'),
    activePlayerBadge:$('active-player-badge'),
    playersDialog:$('players-dialog'), profileList:$('profile-list'), profileNameInput:$('profile-name-input'),
    customDialog:$('custom-dialog'), customMax:$('custom-max'), customAttempts:$('custom-attempts'), customSeconds:$('custom-seconds'),
    customHints:$('custom-hints'), customPowers:$('custom-powers'), customJackpot:$('custom-jackpot'),
    challengeDialog:$('challenge-dialog'), challengeMax:$('challenge-max'), challengeAttempts:$('challenge-attempts'),
    challengeHints:$('challenge-hints'), generatedCodeBox:$('generated-code-box'), generatedCode:$('generated-code'),
    joinChallengeInput:$('join-challenge-input'),
    tournamentDialog:$('tournament-dialog'), tournamentPicker:$('tournament-picker'), tournamentRounds:$('tournament-rounds'),
    tournamentMax:$('tournament-max'), tournamentAttempts:$('tournament-attempts'),
    tournamentBoard:$('tournament-scoreboard'), tournamentPlayers:$('tournament-players'), tournamentRoundLabel:$('tournament-round-label'),
    achievementList:$('achievement-list'), achievementCount:$('achievement-count'),
    heroBestScore:$('hero-best-score'), heroCombo:$('hero-combo'), heroGames:$('hero-games'),
    statsDialog:$('stats-dialog'), settingsDialog:$('settings-dialog'), statsGrid:$('stats-grid'), gameHistory:$('game-history'),
    soundToggle:$('sound-toggle'), hapticsToggle:$('haptics-toggle'), themeSelect:$('theme-select'), themeToggle:$('theme-toggle'),
    exportButton:$('export-button'), importInput:$('import-input'), resetDataButton:$('reset-data-button'), installButton:$('install-button'),
    toast:$('toast'), confetti:$('confetti-layer')
  };

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(persistent));
  const randomTarget = max => Math.floor(Math.random() * max) + 1;
  const activeProfile = () => persistent.profiles.find(p => p.id === persistent.activeProfileId) || persistent.profiles[0];
  const normalizeProfile = p => ({
    id:p.id, name:p.name,
    stats:{ games:0, wins:0, bestScore:0, challengesWon:0, tournamentWins:0, ...(p.stats || {}) }
  });
  persistent.profiles = persistent.profiles.map(normalizeProfile);
  if (!persistent.profiles.some(p => p.id === persistent.activeProfileId)) persistent.activeProfileId = persistent.profiles[0]?.id || 'guest';

  const getModeConfig = () => {
    if (session.mode === 'custom' && session.custom) {
      return { ...MODES.custom, hints:session.custom.hints, timed:session.custom.seconds > 0, seconds:session.custom.seconds };
    }
    if (session.mode === 'challenge' && session.challengeData) {
      return { ...MODES.challenge, hints:session.challengeData.hints, timed:false };
    }
    return MODES[session.mode] || MODES.classic;
  };

  const seededTarget = (seed, max) => {
    let x = Math.abs(Number(seed) || 1) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 2246822507);
    x = Math.imul(x ^ (x >>> 13), 3266489909);
    x = (x ^ (x >>> 16)) >>> 0;
    return (x % max) + 1;
  };

  const encodeChallenge = ({max, attempts, hints, seed}) =>
    `GA-${Number(max).toString(36).toUpperCase()}-${Number(attempts).toString(36).toUpperCase()}-${Number(hints).toString(36).toUpperCase()}-${Number(seed).toString(36).toUpperCase()}`;

  const decodeChallenge = raw => {
    const parts = String(raw || '').trim().toUpperCase().split('-');
    if (parts.length !== 5 || parts[0] !== 'GA') return null;
    const [max,attempts,hints,seed] = parts.slice(1).map(v => parseInt(v,36));
    if (![max,attempts,hints,seed].every(Number.isFinite)) return null;
    if (max < 10 || max > 100000 || attempts < 3 || attempts > 50 || hints < 0 || hints > 5 || seed < 1) return null;
    return { max, attempts, hints, seed, code:encodeChallenge({max,attempts,hints,seed}) };
  };

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
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  };

  const comboMultiplier = combo => {
    if (combo <= 1) return 1;
    return Math.min(2, 1 + (combo - 1) * .25);
  };

  const isJackpotLevel = () =>
    ['classic','survival','endless'].includes(session.mode) && session.level > 1 && session.level % 3 === 0;

  const toast = message => {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  };

  const tone = (frequency, duration=.1, type='sine', volume=.035, delay=0) => {
    if (!persistent.settings.sound) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = frequency;
      const start = ctx.currentTime + delay;
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      osc.start(start); osc.stop(start + duration);
    } catch {}
  };

  const feedback = type => {
    if (persistent.settings.haptics && navigator.vibrate) {
      const patterns = {
        win:[30,25,45,25,70], hot:[20,18,20], miss:20, bonus:[35,20,35,20,80], power:[22,15,35]
      };
      navigator.vibrate(patterns[type] || 12);
    }
    if (type === 'win') {
      tone(520,.08); tone(660,.08,'sine',.035,.07); tone(820,.15,'sine',.04,.14);
    } else if (type === 'bonus') {
      tone(440,.08); tone(660,.1,'triangle',.04,.08); tone(990,.2,'triangle',.04,.18);
    } else if (type === 'hot') {
      tone(310,.08,'triangle',.028);
    } else if (type === 'power') {
      tone(470,.07); tone(720,.12,'sine',.03,.06);
    } else {
      tone(165,.09,'sine',.02);
    }
  };

  const burstConfetti = (big=false) => {
    const count = big ? 42 : 24;
    for (let i=0;i<count;i++) {
      const piece = document.createElement('i');
      piece.className = 'confetti-piece';
      piece.style.setProperty('--h', String(Math.floor(Math.random()*360)));
      piece.style.setProperty('--x', `${Math.round((Math.random()-.5)*(big?780:520))}px`);
      piece.style.setProperty('--r', `${Math.round((Math.random()-.5)*900)}deg`);
      piece.style.setProperty('--d', `${(1 + Math.random()*.7).toFixed(2)}s`);
      piece.style.left = `${35 + Math.random()*30}%`;
      els.confetti.appendChild(piece);
      setTimeout(() => piece.remove(), 1900);
    }
    els.gameCard.classList.remove('win-flash');
    void els.gameCard.offsetWidth;
    els.gameCard.classList.add('win-flash');
  };

  const applyTheme = () => {
    let theme = persistent.settings.theme;
    if (theme === 'system') theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    els.themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#07111f' : '#eff5f1');
  };

  const makeSession = mode => {
    const config = MODES[mode];
    const dailyRecord = persistent.daily[todayKey()];
    return {
      mode,
      level:1,
      max:config.startMax,
      target:mode === 'daily' ? seededDailyTarget(todayKey()) : randomTarget(config.startMax),
      score:0,
      attempts:0,
      roundAttempts:0,
      hintsLeft:config.hints,
      lives:config.lives || 0,
      startedAt:0,
      roundStartedAt:Date.now(),
      timeRemaining:config.seconds || 0,
      completed:false,
      runFinished:false,
      guesses:[],
      combo:0,
      challengeClaimed:false,
      bonusRound:false,
      doubleNext:false,
      powerups:{ scan:false, double:false, lucky:false },
      dailyLocked:mode === 'daily' && !!dailyRecord?.completed,
      attemptLimit:0,
      allowPowers:!['daily','duel','challenge','tournament'].includes(mode),
      custom:null,
      challengeData:null,
      duel:mode === 'duel' ? { round:1, scores:[0,0], current:0, starter:0, goal:3 } : null,
      tournament:null
    };
  };

  const newSession = (mode='classic') => {
    stopTimer();
    session = makeSession(mode);
    session.bonusRound = isJackpotLevel();
    setActiveMode(mode);
    resetSignal();
    renderAll();

    if (session.dailyLocked) {
      const record = persistent.daily[todayKey()];
      showSignal(record.won ? 'Daily complete' : 'Daily finished',
        record.won ? `Solved in ${record.attempts} guesses.` : `Today’s answer was ${record.target}.`,
        record.won ? '✓' : '•', record.won ? 100 : 0);
      lockRound();
    } else {
      els.input.focus({ preventScroll:true });
    }
  };

  const setActiveMode = mode =>
    document.querySelectorAll('.mode-card').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));

  const startCustom = config => {
    stopTimer();
    session = makeSession('custom');
    session.custom = config;
    session.max = config.max;
    session.target = randomTarget(config.max);
    session.hintsLeft = config.hints;
    session.timeRemaining = config.seconds;
    session.attemptLimit = config.attempts;
    session.allowPowers = config.powers;
    session.bonusRound = config.jackpot;
    setActiveMode('');
    resetSignal();
    renderAll();
    els.customDialog.close();
    els.input.focus({preventScroll:true});
  };

  const startChallenge = data => {
    stopTimer();
    session = makeSession('challenge');
    session.challengeData = data;
    session.max = data.max;
    session.target = seededTarget(data.seed, data.max);
    session.hintsLeft = data.hints;
    session.attemptLimit = data.attempts;
    session.allowPowers = false;
    setActiveMode('');
    resetSignal();
    showSignal('CHALLENGE LOADED', `${data.code} · ${data.attempts} guesses to crack it.`, '#', 0);
    renderAll();
    els.challengeDialog.close();
    els.input.focus({preventScroll:true});
  };

  const tournamentTarget = () => seededTarget(
    session.tournament.seed + session.tournament.round * 1009 + session.tournament.current * 97,
    session.tournament.max
  );

  const startTournament = ({profileIds, rounds, max, attempts}) => {
    const players = profileIds
      .map(id => persistent.profiles.find(p => p.id === id))
      .filter(Boolean)
      .slice(0,6)
      .map(p => ({ id:p.id, name:p.name, score:0, roundScore:0 }));
    if (players.length < 3) return toast('Choose at least 3 saved players.');

    stopTimer();
    session = makeSession('tournament');
    session.tournament = {
      players, rounds, round:1, current:0, max, attemptLimit:attempts,
      seed:(Date.now() % 2147483647) || 1,
      profileIds:[...profileIds]
    };
    session.max = max;
    session.attemptLimit = attempts;
    session.target = tournamentTarget();
    session.allowPowers = false;
    setActiveMode('');
    resetSignal();
    showSignal('TOURNAMENT START', `${players[0].name}, you’re first. You have ${attempts} guesses.`, '♛', 0);
    renderAll();
    els.tournamentDialog.close();
    els.input.focus({preventScroll:true});
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
          finishRun(false, `Time! You banked ${session.score.toLocaleString()} points.`);
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
      toast(`Enter a whole number from 1 to ${session.max.toLocaleString()}.`);
      return;
    }

    startClockIfNeeded();
    session.attempts += 1;
    session.roundAttempts += 1;
    persistent.stats.totalGuesses += 1;

    const delta = guess - session.target;
    const distance = Math.abs(delta);
    const closeness = Math.max(0, 100 - (distance / session.max) * 190);
    const direction = delta === 0 ? 'correct' : delta > 0 ? 'lower' : 'higher';

    session.guesses.unshift({
      value:guess, direction, distance, closeness,
      player:session.mode === 'duel' ? session.duel.current + 1 : null,
      playerLabel:session.mode === 'tournament' ? session.tournament.players[session.tournament.current].name : null
    });
    session.guesses = session.guesses.slice(0, 9);

    if (session.mode === 'duel') {
      handleDuelGuess(guess, delta, distance, closeness, direction);
    } else if (session.mode === 'tournament') {
      handleTournamentGuess(guess, delta, distance, closeness, direction);
    } else if (delta === 0) {
      handleSoloWin();
    } else {
      handleSoloMiss(guess, distance, closeness, direction);
    }

    save();
    evaluateAchievements();
    renderAll();
    els.input.value = '';
    if (!session.completed && !session.runFinished && !session.dailyLocked) els.input.focus({ preventScroll:true });
  };

  const heatLabel = closeness => closeness >= 82 ? 'BURNING' : closeness >= 58 ? 'HOT' : closeness >= 32 ? 'WARM' : 'COLD';

  const pulseHeat = (closeness, oneAway=false) => {
    els.signalCard.classList.remove('hot-pulse','one-away');
    void els.signalCard.offsetWidth;
    if (closeness >= 58) els.signalCard.classList.add('hot-pulse');
    if (oneAway) els.signalCard.classList.add('one-away');
    setTimeout(() => els.signalCard.classList.remove('hot-pulse','one-away'), 700);
  };

  const handleSoloMiss = (guess, distance, closeness, direction) => {
    const oneAway = distance === 1;
    feedback(closeness >= 58 ? 'hot' : 'miss');
    pulseHeat(closeness, oneAway);

    const headline = oneAway ? 'ONE AWAY!' : direction === 'higher' ? 'Go higher' : 'Go lower';
    const copy = oneAway
      ? `${guess} missed by one. You are sitting on the answer.`
      : `${heatLabel(closeness)}. ${guess} is ${direction === 'higher' ? 'below' : 'above'} the target.`;
    showSignal(headline, copy, direction === 'higher' ? '↑' : '↓', closeness);

    if (session.mode === 'survival' && session.roundAttempts % 4 === 0) {
      session.lives -= 1;
      if (session.lives <= 0) {
        finishRun(false, `Knocked out. The number was ${session.target}.`);
      } else {
        toast(`💔 Life lost — ${session.lives} left.`);
      }
    }

    if (session.mode === 'daily' && session.roundAttempts >= MODES.daily.dailyAttempts) {
      persistent.daily[todayKey()] = {
        completed:true, won:false, target:session.target, attempts:session.roundAttempts, date:todayKey()
      };
      persistent.stats.dailyCompleted += 1;
      finishRun(false, `Daily finished. The number was ${session.target}.`);
    }

    if (['custom','challenge'].includes(session.mode) && session.attemptLimit > 0 && session.roundAttempts >= session.attemptLimit) {
      finishRun(false, `Out of guesses. The number was ${session.target}.`);
    }
  };

  const handleSoloWin = () => {
    const elapsed = roundElapsed();
    const quickWin = session.roundAttempts <= 4;
    session.combo = quickWin ? session.combo + 1 : 0;
    const multiplier = comboMultiplier(session.combo);
    const jackpot = session.bonusRound ? 2 : 1;
    const power = session.doubleNext ? 2 : 1;

    const base = Math.max(35, 150 - session.roundAttempts * 9);
    const levelBonus = session.level * 12;
    const speedBonus = Math.max(0, 45 - Math.floor(elapsed / 1000));
    let gain = Math.round((base + levelBonus + speedBonus) * multiplier * jackpot * power);

    if (session.combo >= 3 && !session.challengeClaimed) {
      gain += 100;
      session.challengeClaimed = true;
      toast('🔥 HEAT CHECK CLEARED +100');
    }

    session.score += gain;
    session.completed = true;

    persistent.stats.wins += 1;
    persistent.stats.currentStreak += 1;
    persistent.stats.bestStreak = Math.max(persistent.stats.bestStreak, persistent.stats.currentStreak);
    persistent.stats.bestCombo = Math.max(persistent.stats.bestCombo, session.combo);
    persistent.stats.fastestWinMs = persistent.stats.fastestWinMs === 0 ? elapsed : Math.min(persistent.stats.fastestWinMs, elapsed);
    persistent.stats.bestAttempts = persistent.stats.bestAttempts === 0 ? session.roundAttempts : Math.min(persistent.stats.bestAttempts, session.roundAttempts);
    persistent.stats.bestScore = Math.max(persistent.stats.bestScore, session.score);

    if (session.roundAttempts === 1) persistent.stats.perfectWins += 1;
    if (session.bonusRound) persistent.stats.bonusWins += 1;

    const perfect = session.roundAttempts === 1;
    const clutch = (session.mode === 'daily' && session.roundAttempts === MODES.daily.dailyAttempts) ||
      (session.mode === 'survival' && session.lives === 1);

    const label = perfect ? 'CALLED IT!' : session.bonusRound ? 'JACKPOT!' : clutch ? 'CLUTCH!' : 'Correct';
    const extra = session.doubleNext ? ' · DOUBLE UP CASHED' : '';
    showSignal(label, `+${gain.toLocaleString()} points · ${multiplier.toFixed(2)}x combo${extra}`, perfect ? '1' : '✓', 100);

    feedback(session.bonusRound || perfect ? 'bonus' : 'win');
    burstConfetti(session.bonusRound || perfect);
    session.doubleNext = false;

    if (session.mode === 'daily') {
      persistent.daily[todayKey()] = {
        completed:true, won:true, target:session.target, attempts:session.roundAttempts, date:todayKey()
      };
      persistent.stats.dailyCompleted += 1;
      finishRun(true, `Daily solved in ${session.roundAttempts} ${session.roundAttempts === 1 ? 'guess' : 'guesses'}.`);
      return;
    }

    if (session.mode === 'challenge') {
      persistent.stats.challengeWins += 1;
      finishRun(true, `Challenge cracked in ${session.roundAttempts}/${session.attemptLimit} guesses. Code: ${session.challengeData.code}`);
      return;
    }

    if (session.mode === 'custom') {
      finishRun(true, `Custom game cleared in ${session.roundAttempts}/${session.attemptLimit} guesses.`);
      return;
    }

    if (session.mode === 'sprint') {
      setTimeout(() => {
        if (!session.runFinished) nextRound();
      }, 560);
    } else {
      els.resultActions.classList.remove('hidden');
    }

    save();
    evaluateAchievements();
  };

  const handleDuelGuess = (guess, delta, distance, closeness, direction) => {
    const duel = session.duel;
    const player = duel.current;

    if (delta === 0) {
      duel.scores[player] += 1;
      session.completed = true;
      showSignal(`PLAYER ${player + 1} TAKES THE ROUND!`, `${guess} was the target. Score: ${duel.scores[0]}–${duel.scores[1]}.`, '⚔', 100);
      feedback('bonus');
      burstConfetti(duel.scores[player] >= duel.goal);

      if (duel.scores[player] >= duel.goal) {
        finishDuel(player);
      } else {
        els.resultActions.classList.remove('hidden');
      }
      return;
    }

    const oneAway = distance === 1;
    feedback(closeness >= 58 ? 'hot' : 'miss');
    pulseHeat(closeness, oneAway);
    duel.current = duel.current === 0 ? 1 : 0;

    showSignal(
      oneAway ? 'ONE AWAY!' : `${heatLabel(closeness)} · GO ${direction.toUpperCase()}`,
      `Player ${duel.current + 1}, you’re up. Use the last clue.`,
      direction === 'higher' ? '↑' : '↓',
      closeness
    );
  };

  const handleTournamentGuess = (guess, delta, distance, closeness, direction) => {
    const t = session.tournament;
    const player = t.players[t.current];

    if (delta === 0) {
      const points = Math.max(1, t.attemptLimit - session.roundAttempts + 1);
      player.score += points;
      player.roundScore = points;
      session.completed = true;
      feedback('bonus');
      burstConfetti(false);
      showSignal('TURN CLEARED', `${player.name} solved it in ${session.roundAttempts}. +${points} tournament points.`, '✓', 100);
      els.resultActions.classList.remove('hidden');
      return;
    }

    feedback(closeness >= 58 ? 'hot' : 'miss');
    pulseHeat(closeness, distance === 1);
    showSignal(
      distance === 1 ? 'ONE AWAY!' : `${heatLabel(closeness)} · GO ${direction.toUpperCase()}`,
      `${player.name} has ${Math.max(0,t.attemptLimit-session.roundAttempts)} guesses left.`,
      direction === 'higher' ? '↑' : '↓',
      closeness
    );

    if (session.roundAttempts >= t.attemptLimit) {
      player.roundScore = 0;
      session.completed = true;
      showSignal('TURN OVER', `${player.name} ran out of guesses. The target was ${session.target}.`, '×', 0);
      els.resultActions.classList.remove('hidden');
    }
  };

  const advanceTournament = () => {
    const t = session.tournament;
    if (t.current < t.players.length - 1) {
      t.current += 1;
    } else {
      t.current = 0;
      t.round += 1;
      if (t.round > t.rounds) return finishTournament();
    }

    session.completed = false;
    session.roundAttempts = 0;
    session.guesses = [];
    session.target = tournamentTarget();
    session.roundStartedAt = Date.now();
    els.resultActions.classList.add('hidden');
    showSignal('NEXT TURN', `${t.players[t.current].name}, you have ${t.attemptLimit} guesses.`, '♛', 0);
    renderAll();
    els.input.focus({preventScroll:true});
  };

  const finishTournament = () => {
    const t = session.tournament;
    session.runFinished = true;
    session.completed = true;
    stopTimer();
    persistent.stats.gamesPlayed += 1;
    persistent.stats.tournamentMatches += 1;

    const best = Math.max(...t.players.map(p => p.score));
    const winners = t.players.filter(p => p.score === best);
    persistent.stats.tournamentWins += 1;
    for (const winner of winners) {
      const profile = persistent.profiles.find(p => p.id === winner.id);
      if (profile) profile.stats.tournamentWins += 1;
    }

    persistent.history.unshift({
      date:new Date().toISOString(), mode:'tournament',
      score:t.players.map(p => `${p.name}:${p.score}`).join(', '),
      level:t.rounds, attempts:session.attempts, won:true,
      winner:winners.map(p => p.name).join(' + ')
    });
    persistent.history = persistent.history.slice(0,20);
    save();
    evaluateAchievements();
    burstConfetti(true);
    showSignal('TOURNAMENT OVER', `♛ ${winners.map(p=>p.name).join(' + ')} ${winners.length > 1 ? 'tie' : 'wins'} with ${best} points!`, '♛', 100);
    els.resultActions.classList.remove('hidden');
    els.nextButton.textContent = 'Run it back';
    renderAll();
  };

  const finishDuel = winner => {
    session.runFinished = true;
    stopTimer();
    persistent.stats.gamesPlayed += 1;
    persistent.stats.duelMatches += 1;
    persistent.history.unshift({
      date:new Date().toISOString(), mode:'duel', score:`${session.duel.scores[0]}-${session.duel.scores[1]}`,
      level:session.duel.round, attempts:session.attempts, won:true, winner:winner + 1
    });
    persistent.history = persistent.history.slice(0,20);
    showSignal('MATCH OVER', `🏆 Player ${winner + 1} wins ${session.duel.scores[0]}–${session.duel.scores[1]}!`, '🏆', 100);
    els.resultActions.classList.remove('hidden');
    els.nextButton.textContent = 'Run it back';
    save();
    evaluateAchievements();
  };

  const nextRound = () => {
    if (session.mode === 'tournament') {
      if (session.runFinished) {
        startTournament({
          profileIds:session.tournament.profileIds,
          rounds:session.tournament.rounds,
          max:session.tournament.max,
          attempts:session.tournament.attemptLimit
        });
      } else {
        advanceTournament();
      }
      return;
    }

    if (session.mode === 'custom' && session.runFinished) {
      startCustom({...session.custom});
      return;
    }

    if (session.mode === 'challenge' && session.runFinished) {
      startChallenge({...session.challengeData});
      return;
    }

    if (session.mode === 'duel') {
      if (session.runFinished) {
        newSession('duel');
        return;
      }
      const duel = session.duel;
      duel.round += 1;
      duel.starter = duel.starter === 0 ? 1 : 0;
      duel.current = duel.starter;
      session.level = duel.round;
      session.max = Math.min(250, 50 + (duel.round - 1) * 20);
      session.target = randomTarget(session.max);
      session.roundAttempts = 0;
      session.guesses = [];
      session.completed = false;
      session.roundStartedAt = Date.now();
      els.resultActions.classList.add('hidden');
      resetSignal();
      renderAll();
      els.input.focus({ preventScroll:true });
      return;
    }

    if (session.runFinished) {
      newSession(session.mode);
      return;
    }

    session.completed = false;
    session.level += 1;
    session.roundAttempts = 0;
    session.guesses = [];
    session.hintsLeft = getModeConfig().hints;
    session.max = Math.min(100000, Math.ceil(session.max * (session.mode === 'classic' ? 1.55 : session.mode === 'endless' ? 1.78 : 1.35)));
    session.target = randomTarget(session.max);
    session.roundStartedAt = Date.now();
    session.bonusRound = isJackpotLevel();
    els.resultActions.classList.add('hidden');

    if (session.bonusRound) {
      showSignal('★ JACKPOT ROUND', 'Find this target and the round pays DOUBLE.', '×2', 0);
      feedback('power');
    } else {
      resetSignal();
    }

    renderAll();
    els.input.focus({ preventScroll:true });
  };

  const finishRun = (won, message) => {
    if (session.runFinished) return;
    session.runFinished = true;
    session.completed = true;
    stopTimer();

    persistent.stats.gamesPlayed += 1;
    if (!won && !['sprint','daily'].includes(session.mode)) persistent.stats.currentStreak = 0;
    persistent.stats.bestScore = Math.max(persistent.stats.bestScore, session.score);

    if (!['duel','tournament'].includes(session.mode)) {
      const profile = activeProfile();
      if (profile) {
        profile.stats.games += 1;
        if (won) profile.stats.wins += 1;
        profile.stats.bestScore = Math.max(profile.stats.bestScore, Number(session.score) || 0);
        if (won && session.mode === 'challenge') profile.stats.challengesWon += 1;
      }
    }

    persistent.history.unshift({
      date:new Date().toISOString(), mode:session.mode, score:session.score,
      level:session.level, attempts:session.attempts, won
    });
    persistent.history = persistent.history.slice(0,20);

    save();
    evaluateAchievements();
    showSignal(won ? 'Run complete' : 'Game over', message, won ? '✓' : '×', won ? 100 : 0);
    els.resultActions.classList.remove('hidden');
    els.nextButton.textContent = 'Play again';
    renderAll();
  };

  const endCurrentRunForRestart = () => {
    if (!session.startedAt || session.runFinished || session.mode === 'daily') return;

    if (session.mode === 'duel') {
      persistent.stats.gamesPlayed += 1;
      persistent.history.unshift({
        date:new Date().toISOString(), mode:'duel', score:`${session.duel.scores[0]}-${session.duel.scores[1]}`,
        level:session.duel.round, attempts:session.attempts, won:false
      });
    } else if (session.mode === 'tournament') {
      persistent.stats.gamesPlayed += 1;
      persistent.history.unshift({
        date:new Date().toISOString(), mode:'tournament',
        score:session.tournament.players.map(p => `${p.name}:${p.score}`).join(', '),
        level:Math.min(session.tournament.round,session.tournament.rounds), attempts:session.attempts, won:false
      });
    } else {
      persistent.stats.gamesPlayed += 1;
      persistent.stats.currentStreak = 0;
      persistent.stats.bestScore = Math.max(persistent.stats.bestScore, session.score);
      persistent.history.unshift({
        date:new Date().toISOString(), mode:session.mode, score:session.score,
        level:session.level, attempts:session.attempts, won:false
      });
    }

    persistent.history = persistent.history.slice(0,20);
    save();
  };

  const useHint = () => {
    if (session.completed || session.runFinished || session.dailyLocked || ['daily','duel','tournament'].includes(session.mode)) return;
    if (session.hintsLeft <= 0) return toast('No hints left this round.');

    startClockIfNeeded();
    session.hintsLeft -= 1;
    const spread = Math.max(2, Math.ceil(session.max * .12));
    const low = Math.max(1, session.target - spread);
    const high = Math.min(session.max, session.target + spread);
    showSignal('Hint used', `The target sits between ${low} and ${high}.`, '≈', 55);
    feedback('power');
    renderMetrics();
  };

  const usePower = type => {
    if (session.completed || session.runFinished || !session.allowPowers) return;
    if (session.powerups[type]) return toast('That power-up is already spent.');

    startClockIfNeeded();
    session.powerups[type] = true;
    feedback('power');

    if (type === 'scan') {
      const spread = Math.max(2, Math.ceil(session.max * .08));
      const low = Math.max(1, session.target - spread);
      const high = Math.min(session.max, session.target + spread);
      showSignal('⌖ SCANNER LOCKED', `Target detected somewhere from ${low} to ${high}.`, '⌖', 64);
    }

    if (type === 'double') {
      session.doubleNext = true;
      showSignal('×2 ARMED', 'Your next correct hit pays double. Misses do not waste it.', '×2', 70);
    }

    if (type === 'lucky') {
      if (session.mode === 'sprint') {
        session.timeRemaining += 12;
        toast('🍀 Lucky Break: +12 seconds');
        showSignal('TIME WARP', '+12 seconds added to the clock.', '+12', 72);
      } else if (session.mode === 'survival') {
        session.lives += 1;
        toast('🍀 Lucky Break: +1 life');
        showSignal('EXTRA LIFE', 'You just stole one more life.', '♥', 72);
      } else {
        const roll = Math.floor(Math.random() * 3);
        if (roll === 0) {
          session.score += 75;
          toast('🍀 Lucky Break: +75 points');
          showSignal('FREE MONEY', '+75 points, no questions asked.', '+75', 72);
        } else if (roll === 1) {
          session.hintsLeft += 1;
          toast('🍀 Lucky Break: +1 hint');
          showSignal('EXTRA HINT', 'One extra hint has been loaded.', '+1', 72);
        } else {
          const parity = session.target % 2 === 0 ? 'EVEN' : 'ODD';
          toast(`🍀 Lucky Break: target is ${parity}`);
          showSignal('PARITY REVEAL', `The target is an ${parity} number.`, parity, 72);
        }
      }
    }

    renderAll();
  };

  const resetSignal = () => {
    const duelText = session.mode === 'duel' ? 'Player 1 starts. Every miss passes the phone.' : 'The target is waiting.';
    showSignal('Make your first guess', duelText, '?', 0);
  };

  const showSignal = (label, text, orb, meter) => {
    els.signalLabel.textContent = label;
    els.signalText.textContent = text;
    els.signalOrb.textContent = orb;
    els.meterFill.style.width = `${Math.max(0, Math.min(100, meter))}%`;
  };

  const lockRound = () => {
    els.input.disabled = true; els.guessButton.disabled = true; els.hintButton.disabled = true;
  };

  const unlockRound = () => {
    els.input.disabled = false; els.guessButton.disabled = false;
    els.hintButton.disabled = ['daily','duel'].includes(session.mode);
  };

  const renderAll = () => {
    renderGame();
    renderMetrics();
    renderGuessHistory();
    renderPersistent();
    renderDaily();
    renderChallenge();
    renderPowerDeck();
    renderDuel();
    renderTournament();
    renderProfiles();
  };

  const renderGame = () => {
    const config = getModeConfig();
    els.modeKicker.textContent = `${config.label.toUpperCase()} MODE`;
    els.modeTitle.textContent =
      session.mode === 'daily' ? 'Today’s puzzle' :
      session.mode === 'duel' ? `Round ${session.duel.round}` :
      session.mode === 'tournament' ? `Round ${session.tournament.round} · ${session.tournament.players[session.tournament.current].name}` :
      session.mode === 'challenge' ? 'Challenge Code' :
      session.mode === 'custom' ? 'Custom game' :
      `Level ${session.level}`;
    els.modeDescription.textContent = config.subtitle;
    els.rangePill.textContent = `1–${session.max.toLocaleString()}`;
    els.rangeCopy.textContent = `Choose a number from 1 to ${session.max.toLocaleString()}.`;
    els.input.min = '1'; els.input.max = String(session.max);
    els.hintsLeft.textContent = `(${session.hintsLeft})`;

    els.comboValue.textContent = `x${comboMultiplier(session.combo).toFixed(2)}`;
    els.comboPill.classList.toggle('hidden', ['daily','duel','challenge','tournament'].includes(session.mode));
    els.jackpotPill.classList.toggle('hidden', !session.bonusRound || session.completed);

    els.guessLabel.textContent =
      session.mode === 'duel' ? `Player ${session.duel.current + 1} guess` :
      session.mode === 'tournament' ? `${session.tournament.players[session.tournament.current].name} guess` :
      'Your guess';

    if (!session.completed && !session.runFinished && !session.dailyLocked) unlockRound();
    else lockRound();

    els.nextButton.textContent =
      session.mode === 'duel' && session.runFinished ? 'Run it back' :
      session.runFinished ? 'Play again' : 'Next round';

    if (!session.completed) els.resultActions.classList.add('hidden');
  };

  const renderMetrics = () => {
    if (session.mode === 'tournament') {
      const t = session.tournament;
      const player = t.players[t.current];
      els.metricOneLabel.textContent = 'Round';
      els.score.textContent = `${Math.min(t.round,t.rounds)}/${t.rounds}`;
      els.metricTwoLabel.textContent = 'Turn guesses';
      els.attempts.textContent = `${session.roundAttempts}/${t.attemptLimit}`;
      els.timerLabel.textContent = 'Player';
      els.timer.textContent = player.name;
      els.resourceLabel.textContent = 'Points';
      els.resource.textContent = player.score;
      els.hintButton.classList.add('hidden');
      return;
    }

    if (session.mode === 'duel') {
      els.metricOneLabel.textContent = 'Round';
      els.score.textContent = session.duel.round;
      els.metricTwoLabel.textContent = 'Total guesses';
      els.attempts.textContent = session.attempts;
      els.timerLabel.textContent = 'Turn';
      els.timer.textContent = `P${session.duel.current + 1}`;
      els.resourceLabel.textContent = 'Goal';
      els.resource.textContent = '3 wins';
      return;
    }

    els.metricOneLabel.textContent = 'Score';
    els.score.textContent = session.score.toLocaleString();
    els.metricTwoLabel.textContent = 'Attempts';
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
    } else if (['custom','challenge'].includes(session.mode)) {
      els.resourceLabel.textContent = 'Tries left';
      els.resource.textContent = Math.max(0, session.attemptLimit - session.roundAttempts);
    } else {
      els.resourceLabel.textContent = 'Hints';
      els.resource.textContent = session.hintsLeft;
    }

    els.hintButton.classList.toggle('hidden', ['daily','duel','tournament'].includes(session.mode));
  };

  const renderGuessHistory = () => {
    if (!session.guesses.length) {
      els.guessHistory.innerHTML = '<li class="empty-state">Your guesses will show up here.</li>';
      return;
    }

    els.guessHistory.innerHTML = session.guesses.map(g => `
      <li>
        <span class="guess-number">${g.value}</span>
        <span class="guess-direction">${g.playerLabel ? `${g.playerLabel} · ` : g.player ? `P${g.player} · ` : ''}${g.direction === 'correct' ? 'Target found' : `Go ${g.direction}`}</span>
        <span class="guess-distance">${g.direction === 'correct' ? 'hit' : g.distance === 1 ? '1 away' : g.closeness >= 70 ? 'hot' : g.closeness >= 40 ? 'warm' : 'cold'}</span>
      </li>
    `).join('');
  };

  const renderPersistent = () => {
    els.heroBestScore.textContent = persistent.stats.bestScore.toLocaleString();
    els.heroCombo.textContent = persistent.stats.bestCombo;
    els.heroGames.textContent = persistent.stats.gamesPlayed;
    els.activePlayerBadge.textContent = activeProfile()?.name || 'Guest';
    renderAchievements();
  };

  const renderDaily = () => {
    const record = persistent.daily[todayKey()];
    els.dailyDate.textContent = new Date().toLocaleDateString(undefined,{ weekday:'short', month:'short', day:'numeric' });
    els.dailyStatus.textContent = record?.completed ? (record.won ? 'Solved' : 'Finished') : 'Ready';
    els.dailyStatus.classList.toggle('done', !!record?.completed);
    els.playDailyButton.textContent = record?.completed ? 'View daily' : 'Play daily';
  };

  const renderChallenge = () => {
    if (session.mode === 'duel') {
      els.challengeTitle.textContent = 'First to Three';
      els.challengeCopy.textContent = 'Alternate after every miss. The round winner earns one point. First player to three takes the match.';
      els.challengeStatus.textContent = `${session.duel.scores[0]}–${session.duel.scores[1]}`;
      els.challengeFill.style.width = `${Math.max(...session.duel.scores) / 3 * 100}%`;
      return;
    }

    if (session.mode === 'tournament') {
      const t = session.tournament;
      els.challengeTitle.textContent = 'Party Bracket';
      els.challengeCopy.textContent = 'Each player gets a private target at the same difficulty. Fewer guesses earns more points.';
      els.challengeStatus.textContent = `${Math.min(t.round,t.rounds)}/${t.rounds}`;
      els.challengeFill.style.width = `${Math.min(t.round,t.rounds) / t.rounds * 100}%`;
      return;
    }

    if (session.mode === 'challenge') {
      els.challengeTitle.textContent = 'Code Challenge';
      els.challengeCopy.textContent = `${session.challengeData.code} · Same seeded target on every device.`;
      els.challengeStatus.textContent = `${session.roundAttempts}/${session.attemptLimit}`;
      els.challengeFill.style.width = `${session.roundAttempts / session.attemptLimit * 100}%`;
      return;
    }

    if (session.mode === 'custom') {
      els.challengeTitle.textContent = 'House Rules';
      els.challengeCopy.textContent = `1–${session.max.toLocaleString()} · ${session.attemptLimit} guesses${session.custom.seconds ? ` · ${session.custom.seconds}s` : ''}.`;
      els.challengeStatus.textContent = `${session.roundAttempts}/${session.attemptLimit}`;
      els.challengeFill.style.width = `${session.roundAttempts / session.attemptLimit * 100}%`;
      return;
    }

    if (session.mode === 'daily') {
      els.challengeTitle.textContent = 'Seven Shot';
      els.challengeCopy.textContent = 'Daily mode stays pure: no power-ups, one target, seven attempts.';
      els.challengeStatus.textContent = `${Math.min(session.roundAttempts,7)}/7`;
      els.challengeFill.style.width = `${Math.min(session.roundAttempts,7) / 7 * 100}%`;
      return;
    }

    els.challengeTitle.textContent = session.challengeClaimed ? 'Heat Check Cleared' : 'Heat Check';
    els.challengeCopy.textContent = session.challengeClaimed
      ? 'You hit a 3-round quick-win combo and banked the +100 challenge bonus.'
      : 'Win three rounds in four guesses or fewer to bank +100 bonus points.';
    const progress = session.challengeClaimed ? 3 : Math.min(session.combo,3);
    els.challengeStatus.textContent = `${progress}/3`;
    els.challengeFill.style.width = `${progress / 3 * 100}%`;
  };

  const renderPowerDeck = () => {
    const disabledMode = !session.allowPowers;
    els.powerDeck.classList.toggle('hidden', disabledMode);

    for (const [type, button] of [['scan',els.powerScan],['double',els.powerDouble],['lucky',els.powerLucky]]) {
      const used = !!session.powerups?.[type];
      button.disabled = used || disabledMode || session.completed || session.runFinished;
      button.classList.toggle('used', used);
      button.classList.toggle('armed', type === 'double' && session.doubleNext);
    }
  };

  const renderDuel = () => {
    const active = session.mode === 'duel';
    els.duelBoard.classList.toggle('hidden', !active);
    if (!active) return;

    els.duelScore1.textContent = session.duel.scores[0];
    els.duelScore2.textContent = session.duel.scores[1];
    els.duelRound.textContent = session.duel.round;
    els.duelP1.classList.toggle('active', session.duel.current === 0 && !session.completed);
    els.duelP2.classList.toggle('active', session.duel.current === 1 && !session.completed);
  };

  const renderTournament = () => {
    const active = session.mode === 'tournament';
    els.tournamentBoard.classList.toggle('hidden', !active);
    if (!active) return;
    const t = session.tournament;
    els.tournamentRoundLabel.textContent = `Round ${Math.min(t.round,t.rounds)} of ${t.rounds}`;
    els.tournamentPlayers.innerHTML = t.players.map((p,i) => `
      <div class="tournament-player ${i === t.current && !session.runFinished ? 'active' : ''}">
        <span>${p.name}</span><strong>${p.score} pts</strong>
      </div>
    `).join('');
  };

  const renderProfiles = () => {
    if (!els.profileList) return;
    els.profileList.innerHTML = persistent.profiles.map(p => `
      <div class="profile-row ${p.id === persistent.activeProfileId ? 'active' : ''}">
        <span><strong>${p.name}</strong><small>${p.stats.wins} wins · best ${p.stats.bestScore} · ${p.stats.tournamentWins} tournament wins</small></span>
        <button class="profile-chip ${p.id === persistent.activeProfileId ? 'active' : ''}" type="button" data-activate-profile="${p.id}">${p.id === persistent.activeProfileId ? 'Active' : 'Use'}</button>
        <button class="profile-chip" type="button" data-delete-profile="${p.id}" ${persistent.profiles.length === 1 ? 'disabled' : ''}>Remove</button>
      </div>
    `).join('');

    els.tournamentPicker.innerHTML = persistent.profiles.map(p => `
      <label class="tournament-pick"><input type="checkbox" value="${p.id}"><span>${p.name}</span></label>
    `).join('');
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
        toast(`🏆 Achievement: ${achievement.name}`);
      }
    }
    if (changed) save();
  };

  const openStats = () => {
    const s = persistent.stats;
    const accuracy = s.totalGuesses ? Math.round((s.wins / s.totalGuesses) * 100) : 0;
    const items = [
      ['Games',s.gamesPlayed], ['Solo wins',s.wins], ['Best score',s.bestScore.toLocaleString()],
      ['Best combo',s.bestCombo], ['Best streak',s.bestStreak], ['Best guesses',s.bestAttempts || '—'],
      ['Fastest round',formatTime(s.fastestWinMs)], ['Perfect hits',s.perfectWins], ['Duel matches',s.duelMatches],
      ['Challenges won',s.challengeWins], ['Tournaments',s.tournamentMatches], ['Tournament wins',s.tournamentWins],
      ['Total guesses',s.totalGuesses.toLocaleString()], ['Win/guess rate',`${accuracy}%`], ['Daily clears',s.dailyCompleted]
    ];
    els.statsGrid.innerHTML = items.map(([label,value]) => `<div class="stat-tile"><span>${label}</span><strong>${value}</strong></div>`).join('');

    els.gameHistory.innerHTML = persistent.history.length
      ? persistent.history.slice(0,8).map(item => `
        <div class="game-history-row">
          <strong>${MODES[item.mode]?.label || item.mode} · ${['duel','tournament'].includes(item.mode) ? item.score : `${Number(item.score || 0).toLocaleString()} pts`}</strong>
          <span>${new Date(item.date).toLocaleDateString()}${item.winner ? ` · ${item.mode === 'duel' ? `P${item.winner}` : item.winner} won` : ` · L${item.level}`}</span>
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
      : session.mode === 'duel'
        ? `Guess Arcade Duel — Player ${session.duel.scores[0] > session.duel.scores[1] ? 1 : 2} won ${session.duel.scores[0]}–${session.duel.scores[1]}.`
        : session.mode === 'tournament'
          ? `Guess Arcade Tournament — ${session.tournament.players.map(p => `${p.name} ${p.score}`).join(' · ')}.`
          : session.mode === 'challenge'
            ? `Guess Arcade Challenge ${session.challengeData.code} — ${session.roundAttempts}/${session.attemptLimit} guesses.`
            : `Guess Arcade ${MODES[session.mode].label} — ${session.score} points, level ${session.level}, ${session.combo} combo.`;

    try {
      if (navigator.share) await navigator.share({ title:'Guess Arcade', text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Result copied.');
      }
    } catch {}
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(persistent,null,2)],{ type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `guess-arcade-backup-${todayKey()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url),500);
  };

  const importData = async file => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !parsed.stats || !parsed.settings) throw new Error('invalid');
      const base = defaultState();
      persistent = {
        ...base, ...parsed,
        stats:{ ...base.stats, ...parsed.stats },
        settings:{ ...base.settings, ...parsed.settings },
        history:Array.isArray(parsed.history) ? parsed.history.slice(0,20) : [],
        unlocked:Array.isArray(parsed.unlocked) ? parsed.unlocked.filter(id => ACHIEVEMENTS.some(a => a.id === id)) : [],
        daily:parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {}
      };
      save(); applyTheme(); newSession(session.mode || 'classic'); toast('Backup imported.');
    } catch {
      toast('That backup file could not be imported.');
    } finally {
      els.importInput.value = '';
    }
  };

  const resetData = () => {
    if (!confirm('Reset all local stats, profiles, achievements, settings, and daily history?')) return;
    persistent = defaultState(); save(); applyTheme(); newSession('classic'); els.settingsDialog.close(); toast('Local data reset.');
  };

  els.form.addEventListener('submit', event => { event.preventDefault(); submitGuess(els.input.value); });

  document.querySelectorAll('.mode-card').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.mode === session.mode && !session.runFinished && !session.dailyLocked) return;
      endCurrentRunForRestart();
      newSession(button.dataset.mode);
    });
  });

  document.querySelectorAll('[data-power]').forEach(button =>
    button.addEventListener('click', () => usePower(button.dataset.power)));

  els.hintButton.addEventListener('click', useHint);
  els.nextButton.addEventListener('click', nextRound);
  els.shareButton.addEventListener('click', shareResult);
  els.newGameButton.addEventListener('click', () => { endCurrentRunForRestart(); newSession(session.mode); });
  els.playDailyButton.addEventListener('click', () => { endCurrentRunForRestart(); newSession('daily'); });
  $('players-button').addEventListener('click', () => { renderProfiles(); els.playersDialog.showModal(); });
  $('custom-game-button').addEventListener('click', () => els.customDialog.showModal());
  $('challenge-code-button').addEventListener('click', () => els.challengeDialog.showModal());
  $('tournament-button').addEventListener('click', () => { renderProfiles(); els.tournamentDialog.showModal(); });

  $('add-profile-button').addEventListener('click', () => {
    const name = els.profileNameInput.value.trim().replace(/[<>]/g,'').slice(0,18);
    if (!name) return toast('Enter a player name.');
    if (persistent.profiles.length >= 6) return toast('Six local players is the max.');
    if (persistent.profiles.some(p => p.name.toLowerCase() === name.toLowerCase())) return toast('That player already exists.');
    const id = `p-${Date.now().toString(36)}`;
    persistent.profiles.push(normalizeProfile({id,name,stats:{}}));
    persistent.activeProfileId = id;
    els.profileNameInput.value = '';
    save(); renderAll();
  });

  els.profileList.addEventListener('click', event => {
    const activate = event.target.closest('[data-activate-profile]');
    const remove = event.target.closest('[data-delete-profile]');
    if (activate) {
      persistent.activeProfileId = activate.dataset.activateProfile;
      save(); renderAll();
    }
    if (remove && persistent.profiles.length > 1) {
      persistent.profiles = persistent.profiles.filter(p => p.id !== remove.dataset.deleteProfile);
      if (!persistent.profiles.some(p => p.id === persistent.activeProfileId)) persistent.activeProfileId = persistent.profiles[0].id;
      save(); renderAll();
    }
  });

  $('start-custom-button').addEventListener('click', () => {
    const config = {
      max:Number(els.customMax.value), attempts:Number(els.customAttempts.value), seconds:Number(els.customSeconds.value),
      hints:Number(els.customHints.value), powers:els.customPowers.checked, jackpot:els.customJackpot.checked
    };
    if (config.max < 10 || config.max > 100000 || config.attempts < 3 || config.attempts > 50 ||
        config.seconds < 0 || config.seconds > 300 || config.hints < 0 || config.hints > 5) {
      return toast('Check your custom game settings.');
    }
    endCurrentRunForRestart();
    startCustom(config);
  });

  let pendingChallenge = null;
  $('generate-challenge-button').addEventListener('click', () => {
    const config = {
      max:Number(els.challengeMax.value), attempts:Number(els.challengeAttempts.value), hints:Number(els.challengeHints.value),
      seed:Math.floor(100000 + Math.random()*2000000000)
    };
    if (config.max < 10 || config.max > 100000 || config.attempts < 3 || config.attempts > 50 || config.hints < 0 || config.hints > 5) {
      return toast('Check your challenge settings.');
    }
    pendingChallenge = {...config, code:encodeChallenge(config)};
    els.generatedCode.textContent = pendingChallenge.code;
    els.generatedCodeBox.classList.remove('hidden');
  });

  $('copy-challenge-button').addEventListener('click', async () => {
    if (!pendingChallenge) return;
    try { await navigator.clipboard.writeText(pendingChallenge.code); toast('Challenge code copied.'); }
    catch { toast(pendingChallenge.code); }
  });

  $('play-generated-challenge-button').addEventListener('click', () => {
    if (!pendingChallenge) return;
    endCurrentRunForRestart();
    startChallenge({...pendingChallenge});
  });

  $('join-challenge-button').addEventListener('click', () => {
    const decoded = decodeChallenge(els.joinChallengeInput.value);
    if (!decoded) return toast('That challenge code is not valid.');
    endCurrentRunForRestart();
    startChallenge(decoded);
  });

  $('start-tournament-button').addEventListener('click', () => {
    const profileIds = [...els.tournamentPicker.querySelectorAll('input:checked')].map(input => input.value);
    const config = {
      profileIds, rounds:Number(els.tournamentRounds.value), max:Number(els.tournamentMax.value), attempts:Number(els.tournamentAttempts.value)
    };
    if (profileIds.length < 3) return toast('Choose at least 3 players.');
    if (config.rounds < 1 || config.rounds > 5 || config.max < 20 || config.max > 10000 || config.attempts < 3 || config.attempts > 20) {
      return toast('Check the tournament settings.');
    }
    endCurrentRunForRestart();
    startTournament(config);
  });

  $('stats-button').addEventListener('click', openStats);
  $('settings-button').addEventListener('click', openSettings);

  els.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    persistent.settings.theme = current === 'dark' ? 'light' : 'dark';
    save(); applyTheme();
  });
  els.themeSelect.addEventListener('change', () => { persistent.settings.theme = els.themeSelect.value; save(); applyTheme(); });
  els.soundToggle.addEventListener('change', () => { persistent.settings.sound = els.soundToggle.checked; save(); });
  els.hapticsToggle.addEventListener('change', () => { persistent.settings.haptics = els.hapticsToggle.checked; save(); });
  els.exportButton.addEventListener('click', exportData);
  els.importInput.addEventListener('change', () => importData(els.importInput.files?.[0]));
  els.resetDataButton.addEventListener('click', resetData);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredInstallPrompt = event; els.installButton.classList.remove('hidden');
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
