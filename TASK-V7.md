# 《奶了个蛙》v7 规格：BGM 修好+加长 + UI 第二轮美化（用现成设计 skill 干）

## 背景
用户反馈：①听不到 BGM；②BGM 换成长一点的；③界面 UI 继续美化。
BGM 听不到的定位（v6 实现的问题）：master gain 仅 0.14、旋律音量 0.22、低通 1400Hz 把高频滤得太闷，
手机外放基本听不见；且只在首次 pointerdown 尝试启动一次，iOS 上 context 没 resume 成功就再无机会。
本机 Codex 已装有现成设计 skill，本轮 UI 必须实际使用它们：
先读 `~/.codex/skills/game-ui-ux/SKILL.md` 与 `~/.codex/skills/ui-ux-pro-max/SKILL.md`（含其设计系统检索方式），
按其中的游戏 UI 规范与设计系统建议执行本轮美化，并在总结里注明采纳了哪些建议。

## 硬性纪律
- game-logic.js、tests.mjs 一字不动（完工后 `node tests.mjs` 必须全过）；assets 图片不动；棋盘 1/1.05 与一页布局（v6）不得回退。
- 元素 id 不得改名删除；BGM 按钮仍是 #bgm-button（含 .bgm-label 子元素）。
- 不引入依赖、不联网、不使用外部音频文件（BGM 继续 WebAudio 合成）。

## 一、BGM v7（重写 game.js 里的 bgm 模块，其余函数不许顺手改）
1. 音量与音色（解决听不到）：
   - master gain 0.14 → **0.32**；低通频率 1400 → **2400Hz**。
   - 旋律 tone 音量 0.22 → 0.5（triangle 波）；低音 0.12 → 0.22（sine）。
   - 新增和弦垫：每小节开头把当前和弦的三个音以 sine 波、慢 attack（0.08s)、长释放（整小节）各播一次，单音音量 0.05，垫在旋律下面增加厚度。
2. 加长与结构（解决太短）：总长 **16 小节 = 128 个八分音符步**（92 BPM 下约 83 秒一循环）。
   - 和弦进行（每小节一个，根音低音沿用现 bass 机制但按和弦根音走）：
     第 1 轮 8 小节：C – G – Am – F – C – G – F – G
     第 2 轮 8 小节：C – G – Am – F – Dm – G – C – C
     和弦音（垫层用，频率）：C:[261.63,329.63,392] G:[196,246.94,293.66] Am:[220,261.63,329.63]
     F:[174.61,220,261.63] Dm:[146.83,174.61,220]；根音低音：C:130.81 G:98 Am:110 F:87.31 Dm:73.42。
   - 旋律：C 大调五声音阶，音高表扩为 [523.25, 587.33, 659.25, 783.99, 880, 1046.5]（C5 D5 E5 G5 A5 C6，索引用整数或 null 休止）。
     写两段各 8 小节的固定乐句：A 段与 A' 段，前 6 小节可同骨架、后 2 小节收尾不同；以级进为主、少量跳进；
     休止别太多（每小节至多 2 个 null），乐句结尾落在主音或三音上、时值拉长（可用连续同音或长 tone 实现近似）。
     旋律数组总长必须恰好 128。
3. 启动可靠性（iOS 重点）：
   - 去掉 pointerdown 的 { once: true }：每次 pointerdown / keydown 若 preferred 为真且（未建 context 或 context.state !== 'running'）就走 start() 重试 resume，直到跑起来为止；已 running 则直接返回。
   - makeContext 时加：`try { if ('audioSession' in navigator) navigator.audioSession.type = 'playback'; } catch(_){}`（iOS 17+ 绕开静音拨片对外放的压制）。
   - 按钮 click 切到 on 时同样调用 start()；切后台 pause、回前台 start() 的现有行为保留。
   - 调度器沿用 lookahead（setInterval 25ms + 0.1s 预排）；schedule() 要同时处理旋律、低音与小节和弦垫（按步号判断小节边界）。
4. 模块仍为独立 IIFE（可放宽到 ≤200 行），localStorage 偏好键 'naiwa-bgm' 不变。

## 二、UI 美化（style.css 为主，index.html 可加少量结构，game.js 仅允许给棋子加开局动画延迟一处小改）
按 game-ui-ux 与 ui-ux-pro-max 的规范做，具体落地清单：
1. 颜色系统：:root 定义 CSS 变量（--pond-deep/--pond/--pond-soft/--cream/--gold/--ink 等），把现有散落的同色系 hex 尽量收敛到变量；整体仍是池塘绿+奶油+金点缀。
2. 顶栏：做成半透明毛玻璃条（backdrop-filter: blur + 半透明浅绿底 + 细边框），品牌图标、标题、关卡切换、剩余徽标、音乐按钮在一条内对齐整齐；音乐按钮与关卡切换做成同款胶囊。
3. 棋盘：边框改内嵌质感（内阴影加深、外框变细），水面渐变稍丰富（两段绿 + 一处柔光），角落加极淡的荷叶剪影（内联 SVG data-uri 背景，透明度 ≤0.10，不抢蛙）。
4. 卡牌：在 v5 基础上加一层极淡的自上而下高光渐变；可点牌 hover/按下上浮改为 translateY(-2px) scale(1.05)；阴影分两层（近处细影 + 远处柔影）。
5. Dock：分区标签（暂存区/荷叶槽位）改为小号大写距灰绿字；道具按钮图标放进彩色小圆片里，按钮底用同色系浅渐变；已用态保持灰化。
6. 槽位：格子圆角加大、内影更柔；空位荷叶标记保留。
7. 开局动画：棋子渲染时按 layer 从高到低依次淡入+轻微放大（.tile 加 deal-in 关键帧；game.js 在 tileElement 里给 style.animationDelay 赋值，单张延迟 = (总层数 - layer) * 8ms 且封顶 400ms）；prefers-reduced-motion 下禁用。
8. 结算弹窗：加 pop-in 动画（opacity + scale .96→1，180ms），奶蛙图加 drop-shadow。
9. 全局：间距继续按 4/8/12/16 对齐一遍；focus-visible 橙色描边保留；任何改动不得破坏一页布局（100dvh 不滚动）与棋盘比例。

## 三、自检与说明
- `node tests.mjs` 全过；`node --check game.js` 通过。
- README 增加 v7 段落：BGM 加长结构与音量、启动可靠性处理、UI 美化清单与所用 skill。
- 总结注明：采纳了哪几个 skill 的哪些建议、BGM 最终参数（master/低通/步数/进行）。
