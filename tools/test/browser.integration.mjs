import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { themes } from "../../scripts/build-examples.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../_site");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2" };

test("HTTP 与项目子路径下的七主题：三种视口、步进、总览跨章、暂停、hash 与资源", { timeout: 180000 }, async () => {
  const server = createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (!pathname.startsWith("/demo/")) {
        res.writeHead(404).end();
        return;
      }
      let path = resolve(root, `.${pathname.slice(5)}`);
      if (path !== root && !path.startsWith(root + sep)) throw new Error("越界");
      if (statSync(path).isDirectory()) path = resolve(path, "index.html");
      res.setHeader("Content-Type", mime[extname(path)] || "application/octet-stream");
      res.end(readFileSync(path));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  let browser;
  try {
    browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" });
    const url = `http://127.0.0.1:${server.address().port}/demo/`;
    for (const width of [1440, 1024, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        hasTouch: width === 390,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const failures = [];
      page.on("pageerror", e => failures.push(e.message));
      page.on("requestfailed", r => failures.push(r.url()));
      page.on("response", r => {
        if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
      });
      await page.goto(url);
      assert.equal(await page.locator(".theme-card").count(), 7);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `画廊溢出 ${width}`);
      await page.locator(".theme-card img").evaluateAll(images => images.forEach(i => (i.loading = "eager")));
      await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
      assert.equal(await page.locator(".theme-card img").evaluateAll(images => images.every(i => i.complete && i.naturalWidth)), true);
      for (const theme of themes) {
        await page.goto(`${url}example/${theme.id}/`);
        await page.waitForFunction(() => document.documentElement.classList.contains("ready"));
        assert.equal(await page.evaluate(() => window.deck.frames.length), 8);
        assert.equal(
          await page.locator("#cover .cover-graph").evaluate(el => Number(getComputedStyle(el).opacity) > 0),
          true,
          "封面图解必须可见",
        );
        assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.skin || ""]), [
          theme.theme,
          theme.skin,
        ]);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${theme.id} 溢出 ${width}`);
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => Reveal.getIndices().h === 1);
        assert.equal(await page.locator("#objects .card.on").count(), 0);
        await page.keyboard.press("ArrowRight");
        assert.equal(await page.locator("#objects .card.on").count(), 1);
        await page.keyboard.press("ArrowLeft");
        assert.equal(await page.locator("#objects .card.on").count(), 0);
        await page.keyboard.press("m");
        await page.waitForFunction(() => document.documentElement.classList.contains("overview"));
        await page.keyboard.press("6");
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => !document.documentElement.classList.contains("overview") && Reveal.getIndices().h === 5);
        assert.equal(await page.locator("#rebase .superseded").count(), 1, "从总览落到最终步");
        await page.keyboard.press("m");
        await page.waitForFunction(() => document.documentElement.classList.contains("overview"));
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => !document.documentElement.classList.contains("overview"));
        assert.equal(await page.evaluate(() => Reveal.getIndices().h), 5);
        await page.keyboard.press("b");
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains("paused")), true);
        await page.keyboard.press("b");
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains("paused")), false);
        await page.waitForURL(/#\/5(?:\/|$)/);
        await page.reload();
        await page.waitForFunction(() => document.documentElement.classList.contains("ready"));
        assert.equal(await page.evaluate(() => Reveal.getIndices().h), 5, "刷新保留页码");
        if (width === 390) {
          await page.evaluate(() => window.deck.goto(0, 0));
          await page.touchscreen.tap(300, 400);
          await page.waitForFunction(() => Reveal.getIndices().h === 1);
        }
        await page.locator(".gallery-link").click();
        await page.waitForURL(url + "index.html");
      }
      assert.deepEqual(failures, [], `${width}px 资源或脚本错误`);
      await context.close();
    }
    // 不开启 reduced motion，验证实际总览和跨页动画最终收口。
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${url}example/terminal/`);
    await page.waitForFunction(() => document.documentElement.classList.contains("ready"));
    await page.keyboard.press("m");
    await page.waitForTimeout(1600);
    await page.keyboard.press("6");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => !document.documentElement.classList.contains("overview") && Reveal.getIndices().h === 5);
    await page.waitForTimeout(1600);
    assert.equal(
      await page.evaluate(
        () =>
          document
            .getElementById("world")
            .getAnimations()
            .filter(a => a.playState === "running").length,
      ),
      0,
    );
    const popupPromise = page.waitForEvent("popup");
    await page.keyboard.press("s");
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    await popup.waitForFunction(() => document.body.innerText.includes("D′"), null, { timeout: 15000 });
    await popup.close();
  } finally {
    await browser?.close();
    await new Promise(r => server.close(r));
  }
});
