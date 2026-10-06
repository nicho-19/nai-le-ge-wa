(function () {
  'use strict';
  const logic = window.NaiWaLogic;
  const byId = id => document.getElementById(id);
  const typeMap = Object.fromEntries(logic.TYPES.map(type => [type.key, type]));
  const board = byId('board');
  const slot = byId('slot');
  const held = byId('held');
  const modal = byId('result-modal');
  let game;
  let pendingLevel = 1;
  const imageState = new Map();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lastRemaining;

  (function bgm() {
    const button = byId('bgm-button');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const bpm = 128;
    const stepTime = 60 / bpm / 2;
    // 《奶泡蹦蹦》: intro(1–2), A(3–6), A'(7–10), B(11–14), turn(15–16).
    // Each row is one 4/4 bar of eight eighth-note steps; null is a rest.
    const intro = [
      [null, 74, 78, null, 79, null, 78, null],
      [76, null, 74, null, 73, null, 76, null]
    ];
    const a = [
      [null, 74, 78, 79, null, 78, 76, 74],
      [76, null, 74, 71, 74, null, 76, 74],
      [null, 74, 78, 79, null, 78, 76, 74],
      [73, null, 76, 78, 76, null, 73, null]
    ];
    const aPrime = [
      [null, 78, 81, 83, null, 81, 79, 78],
      [76, null, 78, 76, 74, null, 76, 78],
      [null, 74, 78, 79, null, 81, 79, 78],
      [76, null, 73, 76, 78, null, 76, null]
    ];
    const b = [
      [76, null, null, 74, null, 71, null, null],
      [74, null, 70, null, 74, null, null, null],
      [78, null, null, 76, null, 74, null, null],
      [76, null, 73, null, 76, null, null, null]
    ];
    const turn = [
      [null, 74, 78, 79, null, 78, null, 76],
      [73, null, 76, null, 76, 73, null, null]
    ];
    const melody = [...intro, ...a, ...aPrime, ...b, ...turn].flat();
    if (melody.length !== 128) throw new Error('BGM melody must contain 128 steps');
    const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
    const progression = ['D', 'A', 'D', 'Bm', 'G', 'A', 'D', 'Bm',
      'G', 'A', 'Em', 'Gm', 'D', 'A', 'G', 'A7'];
    const chords = {
      D: { pad: [62, 66, 69], bass: 38 },
      A: { pad: [61, 64, 69], bass: 33 },
      Bm: { pad: [59, 62, 66], bass: 35 },
      G: { pad: [59, 62, 67], bass: 31 },
      Em: { pad: [59, 64, 67], bass: 28 },
      Gm: { pad: [58, 62, 67], bass: 31 },
      A7: { pad: [61, 64, 67], bass: 33 }
    };
    let preferred = true;
    try { preferred = localStorage.getItem('naiwa-bgm') !== 'off'; } catch (_) { /* Storage can be unavailable. */ }
    let activated = false;
    let context;
    let master;
    let hatNoise;
    let timer;
    let nextStep = 0;
    let nextTime = 0;

    function updateButton() {
      button.classList.toggle('active', preferred);
      button.setAttribute('aria-pressed', String(preferred));
      button.setAttribute('aria-label', preferred ? '音乐开' : '已静音');
      button.querySelector('.bgm-label').textContent = preferred ? '音乐开' : '已静音';
    }

    function makeContext() {
      if (context || !AudioContextClass) return;
      try { if ('audioSession' in navigator) navigator.audioSession.type = 'playback'; } catch (_) { /* Unsupported. */ }
      context = new AudioContextClass();
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000;
      master = context.createGain();
      master.gain.value = 0.32;
      filter.connect(master);
      master.connect(context.destination);
      master.input = filter;
      hatNoise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.03), context.sampleRate);
      const samples = hatNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }

    function tone(frequency, time, duration, volume, shape, attack = 0.012) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = shape;
      oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(volume, time + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(gain);
      gain.connect(master.input);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
    }

    function kick(time) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(130, time);
      oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.12);
      gain.gain.setValueAtTime(0.42, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(time);
      oscillator.stop(time + 0.12);
    }

    function hat(time) {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      source.buffer = hatNoise;
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      gain.gain.setValueAtTime(0.045, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(time);
      source.stop(time + 0.03);
    }

    function schedule() {
      while (nextTime < context.currentTime + 0.1) {
        const note = melody[nextStep];
        if (note !== null) tone(frequency(note), nextTime, stepTime * 0.86, 0.24, 'square');
        const beat = nextStep % 8;
        const bar = Math.floor(nextStep / 8);
        const bridge = bar >= 10 && bar <= 13;
        const chord = chords[progression[bar]];
        if (beat === 0 || beat === 4 || (!bridge && (beat === 3 || beat === 6))) {
          const bassNote = beat === 3 ? chord.bass + 7 : beat === 6 ? chord.bass + 2 : chord.bass;
          tone(frequency(bassNote), nextTime, stepTime * 0.76, 0.15, 'triangle');
        }
        if (beat === 0 || (beat === 4 && !bridge)) kick(nextTime);
        if (beat === 0 || (beat === 4 && !bridge && bar !== 15)) {
          chord.pad.forEach(pitch => tone(frequency(pitch), nextTime, stepTime * 2.2, 0.038, 'sine', 0.008));
        }
        if (bar > 0 && beat % 2 === 1 && (!bridge || beat === 3 || beat === 7) && nextStep !== 127) hat(nextTime);
        nextStep = (nextStep + 1) % melody.length;
        nextTime += stepTime;
      }
    }

    async function start() {
      if (!activated || !preferred || document.hidden || !AudioContextClass) return;
      makeContext();
      try { await context.resume(); } catch (_) { return; }
      if (context.state !== 'running') return;
      if (!preferred || document.hidden) { context.suspend(); return; }
      if (timer) return;
      nextTime = context.currentTime + 0.05;
      schedule();
      timer = setInterval(schedule, 25);
    }

    function pause() {
      clearInterval(timer);
      timer = undefined;
      if (context && context.state === 'running') context.suspend();
    }

    function activate() {
      activated = true;
      if (preferred && (!context || context.state !== 'running')) start();
    }

    button.addEventListener('click', () => {
      preferred = !preferred;
      try { localStorage.setItem('naiwa-bgm', preferred ? 'on' : 'off'); } catch (_) { /* Storage can be unavailable. */ }
      updateButton();
      if (preferred) start(); else pause();
    });
    document.addEventListener('pointerdown', activate);
    document.addEventListener('keydown', activate);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause(); else start();
    });
    updateButton();
  })();

  function fallback(label) {
    const circle = document.createElement('span');
    circle.className = 'tile-fallback';
    circle.textContent = label.charAt(0);
    circle.setAttribute('aria-hidden', 'true');
    return circle;
  }

  function frogImage(type) {
    const info = typeMap[type];
    if (imageState.get(type) === false) return fallback(info.label);
    const img = document.createElement('img');
    img.alt = info.label;
    img.draggable = false;
    img.addEventListener('error', () => {
      imageState.set(type, false);
      img.replaceWith(fallback(info.label));
    }, { once: true });
    img.src = `assets/${type}.png`;
    return img;
  }

  function preloadImages() {
    return new Promise(resolve => {
      let remaining = logic.TYPES.length;
      let finished = false;
      const complete = () => {
        if (!finished && --remaining === 0) {
          finished = true;
          clearTimeout(timeout);
          resolve();
        }
      };
      const timeout = setTimeout(() => {
        finished = true;
        resolve();
      }, 3000);
      logic.TYPES.forEach(type => {
        const img = new Image();
        img.onload = () => { imageState.set(type.key, true); complete(); };
        img.onerror = () => { imageState.set(type.key, false); complete(); };
        img.src = `assets/${type.key}.png`;
      });
    });
  }

  function tileElement(tile, place, blocked) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `tile${blocked ? ' blocked' : ''}`;
    element.dataset.id = tile.id;
    element.setAttribute('aria-label', `${typeMap[tile.type].label}奶蛙${blocked ? '，被压住' : ''}`);
    element.disabled = blocked;
    element.append(frogImage(tile.type));
    if (place === 'board') {
      element.style.left = `${tile.x * 100}%`;
      element.style.top = `${tile.y * 100}%`;
      element.style.zIndex = tile.layer;
      if (game.history.length === 0) {
        element.classList.add('deal-in');
        element.style.animationDelay = `${Math.min((game.tiles.length - tile.layer) * 8, 400)}ms`;
      }
    }
    return element;
  }

  function render() {
    const blocked = logic.blockedMap(game);
    board.replaceChildren(...game.tiles.filter(tile => tile.state === 'board')
      .map(tile => tileElement(tile, 'board', blocked[tile.id])));
    held.replaceChildren(...game.held.map(id => tileElement(game.tiles.find(tile => tile.id === id), 'held', false)));
    slot.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
      const cell = document.createElement('div');
      cell.className = 'slot-cell';
      if (game.slot[i]) cell.append(tileElement(game.tiles.find(tile => tile.id === game.slot[i]), 'slot', false));
      return cell;
    }));
    const remaining = game.tiles.filter(tile => tile.state === 'board').length;
    const badge = byId('remaining-count');
    badge.textContent = remaining;
    if (lastRemaining !== undefined && lastRemaining !== remaining && !reducedMotion.matches) {
      badge.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' },
        { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
    }
    lastRemaining = remaining;
    const percent = Math.round(game.tiles.filter(tile => tile.state === 'gone').length / game.tiles.length * 100);
    byId('progress-fill').style.transform = `scaleX(${percent / 100})`;
    document.querySelector('.progress-track').setAttribute('aria-valuenow', String(percent));
    slot.classList.toggle('slot-danger', game.slot.length >= 5);
    byId('slot-warning').textContent = game.slot.length === 6 ? '⚠ 只剩最后一格！'
      : game.slot.length === 5 ? '槽位快满了' : '';
    document.querySelectorAll('.level-button').forEach(button => {
      button.classList.toggle('active', Number(button.dataset.level) === game.level);
      button.setAttribute('aria-pressed', String(Number(button.dataset.level) === game.level));
    });
    [['undo-button', 'undo', game.history.length > 0], ['shuffle-button', 'shuffle', game.status === 'playing'],
      ['move-button', 'moveOut', game.status === 'playing' && game.slot.length > 0]].forEach(([id, name, possible]) => {
      const button = byId(id);
      button.disabled = game.tools[name] || !possible;
      button.querySelector('small').textContent = game.tools[name] ? '已用' : '剩 1 次';
    });
    renderResult();
  }

  function renderResult() {
    if (game.status === 'playing') { modal.hidden = true; return; }
    modal.hidden = false;
    byId('result-frog').replaceChildren(frogImage(game.status === 'win' ? 'main-stance' : 'shocked'));
    byId('result-title').textContent = game.status === 'win' ? '蛙！你赢啦！' : '池塘挤满啦';
    const unused = [!game.tools.undo && game.history.length && '撤销', !game.tools.shuffle && '洗牌',
      !game.tools.moveOut && '移出'].filter(Boolean);
    byId('result-message').textContent = game.status === 'win'
      ? '一池塘蛙都被你凑齐了！'
      : `七格槽位已满。${unused.length ? `重玩时记得试试：${unused.join('、')}。` : '再试一次，先凑齐同类奶蛙吧！'}`;
    const actions = byId('result-actions');
    actions.replaceChildren();
    if (game.status === 'lose' && !game.tools.undo && game.history.length) {
      const undo = document.createElement('button');
      undo.textContent = '撤销这一步';
      undo.addEventListener('click', () => { logic.useUndo(game); render(); });
      actions.append(undo);
    }
    const replay = document.createElement('button');
    replay.textContent = '重玩本关';
    replay.className = 'secondary';
    replay.addEventListener('click', () => reset(game.level, game.seed));
    actions.append(replay);
    if (game.status === 'win' && game.level === 1) {
      const next = document.createElement('button');
      next.textContent = '下一关';
      next.addEventListener('click', () => reset(2, Date.now()));
      actions.prepend(next);
    }
  }

  function flyToSlot(ghost, start, id) {
    const target = slot.querySelector(`[data-id="${id}"]`)?.getBoundingClientRect() ||
      slot.children[Math.min(game.slot.length, 6)].getBoundingClientRect();
    ghost.classList.remove('blocked');
    ghost.classList.add('flying-tile');
    ghost.disabled = true;
    ghost.style.left = `${start.left}px`;
    ghost.style.top = `${start.top}px`;
    ghost.style.width = `${start.width}px`;
    ghost.style.height = `${start.height}px`;
    document.body.append(ghost);
    if (reducedMotion.matches) { ghost.remove(); return; }
    ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${(target.left - start.left) * .52}px,${(target.top - start.top) * .35 - 18}px) scale(.92)`, opacity: .9, offset: .48 },
      { transform: `translate(${target.left - start.left}px,${target.top - start.top}px) scale(${target.width / start.width})`, opacity: .15 }
    ], { duration: 260, easing: 'cubic-bezier(.22,.72,.24,1)' }).onfinish = () => ghost.remove();
    setTimeout(() => ghost.remove(), 300);
  }

  function matchFeedback(beforeSlot, clickedId, clickedRect, targetRect) {
    const removed = [...beforeSlot.keys(), clickedId].filter(id =>
      game.tiles.find(tile => tile.id === id)?.state === 'gone');
    if (removed.length !== 3 || reducedMotion.matches) return;
    const bounds = slot.getBoundingClientRect();
    removed.forEach((id, i) => {
      const rect = beforeSlot.get(id) || targetRect || clickedRect;
      const tile = game.tiles.find(item => item.id === id);
      const spark = tileElement(tile, 'slot', false);
      spark.classList.add('match-ghost');
      spark.style.left = `${rect.left}px`;
      spark.style.top = `${rect.top}px`;
      spark.style.width = `${rect.width}px`;
      spark.style.height = `${rect.height}px`;
      document.body.append(spark);
      spark.animate([
        { transform: 'translateY(0) scale(1)', opacity: 1 },
        { transform: 'translateY(-12px) scale(1.13)', opacity: .9, offset: .42 },
        { transform: 'translateY(-22px) scale(.62)', opacity: 0 }
      ], { duration: 240, easing: 'ease-out', delay: i * 12 }).onfinish = () => spark.remove();
      setTimeout(() => spark.remove(), 290);
    });
    const center = beforeSlot.get(removed[0]) || clickedRect;
    for (let i = 0; i < 7; i++) {
      const particle = document.createElement('span');
      particle.className = 'match-particle';
      particle.style.left = `${center.left - bounds.left + center.width / 2}px`;
      particle.style.top = `${center.top - bounds.top - 5}px`;
      slot.append(particle);
      const angle = (i / 7) * Math.PI * 2;
      particle.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * 27}px,${Math.sin(angle) * 16 - 22}px) scale(.15)`, opacity: 0 }
      ], { duration: 240, easing: 'ease-out' }).onfinish = () => particle.remove();
      setTimeout(() => particle.remove(), 280);
    }
  }

  function clickWithFeedback(click, tile) {
    const id = tile.dataset.id;
    const start = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true);
    const beforeSlot = new Map(game.slot.map((slotId, i) =>
      [slotId, slot.children[i].getBoundingClientRect()]));
    const clickedType = game.tiles.find(item => item.id === id).type;
    const lastMatch = game.slot.reduce((last, slotId, i) =>
      game.tiles.find(item => item.id === slotId).type === clickedType ? i : last, -1);
    const targetRect = slot.children[Math.min(lastMatch < 0 ? game.slot.length : lastMatch + 1, 6)]?.getBoundingClientRect();
    if (click(game, id)) {
      render();
      flyToSlot(ghost, start, id);
      matchFeedback(beforeSlot, id, start, targetRect);
    }
  }

  function reset(level, seed) {
    game = logic.createGame(level, seed);
    lastRemaining = undefined;
    render();
    if (!reducedMotion.matches) board.animate([
      { opacity: 0, transform: 'translateY(9px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 280, easing: 'ease-out' });
  }
  board.addEventListener('click', event => {
    if (!game) return;
    const tile = event.target.closest('.tile');
    if (!tile) return;
    clickWithFeedback(logic.clickTile, tile);
  });
  held.addEventListener('click', event => {
    if (!game) return;
    const tile = event.target.closest('.tile');
    if (!tile) return;
    clickWithFeedback(logic.clickHeld, tile);
  });
  byId('undo-button').addEventListener('click', () => { if (game && logic.useUndo(game)) render(); });
  byId('shuffle-button').addEventListener('click', () => { if (game && logic.useShuffle(game, Date.now())) render(); });
  byId('move-button').addEventListener('click', () => { if (game && logic.useMoveOut(game)) render(); });
  byId('restart-button').addEventListener('click', () => { if (game) reset(game.level, game.seed); });
  document.querySelectorAll('.level-button').forEach(button => button.addEventListener('click', () => {
    pendingLevel = Number(button.dataset.level);
    if (game) reset(pendingLevel, Date.now());
  }));
  preloadImages().then(() => reset(pendingLevel, Date.now()));
})();
