# 版式库

画布 1920×1080。`.pad` 是安全区容器（左右各 120px，上下各 150px；yohaku 皮肤下左右 180px、上下 170px），大多数页面从它开始。每个版式在 `template/index.html` 里都有一页能跑的样板，id 标在括号里。

## 选版式

| 这页要证明的东西 | 用                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 开场             | 封面 `l-cover`（cover）                                                                                                           |
| 进入新的一部分   | 章节页 `l-section`（part1）。可选：短 deck（≤ 12 页）直接用 kicker 标章节即可；用章节页时标题要写这一章的论点，不要只写"第二部分" |
| 一句话就是全部   | 断言页 `l-statement`                                                                                                              |
| 一个数字         | 大数字 `stat-split`：数字、竖线、说明（stat）；多个数字用 `stat-row`                                                              |
| 一个机制或流程   | 左文右图 `split` 加 SVG 图解（camera）；线性流程用 `timeline`（workflow）                                                         |
| 2–4 个并列要点   | 卡片 `cols-3` 加 `.card`（steps）                                                                                                 |
| 趋势或对比数据   | 图表 `.chart` 加 SVG（chart）                                                                                                     |
| 多维对照         | 表格 `.table`（table），或两栏 `.compare`                                                                                         |
| 怎么做 / 代码    | `.code` 逐行高亮（code）                                                                                                          |
| 权威或用户原话   | 引语 `.quote-text`（quote）                                                                                                       |
| 真实产品画面     | 屏幕框 `.screen` / `.phone`（media）                                                                                              |
| 结尾             | `l-close`（close）                                                                                                                |

同一种版式不要连续用 3 页以上。版式要交替出现，节奏才有起伏：文字密的页后面接一页图或数字。

## 标题块（几乎每页都有）

```html
<div class="stack">
  <p class="kicker rise" data-in="0">短标签</p>
  <h2 class="h2 rise" data-in="0" data-max-lines="2" style="--d:.12s">一句完整的判断，==关键词==可强调</h2>
</div>
```

- kicker 用 2–6 个字，写章节或话题，不要重复标题内容。
- `.h1` 只用于封面、章节页、断言页和收尾页；内容页用 `.h2`；卡片和节点里用 `.h3`。
- 正文段落用 `.body`，导语用 `.lede`，注释和来源用 `.note`，等宽标签用 `.label`。

## 封面

```html
<div class="frame" id="cover" data-chrome="off">
  <div class="l-cover">
    <div class="text">
      <p class="kicker rise" data-in="0">活动 · 场合</p>
      <h1 class="h1 rise" data-in="0" data-max-lines="3" style="--d:.15s">标题</h1>
      <p class="lede rise" data-in="0" data-max-lines="2" style="--d:.35s">一句承诺：听完能得到什么</p>
      <div class="byline rise" data-in="0" style="--d:.55s"><span>讲者</span><span class="when">日期 · 地点</span></div>
    </div>
    <div class="art"><svg class="pen" data-in="0" style="--d:.3s" viewBox="0 0 760 600">…主题图解…</svg></div>
  </div>
</div>
```

右侧 art 区放一幅概括整场主题的线描 SVG，见 diagrams.md。yohaku 皮肤下没有图时可以放一行竖排侧注：`<div class="art" style="display:flex; justify-content:flex-end"><p class="tate small rise" data-in="0" style="--d:.3s">减法 · 发布分享会</p></div>`；`.tate` 只放纯中文，数字和拉丁字母会横倒。art 栏较窄，SVG 会缩小显示：用 lint 的 tiny-text 提醒校准标签字号。没有合适的图时删掉 `.art`，并把 `.l-cover` 改成 `style="grid-template-columns:1fr"`。

## 章节页 / 断言页

```html
<div class="frame" id="part2" data-part="二 · 方法">
  <div class="l-section">
    <div class="numeral" aria-hidden="true">02</div>
    <p class="kicker rise" data-in="0">第二部分</p>
    <h1 class="h1 rise" data-in="0" style="--d:.15s">这一部分的核心判断</h1>
    <p class="lede rise" data-in="0" style="--d:.35s">可选的一句补充</p>
  </div>
</div>

<div class="frame" id="claim">
  <div class="l-statement">
    <h1 class="h1 blur" data-in="0">只有一句话的页面，让留白当主角</h1>
    <p class="lede rise" data-in="1">第二下点击给出出处或转折</p>
  </div>
</div>
```

