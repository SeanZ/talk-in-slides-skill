#!/usr/bin/env node
// talk-in-slides 截图与版面检查。
// 用法：node shoot.mjs <deck 目录或 index.html> [--out 目录] [--all-steps] [--frame id] [--theme 名] [--skin 名] [--scale 2] [--pdf]
// 产出：每页截图（默认每页最后一步；--all-steps 每步一张）、contact.png 总览图、report.json；
// 有错误（控制台报错、资源缺失、越界、文字溢出等）时退出码为 1。
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function parseArgs(argv) {
  const opts = { deck: null, out: null, allSteps: false, frame: null, theme: null, skin: null, scale: 1, pdf: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") opts.out = argv[++i];
    else if (a === "--all-steps") opts.allSteps = true;
    else if (a === "--frame") opts.frame = argv[++i];
    else if (a === "--theme") opts.theme = argv[++i];
    else if (a === "--skin") opts.skin = argv[++i];
    else if (a === "--scale") opts.scale = Number(argv[++i]);
    else if (a === "--pdf") opts.pdf = true;
    else if (a.startsWith("--")) throw new Error(`未知参数 ${a}`);
    else opts.deck = a;
  }
  if (!opts.deck)
    throw new Error(
      "用法：node shoot.mjs <deck 目录或 index.html> [--out 目录] [--all-steps] [--frame id] [--theme 名] [--skin 名] [--scale 2] [--pdf]",
    );
  if (!(opts.scale > 0)) throw new Error("--scale 必须是正数");
  const p = resolve(opts.deck);
  opts.index = existsSync(p) && statSync(p).isDirectory() ? join(p, "index.html") : p;
  if (!existsSync(opts.index)) throw new Error(`找不到 ${opts.index}`);
  opts.out = resolve(
    opts.out || join(dirname(opts.index), "shots", [opts.skin, opts.theme].filter(Boolean).join("-"), opts.allSteps ? "steps" : ""),
  );
  return opts;
}

async function launch() {
  const tries = [{ channel: "chrome" }, { channel: "msedge" }, {}];
  if (process.env.CHROME_PATH) tries.unshift({ executablePath: process.env.CHROME_PATH });
  let last;
  for (const t of tries) {
    try {
      return await chromium.launch(t);
    } catch (e) {
      last = e;
    }
  }
  throw new Error(`无法启动浏览器：请安装 Google Chrome，或设置 CHROME_PATH。\n${last && last.message}`);
}

