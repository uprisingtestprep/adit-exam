const ACCESS_CODE = "ADIT9000";
const SITTING_SECONDS = 195 * 60;
const BENCHMARK = 50;
const FOCUS = {basic:"basic principles",dtc:"double taxation conventions",pillars:"Pillars One and Two",tp:"transfer pricing and interest",avoidance:"tax avoidance",misc:"miscellaneous"};

let CASES = [], run = null, tick = null;
const $ = id => document.getElementById(id);
const esc = s => { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; };
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
function show(id) { ["gate-screen","list-screen","case-screen","result-screen"].forEach(s => $(s).style.display = s === id ? "" : "none"); $("clock").style.display = id === "case-screen" ? "" : "none"; }
const mmss = s => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" : "") + String(m).padStart(h ? 2 : 1, "0") + ":" + String(x).padStart(2, "0"); };

// ---- gate ----
function gate() {
  if ($("access-code-input").value.trim().toUpperCase() === ACCESS_CODE) { store.set("adit_ok", 1); load(); }
  else $("gate-error").textContent = "Incorrect access code. Check the code printed in your book.";
}
$("gate-submit").onclick = gate;
$("access-code-input").onkeydown = e => { if (e.key === "Enter") gate(); };

async function load() {
  try { CASES = await (await fetch("cases.json")).json(); }
  catch (e) { $("gate-error").textContent = "Could not load the cases. Refresh and try again."; return; }
  renderList(); show("list-screen");
}

// ---- list ----
const done = () => new Set(store.get("adit_done", []));
function sittings() { return [...new Set(CASES.map(c => c.sitting))].sort((a, b) => a - b); }
function sittingPts(s) { return CASES.filter(c => c.sitting === s).reduce((a, c) => a + c.points, 0); }
function renderList() {
  const d = done(), box = $("sittings"); box.innerHTML = "";
  sittings().forEach(s => {
    const cs = CASES.filter(c => c.sitting === s), n = cs.reduce((a, c) => a + c.items.length, 0);
    const el = document.createElement("div"); el.className = "card";
    el.innerHTML = `<div class="num">Mock paper ${s}</div><div class="meta">Questions ${cs[0].id} to ${cs[cs.length - 1].id}<br>Part A: 3 essays, Part B: 2 scenarios<br>Answer 4, 3 hours 15 minutes</div>`;
    const b = document.createElement("button"); b.className = "primary"; b.textContent = "Start full mock paper"; b.style.marginTop = "8px";
    b.onclick = () => start({ mode: "sitting", sitting: s, cases: cs, total: SITTING_SECONDS });
    el.appendChild(b); box.appendChild(el);
  });
  const f = $("filter-sitting");
  if (f.options.length === 1) sittings().forEach(s => f.add(new Option("Mock paper " + s, s)));
  const list = $("case-list"); list.innerHTML = "";
  const fv = f.value, rows = CASES.filter(c => !fv || String(c.sitting) === fv);
  $("case-count").textContent = rows.length + " questions";
  rows.forEach(c => {
    const mins = 45;
    const el = document.createElement("div"); el.className = "card" + (d.has(c.id) ? " done" : "");
    el.innerHTML = `<div class="num">Question ${c.id}${d.has(c.id) ? " &#10003;" : ""} (Part ${c.part})</div><div>${esc(c.title)}</div><div class="meta">25 marks, about ${mins} min</div>` +
      c.focus.map(x => `<span class="tag">${esc(FOCUS[x] || x)}</span>`).join("");
    el.onclick = () => start({ mode: "case", cases: [c], total: mins * 60 });
    list.appendChild(el);
  });
}
$("filter-sitting").onchange = renderList;