## 左文右图 `split`

`split` 是 5:7 两栏；`split even` 是 1:1；`split rev` 是 7:5（图在左时用）。

```html
<div class="pad">
  <div class="split">
    <div class="stack gap-m">
      …标题块…
      <p class="body rise" data-in="0" style="--d:.28s">说明</p>
    </div>
    <div class="art"><svg viewBox="0 0 900 640">…</svg></div>
  </div>
</div>
```

## 卡片

```html
<div class="pad gap-xl">
  …标题块…
  <div class="cols-3 grow-1">
    <div class="card rise" data-in="1" data-state="dim@2">
      <span class="idx">01 · 标签</span>
      <h3 class="h3">卡片标题</h3>
      <p class="body">一两句说明</p>
    </div>
    <div class="card rise" data-in="2" data-state="dim@3">…</div>
    <div class="card ink rise" data-in="3">…结论卡用 .ink 反白</div>
  </div>
</div>
```

变体：`.card.ink` 用墨色反白，`.card.tint` 用强调色淡底，`.card.ghost` 用虚线框表示"未知/待定"。terminal 和 blueprint 皮肤下 `.card.ink` 会变成强调色淡底加强调色框（深底上没有"反白"可反）。`.idx` 固定在卡片顶部，标题和正文沉到底部。不需要撑满高度时去掉 `grow-1`。

## 大数字

```html
<div class="pad">
  <div class="stat-split">
    <div class="stat-big rise" data-in="0">
      <span data-count="0" data-from="0" data-to="3.2" data-dec="1">3.2</span><span class="unit">×</span>
    </div>
    <div class="side rise" data-in="0" style="--d:.25s">
      <p class="kicker">标签</p>
      <h2 class="h2">这个数字意味着什么</h2>
      <p class="body">一两句解释</p>
      <p class="source">来源 · 口径</p>
    </div>
  </div>
</div>
```

`.unit` 是正体灰色，强调色留给结论。数字超过 4 位时用 `style="font-size:260px"` 缩小。
多个数字并排：

```html
<div class="stat-row">
  <div class="item rise" data-in="1">
    <div class="stat-big"><span data-count="1" data-to="92">92</span><span class="unit">%</span></div>
    <p class="body">说明</p>
  </div>
  …
</div>
```

## 编号列表（替代项目符号）

```html
<ol class="list" data-stagger="120" data-in="1">
  <li>
    <span class="n">01</span><span class="t">要点<small>补充说明</small></span>
  </li>
  …
</ol>
```

## 图表

```html
<div class="chart grow-1">
  <svg viewBox="0 0 1680 470">
    <line class="axis" x1="0" x2="1680" y1="390" y2="390" />
    <g data-stagger="110" data-in="0" data-motion="grow">
      <rect class="bar soft" x="60" y="290" width="200" height="100" />
      <rect class="bar" x="380" y="70" width="200" height="320" data-state="lit@1" />
    </g>
    <text class="val" x="160" y="270" text-anchor="middle">12</text>
    <text class="cat" x="160" y="432" text-anchor="middle">类别</text>
  </svg>
</div>
<p class="note">来源：…</p>
```

- 默认用描边空心柱 `.bar.outline`，结论那一根用实心 `.bar`，下一步再 `lit` 成强调色。`.bar.soft` 是灰色实心柱，`.bar.hatch` 是斜线柱（表示外部、对照或估计值），`.band` 是强调色淡底的区间带（例如"达标区间"）。
- 图表右侧需要一句结论时用 `.chart-row`：`<div class="chart-row grow-1"><div class="chart">…svg…</div><div class="aside rise" data-in="1"><p class="label">最佳</p><p class="big">1.19×</p><p class="text">一句斜体注释</p></div></div>`。图表栏约 1220px 宽，viewBox 按 1220 设计。
- 图下方用一行 `.source` 写来源和口径，例如 `<p class="source">数据：… · 10 次取中位数</p>`。
- 数值用 `.val`（衬线），类别用 `.cat`，刻度用 `.tick`，注释用 `.anno`（斜体衬线）。
- 折线用 `<path class="line accent">` 加上 `.pen`，就能画出描线效果。
- 坐标自己算：y 轴向下，`y = 基线 - 高度`。数值和高度必须成比例，不要随手画。

