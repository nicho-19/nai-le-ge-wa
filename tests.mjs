import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const logic = require('./game-logic.js');
const { TYPES, createGame, blockedMap, clickTile, clickHeld, useUndo,
  useShuffle, useMoveOut, solveByOrder } = logic;

function counts(tiles, state) {
  const result = {};
  for (const tile of tiles) if (!state || tile.state === state) result[tile.type] = (result[tile.type] || 0) + 1;
  return result;
}

function smallGame(types) {
  const game = createGame(1, 1);
  game.tiles = types.map((type, i) => ({ id: `t${i}`, type, x: i * .2, y: 0,
    layer: types.length - i, state: 'board' }));
  game.solutionOrder = game.tiles.map(tile => tile.id);
  game.slot = [];
  game.held = [];
  game.history = [];
  return game;
}

const expectedTypes = [
  'main-stance', 'laugh-closeup', 'thinking', 'pray-wings', 'shocked', 'monk',
  'belly-hold-a', 'profile-stand', 'laugh-headback', 'santa-lie', 'point-laugh',
  'peace-tongue', 'running', 'dancing', 'sleeping', 'chef', 'superhero'
];
assert.deepEqual(TYPES.map(type => type.key), expectedTypes);
assert.equal(TYPES.length, 17);
for (const type of TYPES) assert.equal(existsSync(new URL(`./assets/${type.key}.png`, import.meta.url)), true);
console.log('✓ 17 种牌型顺序与图片文件一一对应');
for (const level of [1, 2]) {
  for (let seed = 0; seed < (level === 2 ? 25 : 8); seed++) {
    const game = createGame(level, seed);
    assert.equal(game.tiles.length, level === 1 ? 24 : 102);
    assert.equal(game.solutionOrder.length, game.tiles.length);
    assert.equal(new Set(game.solutionOrder).size, game.tiles.length);
    assert.deepEqual(createGame(level, seed), game, '同一 seed 应生成相同牌局');
    const expectedCounts = Object.fromEntries(
      (level === 1 ? expectedTypes.slice(0, 8) : expectedTypes).map(type => [type, level === 1 ? 3 : 6])
    );
    assert.deepEqual(counts(game.tiles), expectedCounts);
    assert.equal(solveByOrder(game), true, `关卡 ${level} seed ${seed} 应有解`);
  }
}
console.log('✓ 两关张数、类型计数、复现性及 25 个招牌关种子的解序');

{
  const game = smallGame(['main-stance', 'laugh-closeup']);
  game.tiles[0].x = game.tiles[1].x = .2;
  game.tiles[0].layer = 1;
  game.tiles[1].layer = 2;
  assert.equal(blockedMap(game).t0, true);
  assert.equal(clickTile(game, 't0'), false);
  assert.equal(clickTile(game, 't1'), true);
  assert.equal(blockedMap(game).t0, false);
  assert.equal(clickTile(game, 't0'), true);
}
console.log('✓ 上层重叠遮挡与揭开后可点击');

{
  const game = smallGame(['main-stance', 'main-stance', 'main-stance']);
  assert.equal(clickTile(game, 't0'), true);
  assert.equal(clickTile(game, 't1'), true);
  const beforeThird = JSON.parse(JSON.stringify({ tiles: game.tiles, slot: game.slot, held: game.held }));
  assert.equal(clickTile(game, 't2'), true);
  assert.equal(game.slot.length, 0);
  assert.ok(game.tiles.every(tile => tile.state === 'gone'));
  assert.equal(game.status, 'win');
  assert.equal(useUndo(game), true);
  assert.deepEqual({ tiles: game.tiles, slot: game.slot, held: game.held }, beforeThird);
  assert.equal(game.status, 'playing');
  assert.equal(game.tools.undo, true);
  assert.equal(useUndo(game), false);
}
console.log('✓ 三消、消除后撤销恢复三张牌、撤销限用一次');

{
  const game = smallGame(['main-stance', 'laugh-closeup']);
  const before = JSON.parse(JSON.stringify({ tiles: game.tiles, slot: game.slot,
    held: game.held, status: game.status }));
  assert.equal(clickTile(game, 't0'), true);
  assert.equal(useUndo(game), true);
  assert.deepEqual({ tiles: game.tiles, slot: game.slot, held: game.held, status: game.status }, before);
}
console.log('✓ 点击后撤销恢复牌、槽与胜负状态');

