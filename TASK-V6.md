# 《奶了个蛙》v6 规格：一页放下全部内容 + 画面整洁化 + BGM

## 用户三项要求
1. 一页能放下全部内容：手机上不用滚动，顶栏+棋盘+暂存+槽位+道具一屏全见。
2. 优化游戏画面：美观整洁。
3. 加上 BGM（背景音乐）。

## 硬性纪律
- game-logic.js 一字不动（逻辑、解序、位置、数量、TILE_WIDTH/TILE_HEIGHT 全不变）；tests.mjs 不动且必须继续全过。
- 棋盘宽高比必须保持 1/1.05（与逻辑遮挡常量的对应关系是历史教训，绝不能为塞一屏而拉伸棋盘）。
- assets/、assets-src/ 图片文件不动；BGM 不使用任何外部音频文件（见下，用 WebAudio 合成）。
- 元素 id 与 game.js 现有钩子不得改名删除；可新增元素（如音乐按钮）。
- 不引入依赖、不联网。完成后跑 `node tests.mjs` 确认全过，总结用中文。

## 一、一页布局（index.html + style.css）
- 根布局改全屏弹性：html,body{height:100%}；body{overflow:hidden; overscroll-behavior:none}；
  .game-shell{height:100dvh; display:flex; flex-direction:column; margin:0 auto}；
  .play-area{flex:1; min-height:0; display:flex; flex-direction:column}。
- 棋盘区 .board-wrap{flex:1; min-height:0; display:grid; place-items:center}；
  .board 用容器查询单位定尺寸保证比例与不溢出：.board-wrap{container-type:size}
  .board{width:min(100cqw, 95.2cqh); aspect-ratio:1/1.05}（95.2cqh = wrap 高度×(1/1.05)）；
  在其前写一条回退：.board{width:min(100%, calc((100dvh - 250px) * .952))}，支持 container 单位的浏览器以后者为准。
- 顶栏压缩为单行紧凑版：品牌图标 34px、标题字号下限调小、副标题在 (max-height:720px) 时隐藏；剩余徽标与关卡切换保持同排。
- 底部 .dock 改为在流内的固定块（去掉 sticky，flex 布局下自然贴底），各区块间距收紧到 8px 节奏：
  暂存行 min-height 52px、槽位标题行更矮、道具按钮 min-height 48px、「重新开始」改为与道具同排的小文字按钮或dock内右下角小按钮（id 不变）。
- 全屏后页面不得出现滚动条；任何一处内容不得被裁切到不可见（modal 除外，modal 本就是覆盖层）。

## 二、画面整洁（style.css 为主）
- 背景简化：body 背景改为一条柔和的对角渐变 + 一层极淡涟漪即可，删掉多重 radial 叠加；棋盘内装饰伪元素再调淡。
- 表面统一：play-area 与 dock 用同一套白绿表面与圆角（20px）、同级阴影（柔和、短距离），边框统一 2px #f0f7d5 系。
- 间距体系统一为 4/8/12/16；标题字距、徽标、按钮的视觉重量重新平衡，做到「整洁」而非堆装饰。
- 卡牌样式（v5）保持：暖白卡面、边框、圆角、阴影、被压整卡变暗规则全部不变。
- 保留 prefers-reduced-motion 规则。

## 三、BGM（game.js 新增小模块 + index.html 新增按钮）
- 实现：WebAudio 程序化轻音乐循环，无外部文件。要求听感：舒缓可爱的池塘氛围——
  五声音阶（C 大调五声音阶即可）主旋律用柔和的正弦/三角波「拨弦」音色（短包络、带一点延迟回声感可用简单 feedback delay 或省略），
  每小节一个低音根音垫底；速度约 88–96 BPM，8 小节一段循环，旋律音符序列写死为一段听起来顺耳的固定乐句（不要随机乱蹦）。
  主音量压低（master gain ≈ 0.12–0.18），加低通滤波让声音不刺耳。用 lookahead 调度（setInterval 25ms 预排 0.1s）保证循环稳定。
- 开关：顶栏新增按钮 #bgm-button（♪ 图标 + 「音乐」字样），点击切换播放/静音；状态存 localStorage('naiwa-bgm' = 'on'/'off')，默认 on。
- 自动播放限制：AudioContext 在首次 pointerdown/keydown 后才 resume 启动（若偏好为 on）；切后台（visibilitychange hidden）自动暂停、回前台恢复（偏好 on 时）。
- 代码独立成一个 IIFE 小模块（约 ≤130 行），不侵入现有游戏逻辑与渲染函数；按钮文案/图标随状态更新（播放中显示「♪ 音乐开」或高亮态，静音显示「♪ 已静音」或灰态，二选一保持一致）。

## 四、自检与说明
- `node tests.mjs` 全过（逻辑零改动，应自然通过）。
- README 增加 v6 段落：一页布局做法（容器单位定棋盘尺寸）、BGM 实现与开关说明。
- 总结里列清：改了哪些文件、棋盘尺寸 CSS 的最终写法、BGM 的乐句/速度/音量取值。
