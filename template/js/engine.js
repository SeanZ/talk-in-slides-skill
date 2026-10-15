/* talk-in-slides 引擎。
   reveal.js 只当控制器：按键、翻页器、fragment 计步、URL hash、演讲者视图（S）。
   画面是一张 #world 长画布：所有 .frame 横向排开，一台"相机"在它们之间飞。
   每个元素的状态只由 (页, 步) 决定，所以后退、跳页、刷新、总览都精确还原。词汇表见 SKILL.md。
   性能约定：#world 和 .frame 的位移、缩放一律走合成线程（Web Animations / transform 过渡），
   任何代码都不要用 JS 逐帧改它们的 transform 或 left/top，否则浏览器每帧都会把可见区域重新栅格化，页一多就卡。 */
(function () {
  "use strict";
  const W = 1920,
    H = 1080,
    GAP = 2200;
  const MOTIONS = ["fade", "rise", "drop", "left", "right", "pop", "blur", "wipe", "zoom", "pen", "type", "grow", "grow-x"];
  const root = document.documentElement;
  const stage = document.getElementById("stage");
  const world = document.getElementById("world");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const warn = (...a) => console.warn("[deck]", ...a);

  /* ---------- 把 1920x1080 舞台等比放进窗口 ---------- */
  const fit = () => {
    stage.style.transform = `translate(-50%, -50%) scale(${Math.min(innerWidth / W, innerHeight / H)})`;
  };
  fit();
  addEventListener("resize", fit);

  const frames = [...world.children].filter(el => el.classList.contains("frame"));
  const frameOf = el => frames.indexOf(el.closest(".frame"));
  const ms = v => {
    v = String(v || "").trim();
    return v.endsWith("ms") ? parseFloat(v) : v.endsWith("s") ? parseFloat(v) * 1000 : 0;
  };

  /* ---------- data-stagger：子元素依次入场，自动补 data-in / 动效类 / --d ---------- */
  document.querySelectorAll("#world [data-stagger]").forEach(box => {
    const gap = +box.dataset.stagger || 90,
      at = box.dataset.in ?? "0",
      motion = box.dataset.motion || "rise";
    const base = ms(box.style.getPropertyValue("--d"));
    [...box.children].forEach((kid, i) => {
      if (kid.dataset.in === undefined) kid.dataset.in = at;
      if (!MOTIONS.some(m => kid.classList.contains(m))) kid.classList.add(motion);
      kid.style.setProperty("--d", base + i * gap + "ms");
    });
    delete box.dataset.in;
    box.classList.remove(...MOTIONS);
  });

  /* ---------- .type 打字机：拆成单字，词不跨行 ---------- */
  document.querySelectorAll("#world .type").forEach(el => {
    const text = el.textContent;
    el.textContent = "";
    let i = 0;
    text.split(/(\s+)/).forEach(w => {
      if (!w) return;
      if (/^\s+$/.test(w)) {
        el.append(" ");
        return;
      }
      const word = document.createElement("span");
      word.className = "w";
      for (const c of w) {
        const s = document.createElement("span");
        s.className = "ch";
        s.textContent = c;
        s.style.setProperty("--i", i++);
        word.append(s);
      }
      el.append(word);
    });
  });

  /* ---------- .pen 描线：图形统一 pathLength=1，CSS 只需 dashoffset 1 → 0 ---------- */
  document
    .querySelectorAll("#world .pen")
    .forEach(el =>
      el.querySelectorAll("path, line, polyline, polygon, rect, circle, ellipse").forEach(s => s.setAttribute("pathLength", "1")),
    );

  /* ---------- 收集带状态的元素 ---------- */
  const step = (v, el, attr) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) warn(`${attr}="${v}" 不是步号`, el);
    return n;
  };
  const items = [];
  document.querySelectorAll("#world [data-in], #world [data-state], #world [data-count]").forEach(el => {
    const fi = frameOf(el);
    if (fi < 0) return;
    const r = { el, fi };
    if (el.dataset.in !== undefined) {
      r.a = step(el.dataset.in, el, "data-in");
      r.b = el.dataset.out !== undefined ? step(el.dataset.out, el, "data-out") : Infinity;
    }
    if (el.dataset.state)
      r.states = el.dataset.state
        .trim()
        .split(/\s+/)
        .map(tok => {
          const [cls, rng = ""] = tok.split("@");
          const [a, b] = rng.split("-");
          return { cls, a: step(a, el, "data-state"), b: b === undefined ? Infinity : step(b, el, "data-state") };
        });
    if (el.dataset.count !== undefined) r.count = step(el.dataset.count, el, "data-count");
    items.push(r);
  });

  /* ---------- 页表：步数取用到的最大步号 + 1，章节名向后继承 ---------- */
  let part = "";
  const F = frames.map((el, i) => {
    const named = !!el.id;
    if (!named) el.id = "f" + (i + 1);
    if (el.dataset.part !== undefined) part = el.dataset.part;
    const used = items
      .filter(r => r.fi === i)
      .flatMap(r => [r.a, r.b, r.count, ...(r.states || []).flatMap(s => [s.a, s.b])])
      .filter(Number.isFinite);
    const auto = used.length ? Math.max(...used) + 1 : 1;
    if (el.dataset.steps && +el.dataset.steps < auto) warn(`#${el.id}: data-steps=${el.dataset.steps}，但用到了第 ${auto - 1} 步`);
    const cams = (el.dataset.cam || "")
      .split(";")
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s.split(",").map(Number));
    el.style.left = i * GAP + "px";
    el.style.top = "0px";
    // 总览：缩略图下的页名用作者起的 id（短、等宽好对齐），底部提示条再给完整标题；没起 id 的页退回标题
    const heading = el.querySelector(".h1, .h2, .h3, .stat-big, .quote-text");
    const title = heading ? heading.textContent.replace(/\s+/g, " ").trim() : el.id;
    const label = document.createElement("div");
    label.className = "frame-label";
    label.innerHTML = `<b>${String(i + 1).padStart(2, "0")}</b>`;
    label.append(named ? el.id : title);
    el.append(label);
    return {
      el,
      i,
      id: el.id,
      title,
      steps: Math.max(auto, +el.dataset.steps || 1),
      part,
      cams,
      x: i * GAP,
      y: 0,
      chrome: el.dataset.chrome !== "off",
    };
  });
  world.style.width = F.length * GAP + "px";

  /* ---------- 为 reveal 生成空 section：fragment 数 = 步数 - 1，备注从 frame 搬过去 ---------- */
  const slidesEl = document.querySelector(".reveal .slides");
  F.forEach(f => {
    const sec = document.createElement("section");
    for (let k = 1; k < f.steps; k++) sec.append(Object.assign(document.createElement("span"), { className: "fragment" }));
    const notes = f.el.querySelector("aside.notes");
    if (notes) sec.append(notes);
    slidesEl.append(sec);
  });

  /* ---------- 相机：位移线性插值，缩放在对数空间插值；远距离时先拉远再推近 ---------- */
  let cam = null,
    camRaf = 0,
    camAnims = [];
  const camFor = p => {
    const f = F[p.fi],
      c = f.cams.length ? f.cams[Math.min(Math.max(p.step, 0), f.cams.length - 1)] : [0, 0, 1];
    return [f.x + 960 + (c[0] || 0), f.y + 540 + (c[1] || 0), c[2] || 1];
  };
  const camCSS = c => `translate(${W / 2 - c[0] * c[2]}px, ${H / 2 - c[1] * c[2]}px) scale(${c[2]})`;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const distTo = t => Math.hypot(t[0] - cam[0], t[1] - cam[1]) * Math.min(cam[2], t[2]);
  const flightTime = t => {
    if (!cam || reduced) return 0;
    const d = distTo(t);
    return d < 1 && Math.abs(t[2] - cam[2]) < 1e-3 ? 0 : Math.min(2200, 900 + d * 0.22);
  };
  // 飞行路径采样成关键帧，交给合成线程播放：用 JS 逐帧改 transform 会让浏览器每一帧都按新比例重新栅格化整个可见区域。
  // 缩放每变化 2 倍就切成一段新动画，浏览器按每段的最大缩放栅格化：拉远时不会按原尺寸画整张画布，推近时也不会一开始就按终点尺寸画全部页面
  // anchor：让某一页在屏幕上走直线。pos(e) 是它的画布中心（可以随自己的过渡移动），s0/s1 是它相对视口中心的起止屏幕偏移；
  // 镜头位置由此反推。进出总览时用它锚住选中页，否则位移线性、缩放对数，叠在一起那一页会在屏幕上来回晃
  function flyTo(t, dur, lift = true, anchor = null) {
    cancelAnimationFrame(camRaf);
    camAnims.forEach(x => x.cancel());
    camAnims = [];
    world.style.transform = camCSS(t);
    if (!cam || !dur) {
      cam = t.slice();
      return;
    }
    const a = cam.slice(),
      far = lift && distTo(t) > 2600,
      la = Math.log(a[2]),
      lb = Math.log(t[2]);
    const dip = far ? Math.log(Math.min(a[2], t[2]) * 0.6) - Math.min(la, lb) : 0;
    const at = k => {
      const e = ease(k),
        z = Math.exp(la + (lb - la) * e + dip * Math.sin(Math.PI * k));
      if (!anchor) return [a[0] + (t[0] - a[0]) * e, a[1] + (t[1] - a[1]) * e, z];
      const P = anchor.pos(e),
        sx = anchor.s0[0] + (anchor.s1[0] - anchor.s0[0]) * e,
        sy = anchor.s0[1] + (anchor.s1[1] - anchor.s0[1]) * e;
      return [P[0] - sx / z, P[1] - sy / z, z];
    };
    const n = Math.ceil(dur / 20),
      pts = Array.from({ length: n + 1 }, (_, j) => at(j / n));
    for (let s = 0, j = 1, z0 = pts[0][2]; j <= n; j++)
      if (j === n || pts[j][2] > z0 * 2 || pts[j][2] < z0 / 2) {
        camAnims.push(
          world.animate(
            pts.slice(s, j + 1).map(c => ({ transform: camCSS(c) })),
            { duration: ((j - s) * dur) / n, delay: (s * dur) / n, fill: "forwards" },
          ),
        );
        s = j;
        z0 = pts[j][2];
      }
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      cam = at(k);
      if (k < 1) camRaf = requestAnimationFrame(tick);
    }; // 只记录镜头位置，供中途改道时接上

    camRaf = requestAnimationFrame(tick);
  }

  /* ---------- 状态应用 ---------- */
  let overview = false;
  const localStep = (fi, p) => (overview || fi < p.fi ? F[fi].steps - 1 : fi > p.fi ? -1 : p.step);
  const fmt = (v, d) =>
    (d.prefix || "") +
    v.toLocaleString(root.lang || "en", { minimumFractionDigits: +(d.dec || 0), maximumFractionDigits: +(d.dec || 0) }) +
    (d.suffix || "");
  function count(r, s, roll, delay) {
    const el = r.el,
      d = el.dataset,
      from = +(d.from || 0),
      to = s >= r.count ? +d.to : from;
    if (roll && el._v === to) return;
    el._v = to;
    cancelAnimationFrame(el._raf);
    clearTimeout(el._t);
    if (!roll || reduced) {
      el.textContent = fmt(to, d);
      return;
    }
    el.textContent = fmt(from, d);
    const dur = +d.dur || 1400;
    el._t = setTimeout(
      () => {
        const t0 = performance.now();
        const tick = now => {
          const k = Math.min(1, (now - t0) / dur);
          el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 4)), d);
          if (k < 1) el._raf = requestAnimationFrame(tick);
        };
        el._raf = requestAnimationFrame(tick);
      },
      delay + ms(getComputedStyle(el).getPropertyValue("--d")),
    );
  }
  function apply(p, forward, arrive) {
    items.forEach(r => {
      const s = localStep(r.fi, p);
      if (r.a !== undefined) r.el.classList.toggle("on", s >= r.a && s < r.b);
      if (r.states) {
        // 同一个 class 的多段区间取并集
        const on = {};
        r.states.forEach(t => {
          on[t.cls] = on[t.cls] || (s >= t.a && s < t.b);
        });
        Object.entries(on).forEach(([cls, v]) => r.el.classList.toggle(cls, v));
      }
      if (r.count !== undefined) count(r, s, forward && r.fi === p.fi && s === r.count, arrive);
    });
  }

  /* ---------- 视频：所在步可见时从头播放，离开即暂停回到开头 ---------- */
  function media(p) {
    F.forEach((f, i) =>
      f.el.querySelectorAll("video").forEach(v => {
        const host = v.closest("[data-in]");
        const at = v.dataset.play !== undefined ? +v.dataset.play : host && f.el.contains(host) ? +host.dataset.in : 0;
        const live = !overview && i === p.fi && p.step >= at;
        if (live === !!v._live) return;
        v._live = live;
        if (live) {
          v.currentTime = +(v.dataset.start || 0);
          const pr = v.play();
          if (pr) pr.catch(() => {});
        } else {
          v.pause();
          v.currentTime = +(v.dataset.start || 0);
        }
      }),
    );
  }

  /* ---------- 与 reveal 同步 ---------- */
  const HOOKS = () => window.DECK_HOOKS || {};
  const partEl = document.getElementById("part"),
    folioEl = document.getElementById("folio"),
    progEl = document.getElementById("progress");
  let cur = null;
  const position = () => {
    const ix = Reveal.getIndices();
    return { fi: ix.h || 0, step: ix.f == null || ix.f < 0 ? 0 : ix.f + 1 };
  };
  const isNext = (a, b) => (a.fi === b.fi && b.step === a.step + 1) || (b.fi === a.fi + 1 && b.step === 0 && a.step === F[a.fi].steps - 1);
  function update(animate) {
    const prev = cur,
      p = position();
    if (animate && prev && prev.fi === p.fi && prev.step === p.step) return;
    cur = p;
    const f = F[p.fi],
      moved = !prev || prev.fi !== p.fi,
      target = camFor(p);
    const dur = animate ? flightTime(target) : 0,
      arrive = moved && dur ? Math.round(dur * 0.45) : 0;
    F.forEach(g => g.el.style.setProperty("--arrive", g === f ? arrive + "ms" : "0ms"));
    if (moved && prev && HOOKS()[F[prev.fi].id]?.leave) HOOKS()[F[prev.fi].id].leave();
    HOOKS()[f.id]?.enter?.(p.step);
    apply(p, animate && prev && isNext(prev, p), arrive);
    media(p);
    flyTo(target, dur);
    stage.classList.toggle("chrome-off", !f.chrome || target[2] > 1.01); // 推近时页眉页脚让位
    if (partEl) partEl.textContent = f.part;
    if (folioEl) folioEl.textContent = String(p.fi + 1).padStart(2, "0") + " / " + String(F.length).padStart(2, "0");
    if (progEl) progEl.style.transform = `scaleX(${(p.fi + (p.step + 1) / f.steps) / F.length})`;
  }

  /* ---------- 总览（M 或右下角按钮）：所有页排成网格并显示完成态；方向键/鼠标/数字选择，Enter 飞入，Esc 返回 ---------- */
  // 网格几何（画布像素）：行距 = 页高 + 页名 + 行间留白；整张网格的外缘再留出选中框的位置
  const CELL_H = 1400,
    LABEL_H = 190, // 页名底边到页面底边的距离
    EDGE = 60, // 选中框外扩 34px，网格不能贴着 #world 的边
    TOP = 56, // 屏幕上留给网格顶边的像素
    HUD_H = 150; // 屏幕底部留给提示条的像素
  const gridSize = cols => {
    const rows = Math.ceil(F.length / cols);
    return [(cols - 1) * GAP + W + 2 * EDGE, (rows - 1) * CELL_H + H + LABEL_H + 2 * EDGE];
  };
  const zoomFor = ([gw, gh]) => Math.min((W - 120) / gw, (H - TOP - HUD_H) / gh);
  // 列数取让缩略图最大的那个，页数多少都能把屏幕占满
  const COLS = F.reduce((best, _, k) => (zoomFor(gridSize(k + 1)) > zoomFor(gridSize(best)) ? k + 1 : best), 1);
  const gridXY = i => [EDGE + (i % COLS) * GAP, EDGE + Math.floor(i / COLS) * CELL_H];
  const hud = document.getElementById("navhud");
  let sel = 0,
    typed = "";
  function select(i) {
    sel = Math.max(0, Math.min(F.length - 1, i));
    F.forEach((g, k) => g.el.classList.toggle("sel", k === sel));
    if (hud) {
      // 底部提示条：编号、标题、操作提示（和页名标签同源）
      const el = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
      hud.replaceChildren(
        el("b", String(sel + 1).padStart(2, "0")),
        el("span", F[sel].title),
        el("em", root.lang.startsWith("zh") ? "Enter 进入 · Esc 返回" : "Enter to open · Esc to go back"),
      );
    }
  }
  function openOverview() {
    if (overview || !cur) return;
    overview = true;
    root.classList.add("overview");
    Reveal.configure({ keyboard: false });
    const [gw, gh] = gridSize(COLS),
      z = zoomFor([gw, gh]);
    world.style.height = gh + "px"; // 网格要整个落在 #world 的盒子里，超出部分会被拆成一页一张的独立图层
    root.classList.add("snap");
    apply(cur, false, 0);
    media(cur); // 所有页直接跳到完成态，飞行中没有元素在做过渡
    select(cur.fi);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        // 完成态落定后再动：各页从长画布滑进网格，离当前页越远起步越晚，镜头同时拉远。
        // 远处的页晚到，画面里要栅格化的内容是逐渐增多的，而不是镜头拉开到一半时一下子全涌进来
        root.classList.remove("snap");
        // 当前页不做过渡，直接放到格位，镜头同时瞬移同样的距离，画面上看不出任何变化。
        // 这样它的屏幕位置完全由镜头决定：CSS 过渡和镜头动画是两套时钟，差 1% 的进度乘上几万像素的位移就是肉眼可见的晃动
        const f = F[cur.fi],
          [gx, gy] = gridXY(cur.fi);
        F.forEach((g, i) => {
          const [x, y] = gridXY(i);
          g.el.style.transition = i === cur.fi ? "none" : "";
          g.el.style.transitionDelay = Math.abs(i - cur.fi) * 10 + "ms";
          g.el.style.transform = `translate(${x - g.x}px, ${y - g.y}px)`;
        });
        flyTo([cam[0] - f.x + gx, cam[1] - f.y + gy, cam[2]], 0);
        requestAnimationFrame(() => (f.el.style.transition = ""));
        // 网格落在提示条上方的区域里居中；镜头路径以当前页为锚：它在屏幕上从中心直线滑到自己的格位
        const target = [gw / 2, gh / 2 + (H / 2 - (TOP + H - HUD_H) / 2) / z, z],
          F1 = [gx + 960, gy + 540];
        flyTo(target, reduced ? 0 : 1300, false, {
          pos: () => F1,
          s0: [(F1[0] - cam[0]) * cam[2], (F1[1] - cam[1]) * cam[2]],
          s1: [(F1[0] - target[0]) * z, (F1[1] - target[1]) * z],
        });
      }),
    );
  }
  function closeOverview(k) {
    if (!overview || root.classList.contains("overview-leaving")) return;
    const [x, y] = gridXY(k),
      same = k === cur.fi,
      land = same ? cur : { fi: k, step: F[k].steps - 1 }; // 换页时落在最终步：缩略图里看到的就是它，落地不闪
    const c = camFor(land),
      g0 = F[k],
      target = [c[0] - g0.x + x, c[1] - g0.y + y, c[2]], // 该步的镜头换算到网格坐标
      F1 = [x + 960, y + 540];
    F.forEach((g, i) => g.el.classList.toggle("focus", i === k)); // 其余页在潜入时淡出，落地后换布局就看不出来
    root.classList.add("overview-leaving");
    flyTo(target, reduced ? 0 : 1000, false, {
      pos: () => F1,
      s0: [(F1[0] - cam[0]) * cam[2], (F1[1] - cam[1]) * cam[2]],
      s1: [(F1[0] - target[0]) * c[2], (F1[1] - target[1]) * c[2]],
    }); // 潜入网格里的那一页，目标页在屏幕上走直线
    setTimeout(
      () => {
        root.classList.add("snap"); // 再在底下无声地把布局换回长画布
        F.forEach(g => {
          g.el.style.transform = "";
          g.el.style.transition = "";
          g.el.style.transitionDelay = "";
          g.el.style.left = g.x + "px";
          g.el.style.top = g.y + "px";
          g.el.classList.remove("sel", "focus");
        });
        world.style.height = "";
        overview = false;
        root.classList.remove("overview", "overview-leaving");
        Reveal.configure({ keyboard: true });
        flyTo(c, 0);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            root.classList.remove("snap");
            if (same) {
              apply(cur, false, 0); // 回到当前步：比当前步晚的元素淡出，不是瞬间消失
              media(cur);
            } else Reveal.slide(k, 0, F[k].steps - 2); // 最终步 = fragment 下标 steps-2
          }),
        );
      },
      reduced ? 0 : 1020,
    );
  }
  addEventListener(
    "keydown",
    e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!overview) {
        if ((e.key === "m" || e.key === "M") && !e.repeat) {
          e.preventDefault();
          openOverview();
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape" || e.key === "m" || e.key === "M") return closeOverview(cur.fi);
      if (e.key === "Enter") {
        const n = typed ? +typed - 1 : sel;
        typed = "";
        return closeOverview(n >= 0 && n < F.length ? n : sel);
      }
      if (/^[0-9]$/.test(e.key)) {
        typed = (typed + e.key).slice(-2);
        if (+typed >= 1 && +typed <= F.length) select(+typed - 1);
        return;
      }
      const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
      if (mv) select(sel + mv);
    },
    true,
  );
  F.forEach((g, k) => {
    // 用 mousemove 而不是 mouseenter：打开总览时各页会从静止的指针底下滑过，mouseenter 会把选中页抢走
    g.el.addEventListener("mousemove", e => {
      if (overview && !root.classList.contains("overview-leaving") && (e.movementX || e.movementY)) select(k);
    });
    g.el.addEventListener("click", e => {
      if (overview) {
        e.stopPropagation();
        closeOverview(k);
      }
    });
  });
  document.getElementById("navbtn")?.addEventListener("click", () => (overview ? closeOverview(cur.fi) : openOverview()));

  /* ---------- 触屏：点左侧 30% 后退、其余前进，左右滑翻页；跳过双指、已放大、可交互元素 ---------- */
  let touch = null;
  addEventListener(
    "touchstart",
    e => {
      const t = e.touches[0],
        zoomed = window.visualViewport && visualViewport.scale > 1.05;
      touch =
        e.touches.length !== 1 ||
        overview ||
        zoomed ||
        e.target.closest?.("a, button, input, textarea, select, video[controls], [data-no-nav]")
          ? null
          : { x: t.clientX, y: t.clientY, t: performance.now() };
    },
    { passive: true },
  );
  addEventListener(
    "touchmove",
    e => {
      if (e.touches.length > 1) touch = null;
    },
    { passive: true },
  );
  addEventListener(
    "touchend",
    e => {
      const g = touch;
      touch = null;
      if (!g || e.touches.length) return;
      const t = e.changedTouches[0],
        dx = t.clientX - g.x,
        dy = t.clientY - g.y,
        dt = performance.now() - g.t;
      if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy) && dt < 800) return dx < 0 ? Reveal.next() : Reveal.prev();
      if (Math.hypot(dx, dy) < 12 && dt < 400) (g.x < innerWidth * 0.3 ? Reveal.prev : Reveal.next)();
    },
    { passive: true },
  );

  Reveal.initialize({
    width: W,
    height: H,
    hash: true,
    controls: false,
    progress: false,
    center: false,
    overview: false,
    help: false,
    touch: false,
    transition: "none",
    backgroundTransition: "none",
    scrollActivationWidth: null,
    plugins: window.RevealNotes ? [RevealNotes] : [],
  });
  ["slidechanged", "fragmentshown", "fragmenthidden"].forEach(ev => Reveal.on(ev, () => update(true)));
  Reveal.on("paused", () => root.classList.add("paused")); // B / . 黑场（这里是纸色场）
  Reveal.on("resumed", () => root.classList.remove("paused"));
  const ready = new Promise(r => Reveal.on("ready", r));
  Promise.all([ready, document.fonts.ready]).then(() => {
    update(false);
    root.classList.add("ready");
  });

  /* 给截图/检查工具用：瞬时跳到某页某步 */
  window.deck = {
    frames: F.map(f => ({ id: f.id, steps: f.steps })),
    goto(fi, s) {
      Reveal.slide(fi, 0, s - 1);
      update(false);
    },
    overview: open => (open ? openOverview() : closeOverview(cur.fi)),
  };
})();
