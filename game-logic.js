(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NaiWaLogic = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TYPES = Object.freeze([
    { key: 'main-stance', label: '站姿招手' },
    { key: 'thinking', label: '托腮思考' },
    { key: 'pray-wings', label: '天使合掌' },
    { key: 'shocked', label: '抱头震惊' },
    { key: 'monk', label: '和尚合掌' },
    { key: 'belly-hold-a', label: '抱肚站立' },
    { key: 'profile-stand', label: '侧面站' },
    { key: 'laugh-headback', label: '仰头大笑' },
    { key: 'santa-lie', label: '圣诞躺笑' },
    { key: 'point-laugh', label: '指人笑' },
    { key: 'peace-tongue', label: '比耶吐舌' },
    { key: 'running', label: '跑步' },
    { key: 'dancing', label: '跳舞' },
    { key: 'sleeping', label: '睡觉' },
    { key: 'chef', label: '厨师服' },
    { key: 'superhero', label: '超人披风' }
  ]);
  const TILE_WIDTH = 0.16;
  const TILE_HEIGHT = 0.17;

  function rng(seed) {
    let value = (Number(seed) || 0) >>> 0;
    return function () {
      value = (value + 0x6D2B79F5) >>> 0;
      let t = Math.imul(value ^ (value >>> 15), 1 | value);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, random) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function round(value) { return Math.round(value * 10000) / 10000; }

  function position(level, index, random) {
    if (level === 1) {
      const col = index % 4;
      const row = Math.floor(index / 4);
      return { x: round(.065 + col * .205 + (random() - .5) * .018),
        y: round(.03 + row * .15 + (random() - .5) * .018) };
    }
    // 两堆分开散布，保留足够重叠供玩家逐层揭开。
    const heap = random() < .56 ? .26 : .66;
    const x = heap + (random() + random() + random() - 1.5) * .24;
    const y = .42 + (random() + random() + random() - 1.5) * .30;
    return { x: round(clamp(x, .01, .83)), y: round(clamp(y, .01, .82)) };
  }

  function levelTwoGame(seed, types, random) {
    const solutionOrder = [];
    const tiles = types.map((type, i) => {
      const id = `tile-${i}`;
      solutionOrder.push(id);
      return { id, type, ...position(2, i, random), layer: types.length - i, state: 'board' };
    });
    return { level: 2, seed, tiles, solutionOrder, slot: [], held: [],
      tools: { undo: false, shuffle: false, moveOut: false }, status: 'playing', history: [] };
  }

  function createLevelTwo(seed) {
    const random = rng(seed);
    for (let attempt = 0; attempt < 200; attempt++) {
      const remaining = new Map(TYPES.map(type => [type.key, 9]));
      const types = [];
      while (remaining.size) {
        const k = Math.min(remaining.size, random() < .7 ? 3 : 2);
        const wave = shuffle([...remaining.keys()], random).slice(0, k);
        shuffle(wave.flatMap(type => [type, type]), random).forEach(type => types.push(type));
        shuffle(wave, random).forEach(type => types.push(type));
        wave.forEach(type => {
          const left = remaining.get(type) - 3;
          if (left) remaining.set(type, left);
          else remaining.delete(type);
        });
      }
      const game = levelTwoGame(seed, types, random);
      // 波次交错解序先经实际规则模拟验收；任何 seed 都只返回有解牌局。
      if (solveByOrder(game)) return game;
    }
    // 极端情况下退回成组连续解序，仍保留 144 张和第 2 关位置参数。
    const groups = shuffle(TYPES.flatMap(type => Array(3).fill(type.key)), random);
    return levelTwoGame(seed, groups.flatMap(type => [type, type, type]), random);
  }

  function createGame(level, seed) {
    if (level !== 1 && level !== 2) throw new RangeError('关卡只能是 1 或 2');
    if (level === 2) return createLevelTwo(seed);
    const random = rng(seed);
    const groups = [];
    const available = level === 1 ? TYPES.slice(0, 8) : TYPES;
    available.forEach(type => {
      const copies = level === 1 ? 3 : 6; // 24 / 96 张，均为 3 的倍数
      for (let n = 0; n < copies / 3; n++) groups.push(type.key);
    });
    shuffle(groups, random);
    const solutionOrder = [];
    const tiles = [];
    groups.forEach(type => {
      for (let n = 0; n < 3; n++) {
        const id = `tile-${solutionOrder.length}`;
        solutionOrder.push(id);
        tiles.push({ id, type, x: 0, y: 0, layer: 0, state: 'board' });
      }
    });
    // 不变量：解序中每连续三张同型，选入槽后立即消除，槽位最多占两格。
    // 解序越早 layer 越大；因此按解序选牌时，上方任何重叠牌都已离开棋盘。
    tiles.forEach((tile, i) => {
      Object.assign(tile, position(level, i, random));
      tile.layer = tiles.length - i;
    });
    return { level, seed, tiles, solutionOrder, slot: [], held: [],
      tools: { undo: false, shuffle: false, moveOut: false }, status: 'playing', history: [] };
  }

  function overlaps(a, b) {
    return a.x < b.x + TILE_WIDTH && a.x + TILE_WIDTH > b.x &&
      a.y < b.y + TILE_HEIGHT && a.y + TILE_HEIGHT > b.y;
  }

  function blockedMap(game) {
    const board = game.tiles.filter(tile => tile.state === 'board');
    const result = {};
    board.forEach(tile => { result[tile.id] = board.some(other => other.layer > tile.layer && overlaps(tile, other)); });
    return result;
  }

  function snapshot(game) {
    return { states: game.tiles.map(tile => ({ type: tile.type, state: tile.state })),
      slot: [...game.slot], held: [...game.held], solutionOrder: [...game.solutionOrder],
      tools: { ...game.tools }, status: game.status };
  }

  function remember(game) { game.history.push(snapshot(game)); }
  function tileById(game, id) { return game.tiles.find(tile => tile.id === id); }

  function enterSlot(game, tile) {
    tile.state = 'slot';
    const last = game.slot.reduce((found, id, i) => tileById(game, id).type === tile.type ? i : found, -1);
    game.slot.splice(last < 0 ? game.slot.length : last + 1, 0, tile.id);
    const matching = game.slot.filter(id => tileById(game, id).type === tile.type);
    if (matching.length >= 3) {
      const removed = new Set(matching.slice(0, 3));
      game.slot = game.slot.filter(id => !removed.has(id));
      removed.forEach(id => { tileById(game, id).state = 'gone'; });
    }
    if (game.slot.length >= 7) game.status = 'lose';
    else if (game.tiles.every(item => item.state === 'gone')) game.status = 'win';
    return true;
  }

  function clickTile(game, id) {
    const tile = tileById(game, id);
    if (game.status !== 'playing' || !tile || tile.state !== 'board' || blockedMap(game)[id]) return false;
    remember(game);
    return enterSlot(game, tile);
  }

  function clickHeld(game, id) {
    const tile = tileById(game, id);
    if (game.status !== 'playing' || !tile || tile.state !== 'held') return false;
    remember(game);
    game.held.splice(game.held.indexOf(id), 1);
    return enterSlot(game, tile);
  }

  function useUndo(game) {
    if (game.tools.undo || !game.history.length) return false;
    const previous = game.history.pop();
    game.tiles.forEach((tile, i) => { tile.type = previous.states[i].type; tile.state = previous.states[i].state; });
    game.slot = previous.slot;
    game.held = previous.held;
    game.solutionOrder = previous.solutionOrder;
    game.tools = previous.tools;
    game.tools.undo = true;
    game.status = previous.status;
    return true;
  }

  function useMoveOut(game) {
    if (game.status !== 'playing' || game.tools.moveOut || game.slot.length === 0) return false;
    remember(game);
    const moved = game.slot.splice(0, 3);
    moved.forEach(id => { tileById(game, id).state = 'held'; });
    game.held.push(...moved);
    game.tools.moveOut = true;
    return true;
  }

  function useShuffle(game, seed) {
    if (game.status !== 'playing' || game.tools.shuffle) return false;
    const board = game.tiles.filter(tile => tile.state === 'board').sort((a, b) => b.layer - a.layer);
    if (board.length === 0) return false;
    remember(game);
    const random = rng(seed);
    const counts = new Map();
    board.forEach(tile => counts.set(tile.type, (counts.get(tile.type) || 0) + 1));
    const types = shuffle([...new Set([...counts.keys(), ...game.held.map(id => tileById(game, id).type)])], random);
    // 槽内未完成的类型先补齐；板上各类型数量保持不变。整组三张仍连续。
    types.sort((a, b) => game.slot.filter(id => tileById(game, id).type === b).length -
      game.slot.filter(id => tileById(game, id).type === a).length);
    const orderedTypes = [];
    types.forEach(type => { for (let i = 0; i < (counts.get(type) || 0); i++) orderedTypes.push(type); });
    board.forEach((tile, i) => { tile.type = orderedTypes[i]; });
    // 同类型的暂存牌与棋盘牌相邻排列，先补齐槽内已有的类型。
    game.solutionOrder = types.flatMap(type => [
      ...game.held.filter(id => tileById(game, id).type === type),
      ...board.filter(tile => tile.type === type).map(tile => tile.id)
    ]);
    game.tools.shuffle = true;
    return true;
  }

  function solveByOrder(game) {
    const copy = JSON.parse(JSON.stringify(game));
    copy.history = [];
    if (copy.status === 'win') return true;
    if (copy.status !== 'playing') return false;
    for (const id of copy.solutionOrder) {
      const tile = tileById(copy, id);
      if (!tile || tile.state === 'gone' || tile.state === 'slot') continue;
      const success = tile.state === 'held' ? clickHeld(copy, id) : clickTile(copy, id);
      if (!success) return false;
    }
    return copy.status === 'win';
  }

  return { TYPES, TILE_WIDTH, TILE_HEIGHT, createGame, blockedMap, clickTile, clickHeld,
    useUndo, useShuffle, useMoveOut, solveByOrder };
});
