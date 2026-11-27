/* ============================================================
   M's Workspace — 민철의 개인 작업실 · 합동 비서실
   모든 내용은 브라우저 localStorage에만 저장됩니다.
   ============================================================ */

(function () {
  "use strict";

  const STORE_KEY = "m-workspace.v1";
  const THEME_KEY = "m-workspace.theme";

  const STATUS = ["todo", "doing", "done"];
  const STATUS_LABEL = { todo: "대기", doing: "진행 중", done: "완료" };
  const OWNERS = {
    me: { label: "나", className: "owner-me" },
    bbonggu: { label: "뽕구", className: "owner-bbonggu" },
    pickle: { label: "다른 피클", className: "owner-pickle" },
  };
  const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

  const ICONS = {
    trash:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-8 0 1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    left:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    clockTime: $("clockTime"),
    clockDate: $("clockDate"),
    greeting: $("greeting"),
    todayLabel: $("todayLabel"),
    todoList: $("todoList"),
    todoEmpty: $("todoEmpty"),
    todoForm: $("todoForm"),
    todoInput: $("todoInput"),
    todoCounter: $("todoCounter"),
    todoProgress: $("todoProgress"),
    todoProgressBar: $("todoProgressBar"),
    cardForm: $("cardForm"),
    cardInput: $("cardInput"),
    cardOwner: $("cardOwner"),
    board: $("board"),
    ownerFilter: $("ownerFilter"),
    linkGrid: $("linkGrid"),
    linkForm: $("linkForm"),
    linkLabel: $("linkLabel"),
    linkUrl: $("linkUrl"),
    toggleLinkForm: $("toggleLinkForm"),
    noteForm: $("noteForm"),
    noteInput: $("noteInput"),
    noteList: $("noteList"),
    noteEmpty: $("noteEmpty"),
    memoSaved: $("memoSaved"),
    statTodos: $("statTodos"),
    statDoing: $("statDoing"),
    statDone: $("statDone"),
    statNotes: $("statNotes"),
    savedAt: $("savedAt"),
    exportBtn: $("exportBtn"),
    importBtn: $("importBtn"),
    importFile: $("importFile"),
    resetBtn: $("resetBtn"),
    themeBtn: $("themeBtn"),
    toasts: $("toasts"),
  };

  /* ---------- helpers ---------- */

  function uid() {
    try {
      if (window.crypto && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID().slice(0, 8);
      }
    } catch (e) { /* ignore */ }
    return Math.random().toString(36).slice(2, 10);
  }

  const pad = (n) => String(n).padStart(2, "0");

  function dayLabel(d, withYear) {
    const base = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return `${withYear ? d.getFullYear() + "년 " : ""}${base} ${WEEKDAYS[d.getDay()]}요일`;
  }

  function timeLabel(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const clock = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return sameDay ? clock : `${d.getMonth() + 1}.${d.getDate()} ${clock}`;
  }

  function greetingFor(hour) {
    if (hour < 5) return "늦은 밤이에요. 오늘도 수고 많았어요";
    if (hour < 11) return "좋은 아침이에요. 오늘 할 일부터 정리해 볼까요";
    if (hour < 17) return "좋은 오후예요. 남은 할 일을 확인해 볼까요";
    if (hour < 22) return "좋은 저녁이에요. 오늘 안건을 정리해 두세요";
    return "하루 마무리하기 좋은 시간이에요";
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function iconButton(className, icon, label, onClick) {
    const btn = make("button", className);
    btn.type = "button";
    btn.title = label;
    btn.setAttribute("aria-label", label);
    btn.innerHTML = icon;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function normalizeUrl(raw) {
    let value = String(raw || "").trim();
    if (!value) return null;
    if (!/^[a-z]+:\/\//i.test(value)) value = "https://" + value;
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) return null;
      if (!url.hostname.includes(".")) return null;
      return url.toString();
    } catch (e) {
      return null;
    }
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch (e) {
      return url;
    }
  }

  /* ---------- state ---------- */

  function blankState() {
    return { todos: [], cards: [], notes: [], links: [] };
  }

  function defaultState() {
    return {
      todos: [],
      cards: [],
      notes: [],
      links: [
        { id: uid(), label: "Notion", url: "https://www.notion.so", createdAt: Date.now() },
        { id: uid(), label: "Google Calendar", url: "https://calendar.google.com", createdAt: Date.now() },
        { id: uid(), label: "GitHub", url: "https://github.com", createdAt: Date.now() },
      ],
    };
  }

  function normalizeState(data) {
    const next = blankState();
    if (!data || typeof data !== "object") return next;

    if (Array.isArray(data.todos)) {
      next.todos = data.todos
        .filter((t) => t && typeof t.text === "string")
        .map((t) => ({
          id: typeof t.id === "string" && t.id ? t.id : uid(),
          text: t.text.slice(0, 300),
          done: Boolean(t.done),
          createdAt: Number(t.createdAt) || Date.now(),
        }));
    }

    if (Array.isArray(data.cards)) {
      next.cards = data.cards
        .filter((c) => c && typeof c.text === "string")
        .map((c) => ({
          id: typeof c.id === "string" && c.id ? c.id : uid(),
          text: c.text.slice(0, 400),
          owner: OWNERS[c.owner] ? c.owner : "me",
          status: STATUS.includes(c.status) ? c.status : "todo",
          createdAt: Number(c.createdAt) || Date.now(),
          updatedAt: Number(c.updatedAt) || Number(c.createdAt) || Date.now(),
        }));
    }

    if (Array.isArray(data.notes)) {
      next.notes = data.notes
        .filter((n) => n && typeof n.text === "string" && n.text.trim())
        .map((n) => ({
          id: typeof n.id === "string" && n.id ? n.id : uid(),
          text: n.text.slice(0, 4000),
          createdAt: Number(n.createdAt) || Date.now(),
          updatedAt: Number(n.updatedAt) || Number(n.createdAt) || Date.now(),
        }));
    }

    if (Array.isArray(data.links)) {
      next.links = data.links
        .filter((l) => l && l.url)
        .map((l) => ({
          id: typeof l.id === "string" && l.id ? l.id : uid(),
          label: String(l.label || hostOf(String(l.url))).slice(0, 60),
          url: String(l.url),
          createdAt: Number(l.createdAt) || Date.now(),
        }))
        .filter((l) => /^https?:\/\//i.test(l.url));
    }

    return next;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      return normalizeState(JSON.parse(raw));
    } catch (e) {
      return defaultState();
    }
  }

  let state = load();
  let ownerFilter = "all";

  function persist(quiet) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      const stamp = new Date();
      els.savedAt.textContent = `마지막 저장 ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;
      if (quiet !== true) flashMemoSaved();
    } catch (e) {
      els.savedAt.textContent = "저장소를 쓸 수 없어 이번 내용이 저장되지 않았어요";
    }
  }

  let saveTimer = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      persist(true);
    }, 400);
  }

  let hintTimer = null;
  function flashMemoSaved() {
    if (!els.memoSaved) return;
    els.memoSaved.textContent = "저장됨";
    els.memoSaved.classList.add("show");
    if (hintTimer) clearTimeout(hintTimer);
    hintTimer = setTimeout(() => els.memoSaved.classList.remove("show"), 1600);
  }

  /* ---------- toasts ---------- */

  function toast(message) {
    const node = make("div", "toast", message);
    els.toasts.appendChild(node);
    setTimeout(() => {
      node.classList.add("out");
      setTimeout(() => node.remove(), 260);
    }, 2400);
  }

  /* ---------- clock & greeting ---------- */

  function tick() {
    const now = new Date();
    els.clockTime.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    els.clockDate.textContent = dayLabel(now, false);
    els.todayLabel.textContent = dayLabel(now, true);
    els.greeting.textContent = greetingFor(now.getHours());
  }

  /* ---------- stats ---------- */

  function renderStats() {
    const remaining = state.todos.filter((t) => !t.done).length;
    els.statTodos.textContent = String(remaining);
    els.statDoing.textContent = String(state.cards.filter((c) => c.status === "doing").length);
    els.statDone.textContent = String(state.cards.filter((c) => c.status === "done").length);
    els.statNotes.textContent = String(state.notes.length);
  }

  /* ---------- todos ---------- */

  function renderTodos() {
    const total = state.todos.length;
    const done = state.todos.filter((t) => t.done).length;
    els.todoCounter.textContent = `${done} / ${total}`;
    els.todoProgress.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
    els.todoProgressBar.setAttribute("aria-valuenow", total ? String(Math.round((done / total) * 100)) : "0");
    els.todoEmpty.hidden = total > 0;

    const ordered = state.todos.slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.createdAt - b.createdAt;
    });

    const frag = document.createDocumentFragment();
    ordered.forEach((todo) => {
      const li = make("li", "todo" + (todo.done ? " done" : ""));
      li.dataset.id = todo.id;

      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = todo.done;
      box.setAttribute("aria-label", todo.text);
      box.addEventListener("change", () => {
        todo.done = box.checked;
        persist();
        renderTodos();
        renderStats();
      });

      const text = make("span", "todo-text", todo.text);
      text.addEventListener("dblclick", () => startTodoEdit(li, todo, text));

      const del = iconButton("todo-del", ICONS.close, "할 일 지우기", () => {
        state.todos = state.todos.filter((t) => t.id !== todo.id);
        persist();
        renderTodos();
        renderStats();
        toast("할 일을 지웠어요");
      });

      li.append(box, text, del);
      frag.appendChild(li);
    });

    els.todoList.replaceChildren(frag);
  }

  function startTodoEdit(li, todo, textNode) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = todo.text;
    input.maxLength = 160;
    input.className = "todo-edit";
    input.style.cssText =
      "flex:1;min-width:0;border:1px solid var(--accent);border-radius:8px;padding:5px 8px;font-size:14px;background:var(--surface);";
    textNode.replaceWith(input);
    input.focus();
    input.select();

    const commit = (save) => {
      const value = input.value.trim();
      if (save && value) {
        todo.text = value;
        persist();
      }
      renderTodos();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(true); }
      if (e.key === "Escape") { e.preventDefault(); commit(false); }
    });
    input.addEventListener("blur", () => commit(true));
    li.dataset.editing = "true";
  }

  els.todoForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = els.todoInput.value.trim();
    if (!value) {
      els.todoInput.focus();
      return;
    }
    state.todos.push({ id: uid(), text: value.slice(0, 160), done: false, createdAt: Date.now() });
    els.todoInput.value = "";
    persist();
    renderTodos();
    renderStats();
    els.todoInput.focus();
  });

  /* ---------- board ---------- */

  function renderBoard() {
    STATUS.forEach((status) => {
      const body = els.board.querySelector(`[data-drop="${status}"]`);
      const count = els.board.querySelector(`[data-count="${status}"]`);
      body.replaceChildren();

      const items = state.cards
        .filter((c) => c.status === status)
        .filter((c) => ownerFilter === "all" || c.owner === ownerFilter)
        .sort((a, b) => a.createdAt - b.createdAt);

      count.textContent = String(items.length);

      if (!items.length) {
        body.appendChild(make("div", "col-empty", "비어 있음"));
        return;
      }

      const frag = document.createDocumentFragment();
      items.forEach((card) => frag.appendChild(buildCard(card)));
      body.appendChild(frag);
    });
    renderStats();
  }

  function buildCard(card) {
    const el = make("article", "carditem");
    el.dataset.id = card.id;
    el.dataset.status = card.status;
    el.draggable = true;

    el.appendChild(make("p", null, card.text));

    const foot = make("div", "card-foot");
    const owner = OWNERS[card.owner] || OWNERS.me;
    foot.appendChild(make("span", "owner " + owner.className, owner.label));

    const acts = make("div", "card-acts");
    const index = STATUS.indexOf(card.status);

    if (index > 0) {
      acts.appendChild(
        iconButton("card-act", ICONS.left, "이전 단계로", () => moveCard(card, -1))
      );
    }
    if (index < STATUS.length - 1) {
      acts.appendChild(
        iconButton("card-act", ICONS.right, "다음 단계로", () => moveCard(card, 1))
      );
    }
    acts.appendChild(
      iconButton("card-act danger", ICONS.close, "카드 지우기", () => {
        state.cards = state.cards.filter((c) => c.id !== card.id);
        persist();
        renderBoard();
        toast("카드를 지웠어요");
      })
    );

    foot.appendChild(acts);
    el.appendChild(foot);

    el.addEventListener("dragstart", (e) => {
      el.classList.add("is-dragging");
      try {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
      } catch (err) { /* ignore */ }
    });
    el.addEventListener("dragend", () => el.classList.remove("is-dragging"));

    return el;
  }

  function moveCard(card, delta) {
    const index = STATUS.indexOf(card.status);
    const next = STATUS[index + delta];
    if (!next) return;
    card.status = next;
    card.updatedAt = Date.now();
    persist();
    renderBoard();
  }

  function setCardStatus(id, status) {
    const card = state.cards.find((c) => c.id === id);
    if (!card || card.status === status) return;
    card.status = status;
    card.updatedAt = Date.now();
    persist();
    renderBoard();
  }

  els.cardForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = els.cardInput.value.trim();
    if (!value) {
      els.cardInput.focus();
      return;
    }
    state.cards.push({
      id: uid(),
      text: value.slice(0, 200),
      owner: els.cardOwner.value,
      status: "todo",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    els.cardInput.value = "";
    persist();
    renderBoard();
    els.cardInput.focus();
  });

  els.ownerFilter.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    ownerFilter = chip.dataset.owner;
    els.ownerFilter.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("is-active", c === chip);
    });
    renderBoard();
  });

  els.board.querySelectorAll("[data-drop]").forEach((zone) => {
    const column = zone.closest(".column");
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      column.classList.add("is-over");
    });
    zone.addEventListener("dragleave", (e) => {
      if (!zone.contains(e.relatedTarget)) column.classList.remove("is-over");
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      column.classList.remove("is-over");
      const id = e.dataTransfer.getData("text/plain");
      if (id) setCardStatus(id, zone.dataset.drop);
    });
  });

  /* ---------- links ---------- */

  function renderLinks() {
    els.linkGrid.replaceChildren();
    if (!state.links.length) {
      els.linkGrid.appendChild(make("p", "empty", "자주 쓰는 도구를 추가해 두세요."));
      return;
    }

    const frag = document.createDocumentFragment();
    state.links.forEach((link, i) => {
      const tile = make("div", "link-tile");
      tile.dataset.hue = String((i % 5) + 1);

      const anchor = document.createElement("a");
      anchor.className = "link-anchor";
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";

      const mark = make("span", "link-mark", (link.label.trim()[0] || "?").toUpperCase());
      const info = make("span", "link-info");
      info.appendChild(make("span", "link-label", link.label));
      info.appendChild(make("span", "link-host", hostOf(link.url)));

      anchor.append(mark, info);

      const del = iconButton("link-del", ICONS.close, "바로가기 지우기", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.links = state.links.filter((l) => l.id !== link.id);
        persist();
        renderLinks();
        toast("바로가기를 지웠어요");
      });

      tile.append(anchor, del);
      frag.appendChild(tile);
    });
    els.linkGrid.appendChild(frag);
  }

  els.toggleLinkForm.addEventListener("click", () => {
    const open = els.linkForm.hidden;
    els.linkForm.hidden = !open;
    els.toggleLinkForm.setAttribute("aria-expanded", String(open));
    if (open) els.linkLabel.focus();
  });

  els.linkForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = normalizeUrl(els.linkUrl.value);
    if (!url) {
      toast("주소를 확인해 주세요. 예: notion.so");
      els.linkUrl.focus();
      return;
    }
    const label = els.linkLabel.value.trim() || hostOf(url);
    state.links.push({ id: uid(), label: label.slice(0, 60), url, createdAt: Date.now() });
    els.linkLabel.value = "";
    els.linkUrl.value = "";
    persist();
    renderLinks();
    els.linkForm.hidden = true;
    els.toggleLinkForm.setAttribute("aria-expanded", "false");
    toast("바로가기를 추가했어요");
  });

  /* ---------- notes ---------- */

  function renderNotes() {
    els.noteEmpty.hidden = state.notes.length > 0;
    els.noteList.replaceChildren();

    const frag = document.createDocumentFragment();
    state.notes.forEach((note) => frag.appendChild(buildNote(note)));
    els.noteList.appendChild(frag);
  }

  function buildNote(note) {
    const article = make("article", "note");
    article.dataset.id = note.id;

    const body = make("div", "note-body");
    body.contentEditable = "true";
    body.spellcheck = false;
    body.textContent = note.text;

    const foot = make("div", "note-foot");
    const time = document.createElement("time");
    time.dateTime = new Date(note.updatedAt).toISOString();
    time.textContent = timeLabel(note.updatedAt);

    body.addEventListener("input", () => {
      note.text = body.textContent;
      note.updatedAt = Date.now();
      time.dateTime = new Date(note.updatedAt).toISOString();
      time.textContent = timeLabel(note.updatedAt);
      scheduleSave();
      flashMemoSaved();
    });

    body.addEventListener("blur", () => {
      const text = (note.text || "").trim();
      if (!text) {
        state.notes = state.notes.filter((n) => n.id !== note.id);
        persist();
        renderNotes();
        return;
      }
      note.text = text;
      persist();
    });

    body.addEventListener("keydown", (e) => {
      if (e.key === "Escape") body.blur();
    });

    const del = iconButton("note-del", ICONS.trash, "메모 지우기", () => {
      state.notes = state.notes.filter((n) => n.id !== note.id);
      persist();
      renderNotes();
      toast("메모를 지웠어요");
    });

    foot.append(time, del);
    article.append(body, foot);
    return article;
  }

  els.noteForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addNote();
  });

  els.noteInput.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      addNote();
    }
  });

  function addNote() {
    const value = els.noteInput.value.trim();
    if (!value) {
      els.noteInput.focus();
      return;
    }
    const note = {
      id: uid(),
      text: value.slice(0, 2000),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.notes.unshift(note);
    els.noteInput.value = "";
    persist();
    renderNotes();
    renderStats();
    const first = els.noteList.querySelector(`[data-id="${note.id}"] .note-body`);
    if (first) {
      first.focus();
      const range = document.createRange();
      range.selectNodeContents(first);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  /* ---------- data: export / import / reset ---------- */

  function exportData() {
    const payload = Object.assign(
      { app: "m-workspace", version: 1, exportedAt: new Date().toISOString() },
      state
    );
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    a.href = url;
    a.download = `m-workspace-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast("작업실 내용을 JSON으로 내보냈어요");
  }

  els.exportBtn.addEventListener("click", exportData);

  els.importBtn.addEventListener("click", () => els.importFile.click());

  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let next;
      try {
        next = normalizeState(JSON.parse(String(reader.result)));
      } catch (err) {
        toast("파일을 읽지 못했어요. JSON 파일인지 확인해 주세요.");
        els.importFile.value = "";
        return;
      }
      const count = next.todos.length + next.cards.length + next.notes.length + next.links.length;
      if (!count) {
        toast("가져올 내용이 없는 파일이에요.");
        els.importFile.value = "";
        return;
      }
      const ok = window.confirm(
        `할 일 ${next.todos.length}개, 안건 ${next.cards.length}개, 메모 ${next.notes.length}개, 바로가기 ${next.links.length}개를 가져옵니다.\n지금 작업실 내용은 덮어써집니다. 계속할까요?`
      );
      if (!ok) {
        els.importFile.value = "";
        return;
      }
      state = next;
      persist();
      renderAll();
      toast("작업실 내용을 가져왔어요");
      els.importFile.value = "";
    };
    reader.onerror = () => {
      toast("파일을 읽지 못했어요.");
      els.importFile.value = "";
    };
    reader.readAsText(file);
  });

  els.resetBtn.addEventListener("click", () => {
    const ok = window.confirm("작업실의 모든 내용을 지울까요? 되돌릴 수 없습니다.");
    if (!ok) return;
    state = blankState();
    persist();
    renderAll();
    toast("작업실을 비웠어요");
  });

  /* ---------- theme ---------- */

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    els.themeBtn.setAttribute("aria-pressed", String(theme === "dark"));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#08090e" : "#f5f6fb");
  }

  function initTheme() {
    let stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch (e) { /* ignore */ }
    if (stored === "light" || stored === "dark") {
      applyTheme(stored);
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  els.themeBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) { /* ignore */ }
  });

  /* ---------- render all ---------- */

  function renderAll() {
    renderTodos();
    renderBoard();
    renderLinks();
    renderNotes();
    renderStats();
  }

  initTheme();
  tick();
  setInterval(tick, 1000);

  renderAll();

  if (!state.todos.length && !state.cards.length && !state.notes.length) {
    els.savedAt.textContent = "오늘 처음 시작하는 작업실이에요";
  }
})();
