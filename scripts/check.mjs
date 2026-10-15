import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { themes, renderExample } from "./build-examples.mjs";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ignored = new Set(["node_modules", ".git", ".artifacts", ".agentdocs", "shots", "_site"]);
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    ignored.has(e.name) ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}
const files = walk(root);
const source = readFileSync(join(root, "example/_source/index.html"), "utf8");
for (const theme of themes)
  assert.equal(
    readFileSync(join(root, "example", theme.id, "index.html"), "utf8"),
    renderExample(source, theme),
    `${theme.id} 与内容源不同步`,
  );
for (const file of files) {
  if (!/\.(?:html|css|js|mjs|md|json|ya?ml|txt)$/.test(file)) continue;
  const text = readFileSync(file, "utf8");
  // 许可文件保留第三方作者，扫描仍覆盖本机路径与凭据模式。
  assert.ok(!/\/(?:Users|home)\/[\w.-]+\//.test(text), `${file}: 本机绝对路径`);
  assert.ok(!/https?:\/\/[^\s"'<>]*(?:\.corp\.|\.internal\b)/i.test(text), `${file}: 内部地址`);
  assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), `${file}: 私钥`);
  assert.ok(!/\b(?:ghp_|github_pat_|sk_live_)[A-Za-z0-9_]{20,}/.test(text), `${file}: 疑似凭据`);
  if (file.includes(`${join("template", "vendor")}/`) || file.includes(`${join("template", "fonts")}/`)) continue;
  if ([".js", ".mjs", ".css"].includes(extname(file))) assert.ok(text.split("\n").length <= 1000, `${file}: 超过 1000 行`);
  if (/\.(mjs|js)$/.test(file)) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  if (file.endsWith(".md")) {
    let fence = false;
    for (const line of text.split("\n")) {
      if (/^```/.test(line)) fence = !fence;
      assert.ok(!/[ \t]+$/.test(line), `${file}: 尾部空白`);
    }
    assert.ok(!fence, `${file}: 代码块未闭合`);
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const href = match[1];
      if (/^(?:https?:|#|mailto:)/.test(href) || href.includes("<")) continue;
      assert.ok(existsSync(resolve(dirname(file), href.split("#")[0])), `${file}: 断开的本地链接 ${href}`);
    }
  }
}
console.log(`静态检查通过：${files.length} 个文件，7 套示例同步；语法、文件长度、文档和敏感模式检查通过。`);
