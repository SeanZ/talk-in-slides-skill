import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const themes = [
  { id: "paper", name: "暖纸", en: "Warm paper", theme: "paper", skin: "", tone: "暖米纸、朱红与衬线标题", use: "讲座 · 技术分享 · 课程" },
  { id: "sage", name: "灰绿", en: "Quiet sage", theme: "sage", skin: "", tone: "灰绿纸、墨绿与安静的留白", use: "研究 · 复盘 · 阅读" },
  { id: "cobalt", name: "冷白", en: "Clear cobalt", theme: "cobalt", skin: "", tone: "冷白底色与钴蓝重点", use: "产品 · 方案 · 商务汇报" },
  { id: "night", name: "夜场", en: "After dark", theme: "night", skin: "", tone: "深色舞台与琥珀光点", use: "发布 · 大会 · 暗场投影" },
  {
    id: "terminal",
    name: "终端",
    en: "Terminal",
    theme: "night",
    skin: "terminal",
    tone: "等宽字、点阵与磷光绿",
    use: "工程 · 开源 · 故障复盘",
  },
  {
    id: "blueprint",
    name: "蓝图",
    en: "Blueprint",
    theme: "night",
    skin: "blueprint",
    tone: "制图蓝、坐标纸与黄色标注",
    use: "架构 · 系统 · 路线图",
  },
  {
    id: "yohaku",
    name: "余白",
    en: "Yohaku",
    theme: "paper",
    skin: "yohaku",
    tone: "和纸、宋体与朱色一点",
    use: "中文讲稿 · 方法论 · 设计",
  },
];
const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function renderExample(source, preset) {
  if (!themes.includes(preset)) throw new Error("未知主题");
  if (!source.includes('<html lang="zh-CN" data-theme="paper">')) throw new Error("示例源缺少主题入口");
  return source.replace(
    '<html lang="zh-CN" data-theme="paper">',
    `<html lang="zh-CN" data-theme="${preset.theme}"${preset.skin ? ` data-skin="${preset.skin}"` : ""}>`,
  );
}
export function buildExamples() {
  const source = readFileSync(join(root, "example/_source/index.html"), "utf8");
  for (const theme of themes) {
    const dir = join(root, "example", theme.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), renderExample(source, theme));
  }
  const cards = themes
    .map(
      (t, i) =>
        `<a class="theme-card" href="example/${t.id}/index.html"><div class="preview"><img src="example/previews/${t.id}.png" alt="${t.name}主题的 Git 示例实际截图" width="960" height="540" ${i > 1 ? 'loading="lazy"' : ""}></div><div class="card-info"><div><span class="eyebrow">0${i + 1} / ${t.en}</span><h2>${t.name}</h2><p>${t.tone}</p><p class="use">${t.use}</p></div><span class="open" aria-hidden="true">↗</span></div></a>`,
    )
    .join("\n");
  writeFileSync(
    join(root, "index.html"),
    `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>talk-in-slides · 把下一次分享，做成网页演示</title><meta name="description" content="面向技术分享、讲座与课程的网页演示技能。用同一份 Git 教学稿，体验七种风格。"><link rel="stylesheet" href="example/gallery.css"><link rel="icon" href="data:,"></head><body>
<header><a class="wordmark" href="index.html">talk-in-slides<span>网页演示技能</span></a><a href="#themes">浏览七种风格 ↓</a></header>
<main><section class="hero"><p class="eyebrow">FOR YOUR NEXT TALK</p><h1>下一次分享，<br>让观点<span>走到眼前。</span></h1><div class="hero-bottom"><p>一份主题，一张画布。<br>把技术分享、讲座与课程，做成可以发链接的演示。</p><div class="facts"><span><b>07</b>种风格</span><span><b>08</b>页同题示例</span><span><b>01</b>份内容源</span></div></div></section>
<section id="themes" aria-label="主题示例"><div class="section-heading"><div><p class="eyebrow">SAME STORY, DIFFERENT VOICES</p><h2>Git 不是魔法。</h2></div><p>相同的内容、图解与点击节奏，只换呈现风格。<br>点击截图，进入完整演示。</p></div><div class="theme-grid">${cards}</div></section>
<section class="how"><div><p class="eyebrow">MAKE IT YOURS</p><h2>带上题目，开始写稿。</h2><p>把仓库作为技能安装，告诉 AI 受众、时长与主题。<br>从逐页提纲到画面，再到截图检查。</p><pre><code>用 talk-in-slides 做一份 10 分钟的 Git 分享，\n面向刚入职的工程师，使用终端风格。</code></pre></div><div><h3>进入演示以后</h3><dl><div><dt>← / → / 空格</dt><dd>后退、前进与分步揭示</dd></div><div><dt>M</dt><dd>总览全部页面，选页进入</dd></div><div><dt>S / F / B</dt><dd>演讲者备注、全屏、暂停</dd></div><div><dt>触屏</dt><dd>点按或横向滑动；横屏观看更清晰</dd></div></dl><p class="fine">示例采用合成图解，不包含真实仓库或团队数据。</p></div></section></main>
<footer><span>talk-in-slides · 为下一次分享准备</span><a href="template/index.html">查看版式样板 ↗</a></footer></body></html>\n`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildExamples();