// ---- running a sitting or a case ----
function start(cfg) {
  run = { ...cfg, left: cfg.total, running: false, cur: 0, ans: {}, over: false };
  $("mode-label").textContent = cfg.mode === "sitting" ? `Mock paper ${cfg.sitting}` : `Question ${cfg.cases[0].id}`;
  $("timer-btn").textContent = "Start the clock"; $("timer-btn").disabled = false;
  paintTimer(); renderNav(); renderCase(); show("case-screen"); window.scrollTo(0, 0);
}
function paintTimer() { $("timer").textContent = mmss(run.left); $("clock").textContent = mmss(run.left); }
$("timer-btn").onclick = () => {
  if (!run) return;
  if (run.running) { clearInterval(tick); run.running = false; $("timer-btn").textContent = "Resume"; return; }
  run.running = true; $("timer-btn").textContent = "Pause";
  tick = setInterval(() => {
    run.left--; paintTimer();
    if (run.left <= 0) { clearInterval(tick); run.running = false; run.over = true; $("timer-btn").disabled = true; $("timer-btn").textContent = "Time is up"; alert("Time is up. You can still finish your thought, then press Finish and mark my answers."); }
  }, 1000);
};
$("back").onclick = () => { if (run && !confirm("Leave this session? Your answers will be lost.")) return; stop(); renderList(); show("list-screen"); };
function stop() { clearInterval(tick); run = null; }
function key(c, n) { return c.id + ":" + n; }

function renderNav() {
  const nav = $("case-nav"); nav.innerHTML = "";
  run.cases.forEach((c, i) => {
    const b = document.createElement("button"); b.textContent = "Q" + c.id + " (" + c.part + ")";
    b.className = (i === run.cur ? "on " : "") + (c.items.some(it => (run.ans[key(c, it.no)] || "").trim()) ? "ans" : "");
    b.onclick = () => { run.cur = i; renderNav(); renderCase(); window.scrollTo(0, 0); };
    nav.appendChild(b);
  });
  nav.style.display = run.cases.length > 1 ? "" : "none";
  document.querySelector(".layout").style.gridTemplateColumns = run.cases.length > 1 ? "" : "1fr";
}
function renderCase() {
  const c = run.cases[run.cur];
  let h = `<h2>Question ${c.id}: ${esc(c.title)}</h2><p class="note">Part ${c.part}, 25 marks. ${run.mode === "sitting" ? "Answer four questions in all: at least two from Part A and at least one from Part B." : ""}</p><p>${esc(c.scenario)}</p>`;
  c.exhibits.forEach(e => h += `<figure class="exh"><img src="${e.image}" alt="${esc(e.caption)}"><figcaption>${esc(e.caption)}</figcaption></figure>`);
  c.items.forEach(it => {
    h += `<div class="item"><h4>(${String.fromCharCode(96 + it.no)}) [${it.points} marks]</h4><p class="prompt">${esc(it.prompt)}</p>`;
    h += `<textarea data-n="${it.no}" placeholder="Write your answer here" rows="12">${esc(run.ans[key(c, it.no)] || "")}</textarea>`;
    h += "</div>";
  });
  $("case-body").innerHTML = h;
  $("case-body").querySelectorAll("textarea").forEach(t => t.oninput = () => { run.ans[key(c, t.dataset.n)] = t.value; });
  $("case-body").querySelectorAll("input[type=radio]").forEach(r => r.onchange = () => { run.ans[key(c, r.name.slice(1))] = r.value; renderNavKeep(); });
}
function renderNavKeep() { const cur = run.cur; renderNav(); run.cur = cur; }