// 在页面里对当前页做版面检查。返回 [{level, rule, msg}]。
function lintFrame(frameId) {
  const out = [];
  const add = (level, rule, el, msg) => {
    const t = (el.textContent || el.tagName).replace(/\s+/g, " ").trim().slice(0, 40);
    out.push({ level, rule, msg: `${msg}「${t}」` });
  };
  const frame = document.getElementById(frameId);
  const fr = frame.getBoundingClientRect(),
    k = fr.width / 1920;
  const box = el => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - fr.left) / k, y: (r.top - fr.top) / k, w: r.width / k, h: r.height / k };
  };
  const visible = el => {
    if (el.closest(".frame-label, .notes, [data-lint='off']")) return false;
    for (let e = el; e && e !== frame; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const ownText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim());
  const all = [...frame.querySelectorAll("*")].filter(el => !el.closest("svg") || el.tagName === "svg");
  const leaves = all.filter(el => (el.tagName === "svg" || el.tagName === "IMG" || el.tagName === "VIDEO" || ownText(el)) && visible(el));

  // 1. 安全区：x 96–1824，y 120–960（.bleed 内的元素豁免）
  leaves.forEach(el => {
    if (el.closest(".bleed, .numeral")) return;
    const b = box(el);
    if (b.x < 94 || b.y < 118 || b.x + b.w > 1826 || b.y + b.h > 962)
      add(
        "error",
        "safe-area",
        el,
        `超出安全区 (x ${Math.round(b.x)}–${Math.round(b.x + b.w)}, y ${Math.round(b.y)}–${Math.round(b.y + b.h)})`,
      );
  });

  // 2. 文字行数与末行孤字
  const lines = el => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [];
    [...range.getClientRects()].forEach(r => {
      if (r.width < 1) return;
      const t = Math.round(r.top / k);
      const row = tops.find(x => Math.abs(x.t - t) < 6);
      if (row) {
        row.l = Math.min(row.l, r.left);
        row.r = Math.max(row.r, r.right);
      } else tops.push({ t, l: r.left, r: r.right });
    });
    return tops.sort((a, b) => a.t - b.t);
  };
  frame.querySelectorAll("[data-max-lines], .h1, .h2, .h3, .lede, .quote-text").forEach(el => {
    if (!visible(el) || el.closest(".type")) return;
    const ls = lines(el),
      max = +el.dataset.maxLines;
    if (max && ls.length > max) add("error", "max-lines", el, `${ls.length} 行，超过 data-max-lines=${max}`);
    if (ls.length > 1) {
      // 标题的任何一行、正文的末行，宽度不足 2.2 个字就是孤字
      const fs = parseFloat(getComputedStyle(el).fontSize),
        heading = el.matches(".h1, .h2, .h3, .quote-text");
      (heading ? ls : ls.slice(-1)).forEach((ln, i) => {
        if ((ln.r - ln.l) / k < fs * 2.2)
          add(
            heading ? "error" : "warn",
            "widow",
            el,
            `第 ${heading ? i + 1 : ls.length} 行只剩 1–2 个字，改写、加宽容器或用 <wbr> 调整断行`,
          );
      });
    }
  });

  // 3. 文字重叠（HTML 文字之间；.numeral 等装饰豁免）
  const svgTexts = [...frame.querySelectorAll("svg text")].filter(visible);
  const texts = leaves
    .filter(el => el.tagName !== "svg" && el.tagName !== "IMG" && el.tagName !== "VIDEO" && !el.closest(".numeral, .bleed"))
    .concat(svgTexts);
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i],
        b = texts[j];
      if (a.contains(b) || b.contains(a)) continue;
      const p = box(a),
        q = box(b);
      const ix = Math.min(p.x + p.w, q.x + q.w) - Math.max(p.x, q.x),
        iy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
      if (ix > 4 && iy > 4) add("error", "overlap", a, `与「${b.textContent.trim().slice(0, 20)}」重叠`);
    }

  // 4. 容器裁切：设了 overflow 的元素内容比自身大
  all.forEach(el => {
    if (!visible(el) || el.tagName === "svg" || el.closest(".screen, .phone, .bleed")) return;
    const cs = getComputedStyle(el);
    if (cs.overflow === "visible" || el.classList.contains("frame")) return;
    if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) add("error", "clipped", el, "内容被裁切");
  });

  // 5. 字号下限（画布像素；SVG 文字按 viewBox 缩放后的实际大小算）
  texts.forEach(el => {
    if (el.closest(".screen .bar")) return;
    const ctm = el instanceof SVGElement && el.getScreenCTM();
    const size = parseFloat(getComputedStyle(el).fontSize) * (ctm ? Math.hypot(ctm.a, ctm.b) / k : 1);
    if (size < 17.5) add("warn", "tiny-text", el, `字号实际约 ${size.toFixed(1)}px，投影上看不清（下限 18px）`);
  });

  // 6. SVG 文字超出 SVG 自身边界（默认 overflow:hidden，会被裁掉）
  svgTexts.forEach(t => {
    const svg = t.ownerSVGElement;
    if (getComputedStyle(svg).overflow === "visible") return;
    const a = t.getBoundingClientRect(),
      b = svg.getBoundingClientRect();
    if (a.left < b.left - 1 || a.right > b.right + 1 || a.top < b.top - 1 || a.bottom > b.bottom + 1)
      add("error", "svg-clip", t, "SVG 文字超出 SVG 边界被裁切，调整 viewBox 或文字位置");
  });

  // 7. 镜头推近后，文字被画面边缘切成半截
  const vp = document.getElementById("stage").getBoundingClientRect();
  texts.forEach(el => {
    const r = el.getBoundingClientRect();
    const inside = r.left >= vp.left - 1 && r.right <= vp.right + 1 && r.top >= vp.top - 1 && r.bottom <= vp.bottom + 1;
    const outside = r.right <= vp.left || r.left >= vp.right || r.bottom <= vp.top || r.top >= vp.bottom;
    if (!inside && !outside) add("error", "cam-crop", el, "镜头画面切到了这段文字，调整 data-cam 或让它在推近前退场");
  });

  // 8. SVG 文字首尾粘连（同一行、间距不足 6px）
  for (let i = 0; i < svgTexts.length; i++)
    for (let j = i + 1; j < svgTexts.length; j++) {
      const p = box(svgTexts[i]),
        q = box(svgTexts[j]);
      const iy = Math.min(p.y + p.h, q.y + q.h) - Math.max(p.y, q.y);
      const gap = Math.max(p.x, q.x) - Math.min(p.x + p.w, q.x + q.w);
      if (iy > Math.min(p.h, q.h) * 0.5 && gap > -4 && gap < 6)
        add("warn", "svg-touch", svgTexts[i], `与「${svgTexts[j].textContent.trim().slice(0, 20)}」首尾粘连，拉开间距`);
    }

  // 9. 最终步仍然压暗：总览、PDF 里这部分几乎看不见
  if (frame.dataset.lintStep === "final")
    frame.querySelectorAll(".dim").forEach(el => {
      if (!el.closest("[data-lint='off']"))
        add("warn", "dim-final", el, "最后一步仍是 dim，总览和 PDF 里几乎看不见；最后一步恢复它或确认是有意为之");
    });

  // 10. 代码和命令里不该有弯引号（复制出去跑不了）
  frame.querySelectorAll("pre, code, .code, .mono, .contact").forEach(el => {
    if (/[“”‘’]/.test(el.textContent)) add("error", "code-quotes", el, "代码或命令里出现了弯引号，复制后无法运行");
  });

  // 11. 表格超过 4 列
  frame.querySelectorAll("table").forEach(t => {
    const cols = Math.max(...[...t.rows].map(r => r.cells.length));
    if (cols > 4) add("warn", "table-cols", t, `表格有 ${cols} 列，超过 4 列建议拆页或改图表`);
  });

  // 12. 资源
  frame.querySelectorAll("img").forEach(img => {
    if (!img.complete || !img.naturalWidth) add("error", "missing-image", img, `图片加载失败 ${img.getAttribute("src")}`);
  });
  frame.querySelectorAll("video").forEach(v => {
    if (v.error) add("error", "video-error", v, `视频加载失败 ${v.currentSrc || v.getAttribute("src") || ""}`);
  });
  return out;
}

