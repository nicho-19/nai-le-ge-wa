# 《奶了个蛙》v5 规格：改回卡牌形态，统一大小（只改表现层 CSS）

## 背景
用户最新决定：「还是改为卡牌吧，统一大小」。
即棋子恢复《羊了个羊》式卡牌：每张牌是一张大小完全一致的圆角卡片，真实奶蛙透明底图
统一收进卡面里（object-fit: contain + 内边距），不再用大小不一的蛙轮廓直接当棋子。
注意：这与 v1 被否无关——v1 被否是因 SVG 手绘假蛙；这次卡面图仍是现有 16 张真实奶蛙 PNG。

## 硬性纪律
- 只允许改 `style.css`；如确需结构调整才可微调 `game.js`/`index.html`，但元素 id、类名钩子、DOM 结构语义不得变。
- 绝不动：game-logic.js（逻辑/解序/位置/数量全不变）、tests.mjs、assets 与 assets-src 的图片文件。
- 棋子盒尺寸不变：.tile 的 width 16%、aspect-ratio .896 与逻辑 TILE_WIDTH/TILE_HEIGHT 对应关系保持——「统一大小」靠卡面样式实现，不是改盒尺寸。
- 不引入依赖、不联网。完成后自跑 `node tests.mjs` 必须全过，总结用中文。

## 卡牌样式要求（style.css）
1. `.tile` 本体即卡片（棋盘、槽位、暂存区、飞行残影共用同一套卡面）：
   - 背景：暖白色卡面（#fffdf4 一带），可带极淡的自上而下渐变；
   - 边框：2px 实线、浅灰绿（#b9cf9e 一带）；圆角：用相对圆角（border-radius: 12%/14% 或约 10px，二选一保持一致）；
   - 阴影：box-shadow 表现堆叠厚度：0 2px 3px rgba(30,60,40,.28) + 左上高光内阴影（inset 0 1px 0 #ffffff）；
   - 内边距：padding 约为盒宽的 5%，box-sizing 已全局 border-box；内部 img 改为 width:100%;height:100%;object-fit:contain，去掉原来对 img 的 drop-shadow（卡片自带阴影后不需要）。
2. 状态：
   - 可点：卡面全亮；hover/按下轻微上浮（现有 transform scale 规则保留，可加 translateY(-1px)）。
   - 被压住 `.tile.blocked`：整张卡变暗变灰——把滤镜从 img 提升到卡片本体：filter: brightness(.58) saturate(.35)；边框与阴影随之变暗即可（滤镜作用于整元素自然包含）。
   - 槽位满 6 张警告等其他状态不变。
3. `.tile-fallback`（图片加载失败占位）：改为卡面内居中的圆角方块或圆形沿用均可，但必须落在卡面内、不溢出。
4. 飞行残影 `.flying-tile`：克隆节点自带卡面样式即可，不额外处理；其 box-shadow 可略加强以便看清飞行轨迹。
5. 槽位格子 `.slot-cell` 本身的荷叶格样式保留，与卡面区分（卡是白的、格是绿的）。
6. 其余 v4 界面（品牌图标、剩余徽标、底部悬浮坞、按钮、弹窗、reduced-motion）全部保留不动。

## 自检
- `node tests.mjs` 全过；`git diff --stat` 应只包含 style.css（如动了 game.js/index.html 必须在总结里说明改了什么、为什么）。
- 总结里说明卡面配色/圆角/阴影的最终取值。
