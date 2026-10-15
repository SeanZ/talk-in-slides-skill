/* talk-in-slides 排版助手，在 engine.js 之前加载。
   1. ==重点== → <em class="em">重点</em>（只认这一种标记；按文本节点构建 DOM，不用 innerHTML）
   2. 直引号 → 弯引号：双引号在同一文本块内按成对规则开合，单引号按前一个字符判断（英文缩写 don't 正确）
   3. 紧挨中文的 “ ” ‘ ’ — … 包进 <span class="cjk-punct">，用中文字体渲染成全宽
   4. 数字与单位之间换成不换行空格："115 ms" 永不拆行
   跳过：<code> <pre> <kbd> <script> <style> <textarea>、.type .mono .num .contact、[data-no-typeset] 子树（命令和代码里的直引号保持原样） */
(function () {
  const UNITS = ["ms", "s", "min", "h", "px", "pt", "fps", "%", "×", "x", "B", "K", "M", "KB", "MB", "GB", "TB", "tok", "k", "w"]
    .concat(window.TYPESET_UNITS || [])
    .sort((a, b) => b.length - a.length)
    .map(u => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const reUnit = new RegExp("(\\d)[ \\t]+(" + UNITS + ")(?![\\p{L}\\p{N}])", "gu");
  const reEm = /==(\S(?:[^=]*?\S)?)==/g;
  const OPEN = /[\s([{—–\-/“‘「『（]/;
  const CJK = /[　-〿㐀-鿿＀-￯]/;
  const SKIP = "code, pre, kbd, samp, script, style, textarea, .type, .mono, .num, .contact, [data-no-typeset]";
  const BLOCK = "p, h1, h2, h3, h4, li, td, th, figcaption, blockquote, div, text, .card, .stat-big";

  function textNodes(scope) {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement.closest(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const nodes = [];
    for (let n; (n = walker.nextNode());) nodes.push(n);
    return nodes;
  }

  /* 用 re 切分文本节点，匹配部分交给 make 生成元素 */
  function split(n, re, make) {
    const s = n.nodeValue,
      frag = document.createDocumentFragment();
    let last = 0,
      hit = false;
    for (const m of s.matchAll(re)) {
      const el = make(m, s);
      if (!el) continue;
      hit = true;
      frag.append(s.slice(last, m.index), el);
      last = m.index + m[0].length;
    }
    if (!hit) return;
    frag.append(s.slice(last));
    n.replaceWith(frag);
  }

  function run(scope) {
    let block = null,
      prev = "",
      open = false;
    textNodes(scope).forEach(n => {
      const b = n.parentElement.closest(BLOCK);
      if (b !== block) {
        block = b;
        prev = "";
        open = false;
      }
      let out = "";
      for (const c of n.nodeValue) {
        if (c === '"') {
          out += open ? "”" : "“";
          open = !open;
        } else if (c === "'") out += !prev || OPEN.test(prev) ? "‘" : "’";
        else out += c;
        prev = c;
      }
      n.nodeValue = out.replace(reUnit, "$1 $2");
    });
    textNodes(scope).forEach(n => split(n, reEm, m => Object.assign(document.createElement("em"), { className: "em", textContent: m[1] })));
    textNodes(scope).forEach(n =>
      split(n, /[“”‘’—…]+/g, (m, s) => {
        if (!CJK.test(s[m.index - 1] || "") && !CJK.test(s[m.index + m[0].length] || "")) return null;
        return Object.assign(document.createElement("span"), { className: "cjk-punct", textContent: m[0] });
      }),
    );
  }

  document.querySelectorAll("#world .frame").forEach(run);
})();