{
  const game = smallGame(TYPES.slice(0, 7).map(type => type.key));
  for (const tile of game.tiles) assert.equal(clickTile(game, tile.id), true);
  assert.equal(game.slot.length, 7);
  assert.equal(game.status, 'lose');
  assert.equal(clickTile(game, 't0'), false);
}
console.log('✓ 七格占满判负');

{
  const game = createGame(2, 1919);
  const before = counts(game.tiles, 'board');
  assert.equal(useShuffle(game, 45), true);
  assert.deepEqual(counts(game.tiles, 'board'), before, '洗牌前后棋盘类型计数必须守恒');
  assert.equal(game.tools.shuffle, true);
  assert.equal(solveByOrder(game), true, '洗牌后的新解序必须可胜利');
  assert.equal(useShuffle(game, 46), false);
  assert.equal(useUndo(game), true);
  assert.equal(game.tools.shuffle, false, '撤销道具操作应恢复道具用量');
}
console.log('✓ 洗牌计数守恒、仍有解、限用一次与道具撤销');

{
  const game = createGame(2, 311);
  for (const id of game.solutionOrder.slice(0, 5)) assert.equal(clickTile(game, id), true);
  const before = counts(game.tiles, 'board');
  assert.equal(useShuffle(game, 83), true);
  assert.deepEqual(counts(game.tiles, 'board'), before);
  assert.equal(solveByOrder(game), true, '中途洗牌也应有新解序');
}
console.log('✓ 中途洗牌的棋盘计数与新解序');

{
  const game = smallGame(['main-stance', 'laugh-closeup', 'main-stance', 'main-stance', 'laugh-closeup', 'laugh-closeup']);
  for (const id of ['t0', 't1', 't2']) assert.equal(clickTile(game, id), true);
  assert.deepEqual(game.slot, ['t0', 't2', 't1'], '同类应相邻聚拢');
  assert.equal(useMoveOut(game), true);
  assert.equal(game.slot.length, 0);
  assert.equal(game.held.length, 3);
  assert.ok(game.tiles.slice(0, 3).every(tile => tile.state === 'held'));
  assert.equal(useMoveOut(game), false);
  assert.equal(clickHeld(game, 't0'), true);
  assert.equal(clickHeld(game, 't2'), true);
  assert.equal(clickTile(game, 't3'), true);
  assert.equal(game.tiles[0].state, 'gone');
  assert.equal(game.tiles[2].state, 'gone');
  assert.equal(game.tiles[3].state, 'gone');
  assert.equal(clickHeld(game, 't1'), true);
  assert.equal(clickTile(game, 't4'), true);
  assert.equal(clickTile(game, 't5'), true);
  assert.equal(game.status, 'win');
  assert.equal(game.held.length, 0);
}
console.log('✓ 移出、暂存牌点回、正常消除、全清胜利与限用一次');

{
  const game = smallGame(['main-stance', 'laugh-closeup', 'main-stance']);
  clickTile(game, 't0');
  clickTile(game, 't1');
  const beforeMove = JSON.parse(JSON.stringify({ tiles: game.tiles, slot: game.slot, held: game.held }));
  assert.equal(useMoveOut(game), true);
  assert.equal(useUndo(game), true);
  assert.deepEqual({ tiles: game.tiles, slot: game.slot, held: game.held }, beforeMove);
  assert.equal(game.tools.moveOut, false);
}

{
  const game = smallGame(['main-stance', 'laugh-closeup', 'main-stance']);
  clickTile(game, 't0');
  clickTile(game, 't1');
  useMoveOut(game);
  const beforeReturn = JSON.parse(JSON.stringify({ tiles: game.tiles, slot: game.slot, held: game.held }));
  assert.equal(clickHeld(game, 't0'), true);
  assert.equal(useUndo(game), true);
  assert.deepEqual({ tiles: game.tiles, slot: game.slot, held: game.held }, beforeReturn);
}
console.log('✓ 撤销移出道具及暂存牌点回');

console.log('全部测试通过');