## 表格

```html
<table class="table rise" data-in="0" style="--d:.3s">
  <thead>
    <tr>
      <th>维度</th>
      <th class="num">数值</th>
    </tr>
  </thead>
  <tbody>
    <tr data-state="hi@1-2">
      <td>第 1 步点亮这行</td>
      <td class="num">1,234</td>
    </tr>
    <tr data-state="hi@2">
      <td>第 2 步换成这行并保持</td>
      <td class="num">987</td>
    </tr>
  </tbody>
</table>
```

表格最多 6 行 4 列，超过就拆页或改成图表。`.num` 用于数值列（右对齐）；SHA、命令、ID 这类等宽但不是数值的内容用 `<span class="mono">`（左对齐）。

## 两栏对照

```html
<div class="compare">
  <div class="rise" data-in="0">
    <p class="label">以前</p>
    <h3 class="h3 strike" data-state="lit@2">旧做法</h3>
  </div>
  <div class="rise" data-in="1">
    <p class="label accent">现在</p>
    <h3 class="h3">新做法</h3>
  </div>
</div>
```

## 代码

```html
<pre
  class="code rise"
  data-in="0"
><span class="ln">普通行</span><span class="ln" data-state="lit@1">第 1 步高亮的行</span><span class="ln"><span class="k">关键字</span> <span class="s">"字符串"</span> <span class="c">// 注释</span></span></pre>
```

注意：`<pre>` 内不要缩进换行，每行写成一个 `.ln`，HTML 特殊字符要转义。最多 12 行。

## 引语

```html
<div class="pad" style="justify-content:center; padding-right:160px">
  <p class="quote-text blur" data-in="0" data-max-lines="3">引语正文，不用自己加引号</p>
  <p class="cite rise" data-in="0" style="--d:.6s; margin-top:56px">姓名 <span>身份 · 出处</span></p>
</div>
```

## 屏幕框 / 手机

```html
<div class="screen zoom" data-in="0">
  <div class="bar"><i></i><i></i><i></i><span class="url">example.com</span></div>
  <video muted playsinline loop preload="auto" poster="media/demo.jpg">
    <source src="media/demo.webm" type="video/webm" />
    <source src="media/demo.mp4" type="video/mp4" />
  </video>
</div>
<p class="caption"><span class="label">图 1</span>说明这段画面里该看什么</p>

<div class="phone pop" data-in="1"><video …></video></div>
```

## 时间线

```html
<div class="timeline">
  <svg class="track pen" data-in="0" viewBox="0 0 1680 40" preserveAspectRatio="none">
    <line class="d-line" x1="0" y1="10" x2="1680" y2="10" />
  </svg>
  <div class="node rise" data-in="0" style="--d:.5s" data-state="lit@1">
    <span class="when">2024</span>
    <h3 class="h3">节点</h3>
    <p class="small">说明</p>
  </div>
  …
</div>
```

## 收尾

```html
<div class="frame" id="close" data-chrome="off">
  <div class="l-close">
    <div>
      <p class="kicker rise" data-in="0">谢谢</p>
      <h1 class="h1 rise" data-in="0" style="--d:.15s">观众该带走的一句话或下一步行动</h1>
    </div>
    <div class="contact rise" data-in="0" style="--d:.4s"><span>联系方式</span><span>链接</span></div>
  </div>
</div>
```

## 原语

`fill-center` 让内容在标题下方的剩余空间里垂直居中：`<div class="pad gap-xl">标题块<div class="fill-center">…</div></div>`。内容比空间矮时用它，避免"下半页空着"。它必须是**外层包装**，不要和 `stat-row`、`cols-3` 这类自带 display 的类写在同一个元素上。

行内代码直接用 `<code>`。

`stack`（纵向排列，gap 28）、`row`、`cols-2/3/4`、`split`、`gap-s/m/l/xl`、`grow-1`（占满剩余空间）、`mt-auto`（推到底部）、`center`、`hr`、`chip`（`.chip.accent`，可加 `<i class="dot">`）。颜色辅助类：`ink` `muted` `accent` `second`。
