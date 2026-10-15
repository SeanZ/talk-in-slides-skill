import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, shoot, summarize } from "../shoot.mjs";

const TEMPLATE = fileURLToPath(new URL("../../template", import.meta.url));
const tmp = () => mkdtempSync(join(tmpdir(), "talk-in-slides-"));

test("parseArgs：目录解析到 index.html，默认输出到 shots/", () => {
  const o = parseArgs([TEMPLATE, "--all-steps", "--scale", "2"]);
  assert.equal(o.index, join(TEMPLATE, "index.html"));
  assert.equal(o.out, join(TEMPLATE, "shots", "steps"));
  assert.equal(parseArgs([TEMPLATE]).out, join(TEMPLATE, "shots"));
  assert.equal(parseArgs([TEMPLATE, "--skin", "terminal", "--theme", "paper"]).out, join(TEMPLATE, "shots", "terminal-paper"));
  assert.equal(o.allSteps, true);
  assert.equal(o.scale, 2);
});

test("parseArgs：缺参数、未知参数、非法 scale 报错", () => {
  assert.throws(() => parseArgs([]), /用法/);
  assert.throws(() => parseArgs([TEMPLATE, "--nope"]), /未知参数/);
  assert.throws(() => parseArgs([TEMPLATE, "--scale", "0"]), /scale/);
  assert.throws(() => parseArgs(["/no/such/deck"]), /找不到/);
});

test("summarize：控制台错误和 [deck] 警告算错误，其余警告只提醒；同类问题去重", () => {
  const r = summarize({
    contact: "c.png",
    console: ["error: boom", "warning: [deck] bad step", "warning: noise"],
    frames: [
      {
        id: "a",
        issues: [
          { level: "error", rule: "overlap", msg: "x", step: 0 },
          { level: "error", rule: "overlap", msg: "x", step: 1 },
          { level: "warn", rule: "widow", msg: "y", step: 1 },
        ],
      },
    ],
  });
  assert.equal(r.errors, 3);
  assert.match(r.text, /1 页，3 个错误，2 个提醒/);
});

test("集成：模板 deck 全步截图零错误，产出截图、总览图、报告、PDF", { timeout: 120000 }, async () => {
  const out = tmp();
  const report = await shoot(parseArgs([TEMPLATE, "--out", out, "--all-steps", "--pdf"]));
  const { errors, text } = summarize(report);
  assert.equal(errors, 0, text);
  assert.ok(report.frames.length >= 10);
  const cam = report.frames.find(f => f.id === "camera");
  assert.equal(cam.steps, 3, "步数应由 data-in/data-state 自动推导");
  for (const f of ["contact.png", "report.json", "deck.pdf", "01-cover-s0.png"]) assert.ok(existsSync(join(out, f)), f);
});

test("集成：埋入的版面缺陷都能被抓到", { timeout: 120000 }, async () => {
  const dir = tmp();
  cpSync(TEMPLATE, dir, { recursive: true });
  const index = join(dir, "index.html");
  const bad = `
<div class="frame" id="broken">
  <div class="pad">
    <h2 class="h2" data-in="0" data-max-lines="1">这是一条故意写得很长很长很长很长很长很长很长的标题，用来触发行数检查</h2>
    <p class="body" style="position:absolute; left:-60px; top:300px">越界的文字</p>
    <p class="body" style="position:absolute; left:400px; top:500px">重叠甲</p>
    <p class="body" style="position:absolute; left:410px; top:505px">重叠乙</p>
    <img src="media/nope.png" alt="">
    <p class="body" data-in="x">坏步号</p>
  </div>
</div>
<div class="frame" id="close"`;
  writeFileSync(index, readFileSync(index, "utf8").replace('<div class="frame" id="close"', bad));
  const report = await shoot(parseArgs([dir, "--frame", "broken"]));
  const rules = new Set(report.frames.flatMap(f => f.issues.map(i => i.rule)));
  for (const r of ["max-lines", "safe-area", "overlap", "missing-image"]) assert.ok(rules.has(r), `应报 ${r}，实际 ${[...rules]}`);
  assert.ok(
    report.console.some(c => c.includes("[deck]") && c.includes("data-in")),
    "坏步号应在控制台告警",
  );
  assert.ok(summarize(report).errors > 0);
});
