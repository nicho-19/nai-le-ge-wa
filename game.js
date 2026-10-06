(function () {
  'use strict';
  const logic = window.NaiWaLogic;
  const byId = id => document.getElementById(id);
  const typeMap = Object.fromEntries(logic.TYPES.map(type => [type.key, type]));
  const board = byId('board');
  const slot = byId('slot');
  const held = byId('held');
  const modal = byId('result-modal');
  let game = logic.createGame(1, Date.now());

  function frogSvg(type) {
    const eyes = type === 'sleep'
      ? '<path d="M42 27q5 5 10 0M58 27q5 5 10 0" fill="none" stroke="#577357" stroke-width="2.4" stroke-linecap="round"/>'
      : '<circle cx="46" cy="27" r="5.6" fill="#dff2ad" stroke="#568b5e" stroke-width="2.2"/><circle cx="62" cy="27" r="5.6" fill="#dff2ad" stroke="#568b5e" stroke-width="2.2"/><circle cx="47" cy="28" r="1.9" fill="#304639"/><circle cx="63" cy="28" r="1.9" fill="#304639"/>';
    const mouth = type === 'laugh'
      ? '<path d="M49 39q7 13 15 0z" fill="#8f4244" stroke="#775148" stroke-width="1.5"/><path d="M53 44q4-2 8 0" fill="none" stroke="#ec9690" stroke-width="2"/>'
      : type === 'cry'
        ? '<path d="M50 44q5-6 11 0" fill="none" stroke="#705d4e" stroke-width="1.8" stroke-linecap="round"/>'
        : '<path d="M51 39q5 4 10 0" fill="none" stroke="#6b654c" stroke-width="1.8" stroke-linecap="round"/>';
    const before = {
      straw: '<path d="M21 20q26-12 61 0l-4 5H25z" fill="#f2bd54" stroke="#ab8b43" stroke-width="2"/><path d="M36 17V5q18-8 34 1v11" fill="#f6ce67" stroke="#ab8b43" stroke-width="2"/><path d="M37 13h32" stroke="#d88755" stroke-width="3"/>',
      tophat: '<path d="M34 20V2h37v18M27 20h52v5H27z" fill="#303843" stroke="#202a30" stroke-width="2"/><path d="M35 15h35" stroke="#b94e4c" stroke-width="4"/>',
      scarf: '<path d="M29 26q25-20 51 1l-3 7q-24-15-45 1z" fill="#d55458" stroke="#a84345" stroke-width="2"/><path d="M68 28l14 17-10 1-8-16" fill="#d55458"/>',
      sleep: '<path d="M34 21Q39-3 70 9l11 16q-23-9-47 2z" fill="#7faee0" stroke="#587db3" stroke-width="2"/><circle cx="82" cy="25" r="5" fill="#e5f4fa"/>',
      leaf: '<path d="M27 19Q50-2 79 17Q55 32 27 19z" fill="#74b66d" stroke="#498f59" stroke-width="2"/><path d="M31 19q25 2 43-3M50 18l-6-9M56 18l7-9" fill="none" stroke="#a8d68d" stroke-width="2"/>',
      chef: '<path d="M35 20V9q-4-13 10-10 7-10 17-1 15-3 13 11v11z" fill="#fffef7" stroke="#c9d6cd" stroke-width="2"/><path d="M36 17h38" stroke="#c9d6cd" stroke-width="2"/>',
      crown: '<path d="M32 23L28 5l15 9 10-12 10 12 16-9-5 18z" fill="#f3c655" stroke="#ad8c38" stroke-width="2"/><circle cx="53" cy="16" r="3" fill="#e68a73"/>'
    }[type] || '';
    const after = {
      tophat: '<path d="M44 52l9 4-9 5zM62 52l-9 4 9 5z" fill="#c95054"/><circle cx="53" cy="56" r="2" fill="#a63c43"/>',
      shades: '<path d="M37 25h16l2 9q-6 8-15 0zM57 25h16l-3 9q-8 8-13 0z" fill="#2d3942" stroke="#192832" stroke-width="2"/><path d="M53 28h4" stroke="#192832" stroke-width="2"/>',
      sleep: '<text x="75" y="18" font-size="14" font-weight="900" fill="#6292cb">Zzz</text>',
      cry: '<path d="M37 35q-6 9 1 11 7-2-1-11zM72 35q-6 9 1 11 7-2-1-11z" fill="#7bc8e6" stroke="#62a9cf" stroke-width="1"/>',
      angry: '<ellipse cx="35" cy="39" rx="6" ry="4" fill="#eaa39a" opacity=".65"/><ellipse cx="73" cy="39" rx="6" ry="4" fill="#eaa39a" opacity=".65"/><path d="M39 19l12 5M68 19l-12 5" stroke="#826253" stroke-width="3" stroke-linecap="round"/><path d="M39 12q-5-5 0-9M52 11q-5-5 0-9M65 12q-5-5 0-9" fill="none" stroke="#d6aaa2" stroke-width="2"/>',
      bottle: '<path d="M44 60h19v24q-10 8-19 0z" fill="#f5fbff" stroke="#8fbbc4" stroke-width="2"/><path d="M47 57h13v5H47z" fill="#9dd0e7"/><path d="M50 52h7v5h-7z" fill="#f9d7a4"/><path d="M43 72q-8 0-8 6M64 72q8 0 8 6" fill="none" stroke="#dfc876" stroke-width="6" stroke-linecap="round"/><path d="M46 72h15" stroke="#b7dcdf" stroke-width="2"/>',
      winter: '<path d="M31 47q23 11 45 0l-1 9q-21 10-43 0z" fill="#73add3" stroke="#5785ad" stroke-width="2"/><path d="M68 52l9 27-9 1-7-23" fill="#73add3" stroke="#5785ad" stroke-width="2"/><path d="M69 73h7" stroke="#c2e3ee" stroke-width="2"/>',
      pack: '<path d="M71 56q18-4 17 11v21q-10 7-17-1z" fill="#eaa15e" stroke="#ac7444" stroke-width="2"/><path d="M69 51q11 6 11 24M84 70h-9" fill="none" stroke="#c9814c" stroke-width="4"/>',
      scarf: '<path d="M32 47l-4 22 9-3 5-18" fill="#d55458" stroke="#a84345" stroke-width="2"/>'
    }[type] || '';
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${typeMap[type].label}奶蛙">
      <path d="M20 54q-12 0-11 13 2 10 13 5M81 54q12 0 11 13-2 10-13 5" fill="#f5e4a6" stroke="#d8c47c" stroke-width="2" stroke-linecap="round"/>
      <path d="M51 15C25 12 19 31 20 52 10 80 27 96 53 96c27 0 43-17 31-44 1-22-10-39-33-37z" fill="#F8E9AF" stroke="#d9c57e" stroke-width="2.5"/>
      <ellipse cx="53" cy="72" rx="29" ry="23" fill="#fffdf2" stroke="#eee8d3" stroke-width="1.5"/>
      ${before}${eyes}${mouth}${after}
      <path d="M29 93q8 5 15 2M65 95q8 3 14-3" fill="none" stroke="#d7c178" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  function tileElement(tile, place, blocked) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `tile${blocked ? ' blocked' : ''}`;
    element.dataset.id = tile.id;
    element.style.setProperty('--tile-color', typeMap[tile.type].color);
    element.setAttribute('aria-label', `${typeMap[tile.type].label}奶蛙${blocked ? '，被压住' : ''}`);
    element.disabled = blocked;
    element.innerHTML = `${frogSvg(tile.type)}<span class="tile-label">${typeMap[tile.type].label}</span>`;
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
    byId('result-frog').innerHTML = frogSvg(game.status === 'win' ? 'crown' : 'cry');
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
    const tile = event.target.closest('.tile');
    if (!tile) return;
    const start = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true);
    const id = tile.dataset.id;
    if (logic.clickTile(game, id)) { render(); flyToSlot(ghost, start, id); }
  });
  held.addEventListener('click', event => {
    const tile = event.target.closest('.tile');
    if (!tile) return;
    const start = tile.getBoundingClientRect();
    const ghost = tile.cloneNode(true);
    const id = tile.dataset.id;
    if (logic.clickHeld(game, id)) { render(); flyToSlot(ghost, start, id); }
  });
  byId('undo-button').addEventListener('click', () => { if (logic.useUndo(game)) render(); });
  byId('shuffle-button').addEventListener('click', () => { if (logic.useShuffle(game, Date.now())) render(); });
  byId('move-button').addEventListener('click', () => { if (logic.useMoveOut(game)) render(); });
  byId('restart-button').addEventListener('click', () => reset(game.level, game.seed));
  document.querySelectorAll('.level-button').forEach(button => button.addEventListener('click', () => reset(Number(button.dataset.level), Date.now())));
  render();
})();
