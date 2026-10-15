import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderExample, themes } from "../../scripts/build-examples.mjs";
const source = readFileSync(new URL("../../example/_source/index.html", import.meta.url), "utf8");
test("七主题共用完全相同的内容、资源和动效，仅根主题属性不同", () => {
  assert.equal(new Set(themes.map(t => t.id)).size, 7);
  const normalize = s => s.replace(/<html[^>]+>/, "<html>");
  for (const theme of themes) {
    const result = renderExample(source, theme);
    assert.equal(normalize(result), normalize(source));
    assert.equal(result, readFileSync(new URL(`../../example/${theme.id}/index.html`, import.meta.url), "utf8"));
    assert.equal((result.match(/class="frame"/g) || []).length, 8);
  }
});
test("主题或源入口无效时显式失败，避免悄悄生成相同主题", () => {
  assert.throws(() => renderExample(source, { id: "unknown" }), /未知主题/);
  assert.throws(() => renderExample("<html>", themes[0]), /主题入口/);
});
