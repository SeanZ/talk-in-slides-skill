import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildExamples, themes } from "./build-examples.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
buildExamples();
for (const theme of themes) {
  if (!existsSync(join(root, "example/previews", `${theme.id}.png`))) throw new Error("缺少预览图，请先运行 npm run screenshots");
}
const out = join(root, "_site");
// 只重建固定的生成目录；用白名单复制，避免将配置与检查报告发布到 Pages。
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "example"), { recursive: true });
for (const name of ["index.html", "LICENSE", "THIRD_PARTY_NOTICES.md"]) cpSync(join(root, name), join(out, name));
for (const name of ["previews", "gallery.css", "git.css", ...themes.map(t => t.id)])
  cpSync(join(root, "example", name), join(out, "example", name), { recursive: true });
cpSync(join(root, "template"), join(out, "template"), {
  recursive: true,
  filter: source => !source.split(/[\\/]/).some(p => ["shots", ".DS_Store"].includes(p)),
});
writeFileSync(join(out, ".nojekyll"), "");
console.log("已生成 _site/；仅含画廊、示例、运行资源与许可。");