// ---- marking ----
$("finish-btn").onclick = () => {
  const total = run.cases.length;
  const blank = run.cases.filter(c => !c.items.some(it => (run.ans[key(c, it.no)] || "").trim())).length;
  if (run.mode === "sitting" && total - blank < 4 && !confirm(`Only ${total - blank} of ${total} questions have an answer, and the real paper needs four. Mark anyway?`)) return;
  if (run.mode !== "sitting" && blank && !confirm("This question has no answer. Mark anyway?")) return;
  clearInterval(tick); renderResult(); show("result-screen"); window.scrollTo(0, 0);
};
function renderResult() {
  let h = "";
  run.cases.forEach(c => {
    h += `<div class="qblock" data-c="${c.id}" data-part="${c.part}"><h2>Question ${c.id}: ${esc(c.title)} <span class="qscore"></span></h2>`;
    c.items.forEach(it => {
      const mine = run.ans[key(c, it.no)] || "";
      h += `<div class="item" data-max="${it.points}"><h4>(${String.fromCharCode(96 + it.no)}) [${it.points} marks] <span class="score"></span></h4><p class="prompt">${esc(it.prompt)}</p>`;
      h += `<p><b>Your answer:</b><br>${esc(mine || "(blank)").replace(/\n/g, "<br>")}</p>`;
      h += `<div class="model"><b>Model answer</b><br>${esc(it.answer.model).replace(/\n/g, "<br>")}</div>`;
      h += `<div class="pts"><b>Tick each marking point you covered:</b>`;
      it.answer.points.forEach(p => h += `<label><input type="checkbox" data-p="${p.pts}"> <span class="p">${p.pts} mark${p.pts > 1 ? "s" : ""}</span> <span>${esc(p.point)}</span></label>`);
      h += "</div>";
      if (it.answer.grader_note) h += `<p class="note"><b>Examiner note:</b> ${esc(it.answer.grader_note)}</p>`;
      h += "</div>";
    });
    h += "</div>";
  });
  $("result-body").innerHTML = h;
  $("result-body").querySelectorAll("input[type=checkbox]").forEach(b => b.onchange = tally);
  tally();
}
function bestFour(q) {
  // highest scoring valid choice: four questions, at least two from Part A and at least one from Part B
  const idx = q.map((_, i) => i); let best = null;
  const n = q.length;
  for (let m = 0; m < (1 << n); m++) {
    const pick = idx.filter(i => m & (1 << i));
    if (pick.length !== 4) continue;
    const a = pick.filter(i => q[i].part === "A").length, b = pick.filter(i => q[i].part === "B").length;
    if (a < 2 || b < 1) continue;
    const t = pick.reduce((s, i) => s + q[i].got, 0);
    if (best === null || t > best.t) best = { t, pick };
  }
  return best;
}
function tally() {
  const qs = [];
  $("result-body").querySelectorAll(".qblock").forEach(blk => {
    let got = 0;
    blk.querySelectorAll(".item").forEach(el => {
      let g = 0; el.querySelectorAll("input[type=checkbox]:checked").forEach(b => g += +b.dataset.p);
      g = Math.min(g, +el.dataset.max); got += g;
      el.querySelector(".score").textContent = `${g} / ${el.dataset.max}`;
    });
    blk.querySelector(".qscore").textContent = `${got} / 25`;
    qs.push({ part: blk.dataset.part, got });
  });
  let got, max, note = "";
  if (run.mode === "sitting" && qs.length === 5) {
    const b = bestFour(qs); got = b.t; max = 100;
    note = `<p>Counted: your best valid four questions (${b.pick.map(i => "Q" + run.cases[i].id).join(", ")}). Like the real paper, if you answer more than four, only the best valid combination counts.</p>`;
  } else { got = qs.reduce((s, q) => s + q.got, 0); max = qs.length * 25; }
  const pct = max ? Math.round(1000 * got / max) / 10 : 0;
  $("result-top").innerHTML = `<p class="big">${got} / ${max} marks (${pct}%)</p><div class="meter"><i style="width:${Math.min(100, pct)}%"></i><b style="left:${BENCHMARK}%"></b></div>` +
    `<p>${pct >= BENCHMARK ? "ABOVE" : "BELOW"} the practice benchmark of ${BENCHMARK}% (the red mark). This is only this book's own guide: the pass mark was not stated on the official pages consulted, and you marked your own writing.</p>` + note +
    (run.mode === "case" ? "" : `<p>Mock paper ${run.sitting} of ${sittings().length}.</p>`);
  if (run.mode === "case") { const d = done(); d.add(run.cases[0].id); store.set("adit_done", [...d]); }
}
$("result-back").onclick = () => { stop(); renderList(); show("list-screen"); };

if (store.get("adit_ok", 0)) load();