async function contactSheet(browser, shots, outDir) {
  const page = await browser.newPage({ viewport: { width: 2000, height: 800 } });
  const cells = shots
    .map(
      s =>
        `<figure><img src="${basename(s.file)}"><figcaption><b>${s.label}</b>${s.issues ? `<i>${s.issues}</i>` : ""}</figcaption></figure>`,
    )
    .join("");
  const html = join(outDir, "contact.html");
  writeFileSync(
    html,
    `<meta charset="utf-8"><style>body{margin:0;padding:32px;background:#e7e5df;font:500 18px system-ui}main{display:grid;grid-template-columns:repeat(4,1fr);gap:28px 24px}
    figure{margin:0}img{width:100%;display:block;box-shadow:0 1px 0 #0002,0 12px 30px -18px #0006}figcaption{margin-top:10px;display:flex;justify-content:space-between;color:#444}i{color:#c0392b;font-style:normal}</style><main>${cells}</main>`,
  );
  await page.goto(pathToFileURL(html).href, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 90000 });
  const file = join(outDir, "contact.png");
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
  return file;
}

async function pdf(browser, shots, outDir) {
  const page = await browser.newPage();
  const html = join(outDir, "pdf.html");
  writeFileSync(
    html,
    `<meta charset="utf-8"><style>@page{size:1920px 1080px;margin:0}body{margin:0}img{width:1920px;height:1080px;display:block;break-after:page}</style>` +
      shots.map(s => `<img src="${basename(s.file)}">`).join(""),
  );
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(() => [...document.images].every(i => i.complete));
  const file = join(outDir, "deck.pdf");
  await page.pdf({ path: file, width: "1920px", height: "1080px", printBackground: true });
  await page.close();
  return file;
}

