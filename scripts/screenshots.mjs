import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { themes } from "./build-examples.mjs";
import { parseArgs, shoot, summarize } from "../tools/shoot.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
mkdirSync(join(root, "example/previews"), { recursive: true });
for (const theme of themes) {
  for (const allSteps of [false, true]) {
    const out = join(root, ".artifacts", theme.id, allSteps ? "steps" : "final");
    const report = await shoot(parseArgs([join(root, "example", theme.id), "--out", out, ...(allSteps ? ["--all-steps"] : [])]));
    const result = summarize(report);
    console.log(`${theme.id} / ${allSteps ? "逐步" : "终态"}: ${result.text}`);
    if (result.errors) process.exitCode = 1;
    if (!allSteps && !result.errors) copyFileSync(join(out, "01-cover.png"), join(root, "example/previews", `${theme.id}.png`));
  }
}
