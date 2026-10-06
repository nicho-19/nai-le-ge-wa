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