// 清掉上一次运行生成的文件，避免新旧截图混在一起
function clean(dir) {
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir))
    if (/^\d{2}-.+\.png$/.test(f) || ["contact.png", "contact.html", "report.json", "deck.pdf", "pdf.html"].includes(f))
      rmSync(join(dir, f));
}

export async function shoot(opts) {
  clean(opts.out);
  const browser = await launch();
  const report = { deck: opts.index, console: [], frames: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: opts.scale });
    page.on("console", m => {
      if (m.type() === "error" || m.type() === "warning") report.console.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", e => report.console.push(`pageerror: ${e.message}`));
    page.on("requestfailed", r => report.console.push(`requestfailed: ${r.url()} ${r.failure()?.errorText || ""}`));
    await page.goto(pathToFileURL(opts.index).href);
    await page.waitForFunction(() => document.documentElement.classList.contains("ready"), null, { timeout: 15000 });
    await page.evaluate(
      ({ theme, skin }) => {
        document.documentElement.classList.add("snap");
        if (theme) document.documentElement.dataset.theme = theme;
        if (skin) document.documentElement.dataset.skin = skin;
      },
      { theme: opts.theme, skin: opts.skin },
    );
    const frames = await page.evaluate(() => window.deck.frames);
    const shots = [];
    for (let fi = 0; fi < frames.length; fi++) {
      const f = frames[fi];
      if (opts.frame && f.id !== opts.frame) continue;
      const steps = opts.allSteps ? [...Array(f.steps).keys()] : [f.steps - 1];
      const entry = { id: f.id, steps: f.steps, issues: [] };
      for (const s of steps) {
        await page.evaluate(([i, st]) => window.deck.goto(i, st), [fi, s]);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(60);
        await page.evaluate(
          ([id, last]) => (document.getElementById(id).dataset.lintStep = last ? "final" : ""),
          [f.id, s === f.steps - 1],
        );
        const issues = (await page.evaluate(lintFrame, f.id)).map(x => ({ ...x, step: s }));
        entry.issues.push(...issues);
        const name = `${String(fi + 1).padStart(2, "0")}-${f.id}${opts.allSteps ? `-s${s}` : ""}.png`;
        const file = join(opts.out, name);
        await page.screenshot({ path: file });
        const errs = issues.filter(x => x.level === "error").length,
          warns = issues.length - errs;
        shots.push({
          file,
          final: s === f.steps - 1,
          label: `${String(fi + 1).padStart(2, "0")} ${f.id}${opts.allSteps ? ` · ${s}` : ""}`,
          issues: errs || warns ? `${errs}E ${warns}W` : "",
        });
      }
      report.frames.push(entry);
    }
    try {
      report.contact = await contactSheet(browser, shots, opts.out);
    } catch (e) {
      report.contact = null;
      report.console.push(`warning: 总览图生成失败（${e.message.split("\n")[0]}），单页截图和 lint 结果不受影响`);
    }
    if (opts.pdf)
      report.pdf = await pdf(
        browser,
        shots.filter(s => s.final),
        opts.out,
      );
  } finally {
    await browser.close();
  }
  writeFileSync(join(opts.out, "report.json"), JSON.stringify(report, null, 2));
  return report;
}

export function summarize(report) {
  const lines = [];
  let errors = 0;
  report.console.forEach(c => {
    const bad = !c.startsWith("warning") || c.includes("[deck]");
    if (bad) errors++;
    lines.push(`  ${bad ? "✗" : "!"} ${c}`);
  });
  report.frames.forEach(f => {
    const seen = new Set();
    f.issues.forEach(x => {
      const key = x.rule + x.msg;
      if (seen.has(key)) return;
      seen.add(key);
      if (x.level === "error") errors++;
      lines.push(`  ${x.level === "error" ? "✗" : "!"} #${f.id} 第${x.step}步 [${x.rule}] ${x.msg}`);
    });
  });
  const head = `${report.frames.length} 页，${errors} 个错误，${lines.length - errors} 个提醒。总览图：${report.contact}`;
  return { errors, text: [head, ...lines].join("\n") };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await shoot(parseArgs(process.argv.slice(2)));
    const { errors, text } = summarize(report);
    console.log(text);
    process.exit(errors ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
