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

  (function bgm() {
    const button = byId('bgm-button');
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const bpm = 132;
    const stepTime = 60 / bpm / 2;
    const motif = [0, 0, 2, null, 4, 4, 5, 4, 2, 2, 1, null, 2, 4, 2, 0];
    const answer = [2, 2, 4, null, 5, 5, 4, 2, 1, 1, 2, null, 3, 4, 3, 2];
    const variation = [0, 0, 3, null, 5, 5, 4, 3, 2, 2, 4, null, 5, 4, 2, 1];
    const ending = [2, 2, 4, null, 5, 5, 4, 2, 1, 1, 2, null, 1, 0, 0, 0];
    const melody = [...motif, ...motif, ...answer, ...motif, ...motif, ...variation,
      ...motif, ...ending];
    if (melody.length !== 128) throw new Error('BGM melody must contain 128 steps');
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const progression = Array.from({ length: 16 }, (_, bar) => ['C', 'G', 'Am', 'F'][bar % 4]);
    const chords = {
      C: { pad: [261.63, 329.63, 392], bass: 130.81 },
      G: { pad: [196, 246.94, 293.66], bass: 98 },
      Am: { pad: [220, 261.63, 329.63], bass: 110 },
      F: { pad: [174.61, 220, 261.63], bass: 87.31 },
      Dm: { pad: [146.83, 174.61, 220], bass: 73.42 }
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
      filter.frequency.value = 3200;
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
      gain.gain.setValueAtTime(0.5, time);
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
      gain.gain.setValueAtTime(0.06, time);
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
        if (note !== null) {
          const held = melody[(nextStep + 1) % melody.length] === null;
          tone(notes[note], nextTime, stepTime * (held ? 1.8 : 0.86), 0.30, 'square');
        }
        const beat = nextStep % 8;
        const chord = chords[progression[Math.floor(nextStep / 8)]];
        tone(chord.bass * (nextStep % 2 ? 1.5 : 1), nextTime, stepTime * 0.8, 0.16, 'triangle');
        if (beat === 0 || beat === 4) {
          kick(nextTime);
          chord.pad.forEach(frequency => tone(frequency, nextTime, stepTime * 2, 0.045, 'sine', 0.008));
        }
        if (beat % 2 === 1) hat(nextTime);
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
    byId('remaining-count').textContent = game.tiles.filter(tile => tile.state === 'board').length;
    byId('slot-warning').textContent = game.slot.length === 6 ? '⚠ 只剩最后一格！' : '';
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
    ghost.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${target.left - start.left}px,${target.top - start.top}px) scale(${target.width / start.width})`, opacity: .15 }
    ], { duration: 260, easing: 'ease-in-out' }).onfinish = () => ghost.remove();
    setTimeout(() => ghost.remove(), 300);
  }

  function reset(level, seed) { game = logic.createGame(level, seed); render(); }
  board.addEventListener('click', event => {
    if (!game) return;
    const tile = event.target.closest('.tile');
    if (!tile) return;
    const start = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true);
    const id = tile.dataset.id;
    if (logic.clickTile(game, id)) { render(); flyToSlot(ghost, start, id); }
  });
  held.addEventListener('click', event => {
    if (!game) return;
    const tile = event.target.closest('.tile');
    if (!tile) return;
    const start = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true);
    const id = tile.dataset.id;
    if (logic.clickHeld(game, id)) { render(); flyToSlot(ghost, start, id); }
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
