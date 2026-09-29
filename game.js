(() => {
  "use strict";
  const STORAGE_KEY = "exponent-log-card-arena-settings-v1";
  const DEFAULTS = { exp: true, log: true, easyCount: 4, mediumCount: 4, hardCount: 2, easyCandidates: 12, mediumCandidates: 12, hardCandidates: 12, easySeconds: 20, mediumSeconds: 40, hardSeconds: 60 };
  const LEVELS = { easy: { name: "簡單", size: 2 }, medium: { name: "中等", size: 3 }, hard: { name: "困難", size: 4 } };
  const LABELS = ["左區", "中區", "右區"];
  const $lanes = document.getElementById("lanes");
  const $dialog = document.getElementById("settingsDialog");
  const $form = document.getElementById("settingsForm");
  const lanes = LABELS.map(() => ({ phase: "idle", player: "", deck: [], index: -1, score: 0, correct: 0, selected: [], deadline: 0, remaining: 0, message: "", feedbackTimer: null, hintTimer: null }));
  const random = (n) => Math.floor(Math.random() * n);
  const pick = (array) => array[random(array.length)];
  const shuffle = (input) => { const a = [...input]; for (let i = a.length - 1; i > 0; i--) { const j = random(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const escapeText = (value) => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[ch]);

  function readSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return { ...DEFAULTS };
      const values = { ...DEFAULTS };
      for (const key of Object.keys(DEFAULTS)) if (typeof saved[key] === typeof DEFAULTS[key]) values[key] = saved[key];
      if (!values.exp && !values.log) return { ...DEFAULTS };
      return values;
    } catch { return { ...DEFAULTS }; }
  }
  let settings = readSettings();

  function powerMarkup(base, units) {
    let power;
    if (units % 2 === 0) power = String(units / 2);
    else power = `${units < 0 ? "−" : ""}${Math.abs(units)}/2`;
    return `<span class="math-term">${base}<sup>${power}</sup></span>`;
  }
  const logMarkup = (n) => `<span class="math-term">log&nbsp;${n}</span>`;
  const cardMarkup = (q, value) => q.kind === "exp" ? powerMarkup(q.base, value) : logMarkup(value);

  function signature(q, vals) {
    const positive = [], negative = [];
    vals.forEach((value, i) => (q.signs[i] === 1 ? positive : negative).push(value));
    return `${positive.sort((a, b) => a - b).join(",")}|${negative.sort((a, b) => a - b).join(",")}`;
  }
  function correctValues(q, vals) {
    if (q.kind === "exp") return vals.reduce((sum, n, i) => sum + q.signs[i] * n, 0) === q.targetUnits;
    let positive = 1, negative = q.target;
    vals.forEach((n, i) => { if (q.signs[i] === 1) positive *= n; else negative *= n; });
    return positive === negative;
  }
  function findSolutions(q, maximum = 3) {
    const solutions = [], unique = new Set(), used = new Set(), chosen = [];
    function walk() {
      if (solutions.length >= maximum) return;
      if (chosen.length === q.signs.length) {
        const vals = chosen.map(i => q.cards[i].value);
        const key = signature(q, vals);
        if (!unique.has(key) && correctValues(q, vals)) { unique.add(key); solutions.push([...chosen]); }
        return;
      }
      for (let i = 0; i < q.cards.length && solutions.length < maximum; i++) {
        if (used.has(i)) continue;
        used.add(i); chosen.push(i); walk(); chosen.pop(); used.delete(i);
      }
    }
    walk();
    return solutions;
  }

  function exponentQuestion(level, candidateCount) {
    const size = LEVELS[level].size;
    const form = size === 2 ? pick(["product", "quotient"]) : size === 3 ? pick(["product", "quotient"]) : pick(["product", "quotient"]);
    const signs = form === "product" ? Array(size).fill(1) : size === 2 ? [1, -1] : size === 3 ? [1, 1, -1] : [1, 1, -1, -1];
    const half = level !== "easy" && Math.random() < (level === "hard" ? .38 : .22);
    const base = pick(level === "hard" ? [2, 3, 5, 7] : [2, 3, 5]);
    for (let attempt = 0; attempt < 30; attempt++) {
      const low = level === "easy" ? -3 : level === "medium" ? -6 : -8;
      const high = Math.max(level === "easy" ? 14 : level === "medium" ? 16 : 19, low + candidateCount + 3);
      const universe = Array.from({ length: (high - low + 1) * (half ? 2 : 1) }, (_, i) => half ? low * 2 + i : (low + i) * 2);
      const targetUnits = half ? 2 * (random(13) - 2) + 1 : 2 * (level === "easy" ? random(10) + (form === "quotient" ? -3 : 3) : random(18) - 5);
      const values = shuffle(universe).slice(0, candidateCount);
      const q = { kind: "exp", level, base, form, signs, targetUnits, cards: shuffle(values).map((value, id) => ({ id, value })) };
      q.solutions = findSolutions(q);
      if (q.solutions.length >= 3) return q;
    }
    // The wide integer pool below is a deterministic fallback if repeated random draws are unusually unlucky.
    const vals = Array.from({ length: candidateCount }, (_, i) => 2 * (i - 4));
    const fallbackTarget = form === "quotient" ? -1 : size === 2 ? -1 : size === 3 ? -3 : -2;
    const q = { kind: "exp", level, base: 3, form, signs, targetUnits: 2 * fallbackTarget, cards: shuffle(vals).map((value, id) => ({ id, value })) };
    q.solutions = findSolutions(q);
    if (q.solutions.length < 3) throw new Error("指數題的候選卡片不足三解");
    return q;
  }

  function logWitnesses(form, target) {
    const result = [];
    function add(values) { if (new Set(values).size === values.length) result.push(values); }
    if (form === "sum2") {
      for (let a = 2; a <= 80; a++) { const b = target / a; if (Number.isInteger(b) && b > a && b <= 100) add([a, b]); }
    } else if (form === "difference2") {
      for (let b = 2; b <= 12; b++) add([target * b, b]);
    } else if (form === "sum3") {
      for (let a = 2; a <= 40; a++) for (let b = a + 1; b <= 45; b++) { const c = target / a / b; if (Number.isInteger(c) && c > b && c <= 100) add([a, b, c]); }
    } else if (form === "mixed3") {
      for (let a = 2; a <= 45; a++) for (let b = a + 1; b <= 60; b++) { const c = a * b / target; if (Number.isInteger(c) && c >= 2 && c <= 40) add([a, b, c]); }
    } else if (form === "sum4") {
      for (let a = 2; a <= 25; a++) for (let b = a + 1; b <= 30; b++) for (let c = b + 1; c <= 35; c++) { const d = target / (a * b * c); if (Number.isInteger(d) && d > c && d <= 100) add([a, b, c, d]); }
    } else if (form === "mixed4") {
      for (let a = 2; a <= 25; a++) for (let b = a + 1; b <= 28; b++) for (let c = b + 1; c <= 32; c++) { const d = a * b * c / target; if (Number.isInteger(d) && d >= 2 && d <= 50) add([a, b, c, d]); }
    }
    return result;
  }

  function logarithmQuestion(level, candidateCount) {
    const form = pick(level === "easy" ? ["sum2", "difference2"] : level === "medium" ? ["sum3", "mixed3"] : ["sum4", "mixed4"]);
    const targets = { sum2: [36, 48, 60, 72, 90], difference2: [3, 4, 5, 6, 8, 10], sum3: [60, 72, 90, 120, 180], mixed3: [12, 18, 20, 24, 30], sum4: [360, 420, 480, 600, 720], mixed4: [24, 30, 36, 40] };
    let target = pick(targets[form]);
    const signs = form.startsWith("sum") ? Array(LEVELS[level].size).fill(1) : [...Array(LEVELS[level].size - 1).fill(1), -1];
    const witnesses = shuffle(logWitnesses(form, target));
    const valueSet = new Set(), distinct = new Set();
    for (const witness of witnesses) {
      const key = `${witness.slice(0, signs.filter(s => s === 1).length).join(",")}|${witness.slice(signs.filter(s => s === 1).length).join(",")}`;
      const union = new Set([...valueSet, ...witness]);
      if (distinct.has(key) || union.size > candidateCount) continue;
      witness.forEach(v => valueSet.add(v)); distinct.add(key);
      if (distinct.size >= 4) break;
    }
    // Eight-card seeds also guarantee three genuinely different combinations.
    const compact = {
      sum2: { target: 60, values: [4, 15, 5, 12, 6, 10, 2, 3] },
      difference2: { target: 6, values: [12, 2, 18, 3, 24, 4, 30, 5] },
      sum3: { target: 60, values: [2, 3, 4, 5, 6, 10, 15, 20] },
      mixed3: { target: 12, values: [2, 3, 4, 6, 8, 9, 12, 16] },
      sum4: { target: 360, values: [2, 3, 4, 5, 6, 9, 10, 12] },
      mixed4: { target: 24, values: [2, 3, 4, 5, 6, 8, 9, 10] }
    };
    if (distinct.size < 3) { target = compact[form].target; valueSet.clear(); compact[form].values.forEach(v => valueSet.add(v)); }
    const maxCard = form === "difference2" ? 120 : form === "sum4" ? 90 : 100;
    for (const n of shuffle(Array.from({ length: maxCard }, (_, i) => i + 1))) {
      if (valueSet.size >= candidateCount) break;
      valueSet.add(n);
    }
    const q = { kind: "log", level, target, form, signs, cards: shuffle([...valueSet]).map((value, id) => ({ id, value })) };
    q.solutions = findSolutions(q);
    if (q.solutions.length < 3) throw new Error("對數候選卡片不足三解");
    return q;
  }

  function makeDeck(config) {
    const deck = [], subjects = [config.exp && "exp", config.log && "log"].filter(Boolean);
    let subjectOffset = random(subjects.length);
    for (const level of ["easy", "medium", "hard"]) {
      const amount = config[`${level}Count`];
      const group = [];
      for (let i = 0; i < amount; i++) {
        const subject = subjects[(subjectOffset + i) % subjects.length];
        const q = subject === "exp" ? exponentQuestion(level, config[`${level}Candidates`]) : logarithmQuestion(level, config[`${level}Candidates`]);
        q.seconds = config[`${level}Seconds`];
        group.push(q);
      }
      subjectOffset += amount;
      deck.push(...shuffle(group));
    }
    return deck;
  }

  function currentQuestion(lane) { return lane.deck[lane.index]; }
  function selectedValues(lane) {
    const q = currentQuestion(lane);
    return lane.selected.map(id => id == null ? null : q.cards[id].value);
  }
  function promptMarkup(q, selection) {
    let next = 0;
    const slot = () => {
      const i = next++, value = selection[i];
      return `<button type="button" class="slot ${value == null ? "" : "filled"}" data-action="unselect" data-slot="${i}" aria-label="第 ${i + 1} 格${value == null ? "，尚未填入" : "，點擊取消"}"><span class="slot-number">${i + 1}</span>${value == null ? "?" : cardMarkup(q, value)}</button>`;
    };
    const left = q.kind === "exp" ? powerMarkup(q.base, q.targetUnits) : logMarkup(q.target);
    if (q.kind === "exp" && q.form === "quotient") {
      const numeratorCount = q.signs.filter(s => s === 1).length;
      const numerator = Array.from({ length: numeratorCount }, slot).join('<span class="operator">×</span>');
      const denominator = Array.from({ length: q.signs.length - numeratorCount }, slot).join('<span class="operator">×</span>');
      return `${left}<span class="operator">=</span><span class="frac"><span class="frac-part top">${numerator}</span><span class="frac-part bottom">${denominator}</span></span>`;
    }
    let right = slot();
    for (let i = 1; i < q.signs.length; i++) right += `<span class="operator">${q.kind === "exp" ? "×" : q.signs[i] > 0 ? "+" : "−"}</span>${slot()}`;
    return `${left}<span class="operator">=</span>${right}`;
  }

  function exampleMarkup(q) {
    const values = q.solutions[0].map(index => q.cards[index].value);
    const terms = values.map(v => q.kind === "exp" ? `${q.base}^${v / 2}` : `log ${v}`);
    if (q.kind === "exp" && q.form === "quotient") {
      const n = q.signs.filter(s => s === 1).length;
      return `${terms.slice(0, n).join(" × ")} ÷ (${terms.slice(n).join(" × ")})`;
    }
    return terms.map((term, i) => i === 0 ? term : `${q.kind === "exp" ? " × " : q.signs[i] > 0 ? " + " : " − "}${term}`).join("");
  }

  function renderLane(index) {
    const lane = lanes[index];
    let body;
    if (lane.phase === "idle") {
      body = `<section class="idle"><div class="big-mark">0${index + 1}</div><h2>準備接力挑戰</h2><p>輸入姓名或座號，按開始後獨立作答。<br>每題選滿卡片，再鎖定答案。</p><label class="name-label" for="player-${index}">姓名或座號（可留空）</label><input id="player-${index}" class="player-input" maxlength="16" placeholder="例如：12 號" autocomplete="off"><button type="button" class="primary-button" data-action="start">開始遊戲</button></section>`;
    } else if (lane.phase === "finished") {
      body = `<section class="finished"><div class="big-mark">✓</div><h2>${escapeText(lane.player)} 完成挑戰</h2><div class="result-score">${lane.score}</div><div class="result-caption">總分 · 答對 ${lane.correct}／${lane.deck.length} 題</div><p>把這一區交給下一位同學。</p><button type="button" class="primary-button" data-action="reset">下一位學生</button></section>`;
    } else {
      const q = currentQuestion(lane), values = selectedValues(lane), filled = lane.selected.filter(x => x != null).length;
      const cards = q.cards.map((card, cardIndex) => `<button type="button" class="card ${lane.selected.includes(cardIndex) ? "selected" : ""}" data-action="card" data-card="${cardIndex}" ${lane.phase === "feedback" ? "disabled" : ""} aria-label="${q.kind === "exp" ? `${q.base} 的 ${card.value / 2} 次方` : `log ${card.value}`}${lane.selected.includes(cardIndex) ? "，已選取，點擊取消" : ""}">${cardMarkup(q, card.value)}</button>`).join("");
      body = `<div class="play-head"><span class="question-count">第 ${lane.index + 1}／${lane.deck.length} 題 · ${q.kind === "exp" ? "指數" : "對數"}</span><span class="level-pill ${q.level}">${LEVELS[q.level].name}</span><span class="stat">分數 <strong>${lane.score}</strong></span><span class="stat timer ${lane.remaining <= 5 ? "urgent" : ""}">⏱ <strong data-timer>${lane.remaining}</strong> 秒</span></div>
        <div class="timer-track"><div class="timer-fill ${lane.remaining <= 5 ? "urgent" : ""}" data-timer-fill style="width:${Math.max(0, lane.remaining / q.seconds * 100)}%"></div></div>
        <div class="prompt-box"><div class="prompt-label">依序填入 ${q.signs.length} 張卡片 · 點上方卡片也可取消</div><div class="expression">${promptMarkup(q, values)}</div></div>
        <div class="cards-label"><span>候選卡片 ${q.cards.length} 張</span><span>已選 ${filled}／${q.signs.length}</span></div><div class="cards" style="--rows:${Math.ceil(q.cards.length / 4)};--cards-max-height:${Math.ceil(q.cards.length / 4) * 82 + (Math.ceil(q.cards.length / 4) - 1) * 8}px">${cards}</div>
        ${lane.phase === "feedback" ? `<div class="feedback ${lane.wasCorrect ? "" : "wrong"}" role="status">${escapeText(lane.message)}${lane.wasCorrect ? "" : `<small>例：${escapeText(exampleMarkup(q))}</small>`}</div>` : `<button class="lock-button" data-action="lock" type="button" ${filled === q.signs.length ? "" : "disabled"}>鎖定答案</button><div class="hint" role="status">${escapeText(lane.message)}</div>`}`;
    }
    $lanes.querySelector(`[data-lane="${index}"]`).innerHTML = `<div class="lane-head"><span class="lane-name">${LABELS[index]}</span><span class="participant">${lane.phase === "idle" ? "等待下一位學生" : escapeText(lane.player)}</span></div><div class="lane-body">${body}</div>`;
  }
  function renderAll() {
    $lanes.innerHTML = LABELS.map((_, i) => `<section class="lane" data-lane="${i}" aria-label="${LABELS[i]}"></section>`).join("");
    lanes.forEach((_, i) => renderLane(i));
  }
  function updateSummary() {
    const subjects = [settings.exp ? "指數" : "", settings.log ? "對數" : ""].filter(Boolean).join("＋");
    document.getElementById("rulesSummary").textContent = `${subjects} · ${settings.easyCount + settings.mediumCount + settings.hardCount} 題`;
  }

  function advanceLane(index) {
    const lane = lanes[index];
    lane.index++;
    lane.message = "";
    if (lane.index >= lane.deck.length) { lane.phase = "finished"; renderLane(index); return; }
    lane.phase = "play";
    lane.selected = Array(currentQuestion(lane).signs.length).fill(null);
    lane.remaining = currentQuestion(lane).seconds;
    lane.deadline = performance.now() + lane.remaining * 1000;
    renderLane(index);
  }
  function startLane(index) {
    const lane = lanes[index];
    if (lane.phase !== "idle") return;
    const input = $lanes.querySelector(`[data-lane="${index}"] .player-input`);
    lane.player = input.value.trim().slice(0, 16) || `${LABELS[index]}同學`;
    try { lane.deck = makeDeck({ ...settings }); }
    catch (error) { window.alert(`題目產生失敗：${error.message}`); return; }
    lane.score = 0; lane.correct = 0; lane.index = -1;
    advanceLane(index);
  }
  function changeCard(index, cardIndex) {
    const lane = lanes[index];
    if (lane.phase !== "play") return;
    const prior = lane.selected.indexOf(cardIndex);
    if (prior !== -1) lane.selected[prior] = null;
    else {
      const empty = lane.selected.indexOf(null);
      if (empty === -1) return;
      lane.selected[empty] = cardIndex;
    }
    lane.message = "";
    renderLane(index);
  }
  function finishQuestion(index, timedOut = false) {
    const lane = lanes[index];
    if (lane.phase !== "play") return;
    const q = currentQuestion(lane);
    lane.remaining = Math.max(0, Math.ceil((lane.deadline - performance.now()) / 1000));
    const full = lane.selected.every(id => id != null);
    const values = full ? selectedValues(lane) : [];
    const correct = !timedOut && lane.remaining > 0 && full && correctValues(q, values);
    const points = correct ? lane.remaining : 0;
    lane.wasCorrect = correct;
    lane.score += points;
    if (correct) lane.correct++;
    lane.message = correct ? `答對！＋${points} 分` : timedOut ? "時間到！本題 0 分" : "答案不正確，本題 0 分";
    lane.phase = "feedback";
    renderLane(index);
    lane.feedbackTimer = setTimeout(() => { lane.feedbackTimer = null; advanceLane(index); }, 1000);
  }

  $lanes.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const container = button.closest(".lane");
    if (!container) return;
    const index = Number(container.dataset.lane), action = button.dataset.action;
    if (action === "start") startLane(index);
    else if (action === "reset" && lanes[index].phase === "finished") { lanes[index].phase = "idle"; lanes[index].player = ""; renderLane(index); }
    else if (action === "card") changeCard(index, Number(button.dataset.card));
    else if (action === "unselect" && lanes[index].phase === "play") {
      const slotIndex = Number(button.dataset.slot);
      if (lanes[index].selected[slotIndex] != null) { lanes[index].selected[slotIndex] = null; lanes[index].message = ""; renderLane(index); }
    } else if (action === "lock") finishQuestion(index);
  });
  $lanes.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.classList.contains("player-input")) {
      event.preventDefault(); startLane(Number(event.target.closest(".lane").dataset.lane));
    }
  });

  setInterval(() => {
    const now = performance.now();
    lanes.forEach((lane, index) => {
      if (lane.phase !== "play") return;
      const remaining = Math.max(0, Math.ceil((lane.deadline - now) / 1000));
      if (remaining <= 0) { finishQuestion(index, true); return; }
      if (remaining === lane.remaining) return;
      lane.remaining = remaining;
      const root = $lanes.querySelector(`[data-lane="${index}"]`);
      const timer = root.querySelector("[data-timer]"), fill = root.querySelector("[data-timer-fill]");
      if (timer) timer.textContent = remaining;
      if (fill) { fill.style.width = `${remaining / currentQuestion(lane).seconds * 100}%`; fill.classList.toggle("urgent", remaining <= 5); }
      root.querySelector(".timer")?.classList.toggle("urgent", remaining <= 5);
    });
  }, 100);

  function showSettings() {
    for (const [key, value] of Object.entries(settings)) $form.elements[key][typeof value === "boolean" ? "checked" : "value"] = value;
    document.getElementById("settingsError").textContent = "";
    updateTotal(); $dialog.showModal();
  }
  function updateTotal() {
    const data = new FormData($form);
    const total = ["easyCount", "mediumCount", "hardCount"].reduce((sum, name) => sum + (Number(data.get(name)) || 0), 0);
    document.getElementById("questionTotal").textContent = `共 ${total} 題`;
  }
  function settingsError(candidate) {
    if (!candidate.exp && !candidate.log) return "請至少勾選一種題目內容。";
    if (["easyCount", "mediumCount", "hardCount"].some(k => !Number.isInteger(candidate[k]) || candidate[k] < 0 || candidate[k] > 30)) return "各難度題數請填 0 至 30 的整數。";
    if (candidate.easyCount + candidate.mediumCount + candidate.hardCount < 1) return "總題數至少為 1 題。";
    if (["easyCandidates", "mediumCandidates", "hardCandidates"].some(k => !Number.isInteger(candidate[k]) || candidate[k] < 8 || candidate[k] > 24)) return "候選卡片張數請填 8 至 24 的整數。";
    if (["easySeconds", "mediumSeconds", "hardSeconds"].some(k => !Number.isInteger(candidate[k]) || candidate[k] < 5 || candidate[k] > 180)) return "秒數請填 5 至 180 的整數。";
    return "";
  }
  function saveSettings(candidate) {
    const error = settingsError(candidate);
    if (error) throw new Error(error);
    settings = candidate;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* private browsing can disable storage */ }
    updateSummary();
  }
  $form.addEventListener("input", updateTotal);
  $form.addEventListener("submit", event => {
    event.preventDefault();
    const form = $form.elements;
    const candidate = { exp: form.exp.checked, log: form.log.checked };
    for (const key of ["easyCount", "mediumCount", "hardCount", "easyCandidates", "mediumCandidates", "hardCandidates", "easySeconds", "mediumSeconds", "hardSeconds"]) candidate[key] = Number(form[key].value);
    try { saveSettings(candidate); $dialog.close(); }
    catch (error) { document.getElementById("settingsError").textContent = error.message; }
  });
  document.getElementById("settingsButton").addEventListener("click", showSettings);
  document.getElementById("closeSettings").addEventListener("click", () => $dialog.close());
  document.getElementById("fullscreenButton").addEventListener("click", async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { /* browser may restrict full screen */ }
  });

  updateSummary(); renderAll();

  // Supported browsers can offer the same game controls to an assistant through WebMCP.
  if (document.modelContext?.registerTool) {
    const registry = document.modelContext;
    const laneIndex = name => { const index = { left: 0, middle: 1, right: 2 }[name]; if (index == null) throw new Error("lane 必須為 left、middle 或 right"); return index; };
    const definitions = [
      {
        name: "read_game_state", title: "查看遊戲狀態", description: "讀取教師設定、三個區域的進度和目前題目的候選卡片。",
        inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
        execute() { return { settings: { ...settings }, lanes: lanes.map((lane, index) => ({ lane: ["left", "middle", "right"][index], phase: lane.phase, player: lane.player, score: lane.score, question: lane.phase === "play" ? { number: lane.index + 1, level: currentQuestion(lane).level, kind: currentQuestion(lane).kind, target: currentQuestion(lane).kind === "exp" ? `${currentQuestion(lane).base}^${currentQuestion(lane).targetUnits / 2}` : `log ${currentQuestion(lane).target}`, signs: currentQuestion(lane).signs, cards: currentQuestion(lane).cards.map(c => ({ id: c.id, value: currentQuestion(lane).kind === "exp" ? `${currentQuestion(lane).base}^${c.value / 2}` : `log ${c.value}` })), selected: [...lane.selected], secondsRemaining: lane.remaining } : null })) }; }
      },
      {
        name: "configure_game", title: "調整教師設定", description: "設定指數與對數題型、各難度題數與每題秒數，供下一位學生使用。",
        inputSchema: { type: "object", properties: { exp: { type: "boolean" }, log: { type: "boolean" }, easyCount: { type: "integer" }, mediumCount: { type: "integer" }, hardCount: { type: "integer" }, easyCandidates: { type: "integer" }, mediumCandidates: { type: "integer" }, hardCandidates: { type: "integer" }, easySeconds: { type: "integer" }, mediumSeconds: { type: "integer" }, hardSeconds: { type: "integer" } }, required: Object.keys(DEFAULTS), additionalProperties: false },
        execute(input) { saveSettings({ ...input }); return { settings: { ...settings } }; }
      },
      {
        name: "start_student_round", title: "開始學生回合", description: "在指定區域以學生姓名或座號開始新回合。",
        inputSchema: { type: "object", properties: { lane: { type: "string", enum: ["left", "middle", "right"] }, player: { type: "string" } }, required: ["lane", "player"], additionalProperties: false },
        execute(input) { const index = laneIndex(input.lane); if (lanes[index].phase !== "idle") throw new Error("該區尚未準備好新回合"); $lanes.querySelector(`[data-lane="${index}"] .player-input`).value = String(input.player).slice(0, 16); startLane(index); return { lane: input.lane, player: lanes[index].player, questionCount: lanes[index].deck.length }; }
      },
      {
        name: "submit_card_answer", title: "鎖定卡片答案", description: "按照方框順序選擇候選卡片的 ID，並鎖定目前題目的答案。",
        inputSchema: { type: "object", properties: { lane: { type: "string", enum: ["left", "middle", "right"] }, cardIds: { type: "array", items: { type: "integer" } } }, required: ["lane", "cardIds"], additionalProperties: false },
        execute(input) { const index = laneIndex(input.lane), lane = lanes[index]; if (lane.phase !== "play") throw new Error("該區目前沒有作答中的題目"); const ids = input.cardIds; if (!Array.isArray(ids) || ids.length !== currentQuestion(lane).signs.length || new Set(ids).size !== ids.length || ids.some(id => !Number.isInteger(id) || id < 0 || id >= currentQuestion(lane).cards.length)) throw new Error("卡片 ID 數量或內容不正確"); lane.selected = [...ids]; renderLane(index); finishQuestion(index); return { lane: input.lane, correct: lane.wasCorrect, score: lane.score, feedback: lane.message }; }
      }
    ];
    for (const definition of definitions) {
      try { Promise.resolve(registry.registerTool(definition)).catch(() => {}); } catch { /* normal browsers need no tool support */ }
    }
  }
})();
