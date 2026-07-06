/* ============ Kanban Board — alkalmazáslogika ============ */
"use strict";

/* ---------- Konfiguráció ellenőrzése ---------- */

const CFG = window.KANBAN_CONFIG;

if (!CFG || !CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) {
  document.getElementById("board").innerHTML = `
    <div class="setup-notice">
      <h2>Hiányzó konfiguráció</h2>
      <p>Nem található a <code>config.js</code> fájl (vagy hiányosak az adatai).</p>
      <p>Másold le a <code>config.example.js</code> fájlt <code>config.js</code> néven,
      és töltsd ki a Supabase projekt URL-jét és publishable kulcsát
      (Supabase Dashboard → Settings → API).</p>
    </div>`;
  throw new Error("Hiányzó KANBAN_CONFIG — lásd config.example.js");
}

const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);

/* ---------- Konstansok, állapot ---------- */

const STATUSES = [
  { key: "TODO",        label: "To Do",       cssVar: "--col-todo" },
  { key: "IN_PROGRESS", label: "In Progress", cssVar: "--col-progress" },
  { key: "VALIDATION",  label: "Validation",  cssVar: "--col-validation" },
  { key: "COMPLETED",   label: "Completed",   cssVar: "--col-completed" },
];

const PRIO_LABELS = { LOW: "Alacsony", MEDIUM: "Közepes", HIGH: "Magas" };

let tickets = [];        // teljes állapot a memóriában
let draggingId = null;   // éppen húzott ticket id-ja
let deleteTargetId = null;

const boardEl = document.getElementById("board");
const connEl = document.getElementById("connection-status");

/* ---------- Segédfüggvények ---------- */

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(iso) {
  if (!iso) return "";
  // A timestamp oszlop időzóna nélkül, UTC-ben tárol — jelöljük UTC-nek
  const s = /Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z";
  const d = new Date(s);
  return isNaN(d) ? "" : d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

function setConnection(ok) {
  connEl.classList.toggle("online", ok);
  connEl.classList.toggle("offline", !ok);
  connEl.title = ok ? "Kapcsolódva a Supabase-hez" : "Nincs kapcsolat";
}

function snapshotTickets() {
  return tickets.map((t) => ({ ...t }));
}

function columnTickets(status) {
  return tickets
    .filter((t) => t.status === status)
    .sort((a, b) => a.order_index - b.order_index || a.id - b.id);
}

/* ---------- Toast ---------- */

function toast(message, type = "info") {
  const icons = { success: "✔", error: "✖", info: "ℹ" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => {
    el.classList.add("leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3200);
}

/* ---------- Tábla felépítése és renderelés ---------- */

function buildBoard() {
  boardEl.innerHTML = STATUSES.map((s) => `
    <section class="column" data-status="${s.key}" style="--col-accent: var(${s.cssVar})">
      <div class="column-header">
        <span class="column-dot"></span>
        <span class="column-title">${s.label}</span>
        <span class="column-count" data-count>0</span>
      </div>
      <div class="card-list" data-status="${s.key}"></div>
      <div class="column-footer">
        <button class="btn-add-card" data-action="add" data-status="${s.key}">+ Ticket hozzáadása</button>
      </div>
    </section>`).join("");
}

function cardHtml(t) {
  const desc = t.description
    ? `<p class="card-desc">${escapeHtml(t.description)}</p>` : "";
  return `
    <article class="card prio-${escapeHtml(t.priority)}" draggable="true" data-id="${t.id}">
      <div class="card-top">
        <h3 class="card-title">${escapeHtml(t.title)}</h3>
        <div class="card-actions">
          <button class="btn-icon" data-action="edit" title="Szerkesztés">✎</button>
          <button class="btn-icon" data-action="delete" title="Törlés">🗑</button>
        </div>
      </div>
      ${desc}
      <div class="card-meta">
        <span class="prio-badge">${PRIO_LABELS[t.priority] || escapeHtml(t.priority)}</span>
        <span class="card-date" title="Létrehozva">#${t.id} · ${formatDate(t.created_at)}</span>
      </div>
    </article>`;
}

function renderAll() {
  for (const s of STATUSES) {
    const list = boardEl.querySelector(`.card-list[data-status="${s.key}"]`);
    const items = columnTickets(s.key);
    list.innerHTML = items.length
      ? items.map(cardHtml).join("")
      : `<div class="empty-hint">Nincs ticket — húzz ide egyet!</div>`;
    const col = list.closest(".column");
    col.querySelector("[data-count]").textContent = items.length;
  }
}

/* ---------- Adatbetöltés ---------- */

async function loadTickets() {
  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .order("order_index", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    setConnection(false);
    toast("Nem sikerült betölteni a ticketeket: " + error.message, "error");
    return;
  }
  setConnection(true);
  tickets = data;
  renderAll();
}

/* ---------- Drag & drop ---------- */

function getDragAfterElement(list, y) {
  const cards = [...list.querySelectorAll(".card:not(.dragging)")];
  let closest = { offset: -Infinity, element: null };
  for (const child of cards) {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
  }
  return closest.element;
}

boardEl.addEventListener("dragstart", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  draggingId = Number(card.dataset.id);
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", card.dataset.id);
  // A drag-kép elkészülte után jelöljük, különben a halvány kártya lenne a kép
  setTimeout(() => card.classList.add("dragging"), 0);
  // Üres oszlop felirat eltüntetése húzás közben
  boardEl.querySelectorAll(".empty-hint").forEach((el) => el.remove());
});

boardEl.addEventListener("dragover", (e) => {
  const list = e.target.closest(".card-list");
  if (!list || draggingId === null) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  boardEl.querySelectorAll(".column.drag-over").forEach((c) => c.classList.remove("drag-over"));
  list.closest(".column").classList.add("drag-over");

  const dragged = boardEl.querySelector(".card.dragging");
  if (!dragged) return;
  const after = getDragAfterElement(list, e.clientY);
  if (after) list.insertBefore(dragged, after);
  else list.appendChild(dragged);
});

boardEl.addEventListener("drop", (e) => {
  if (e.target.closest(".card-list") && draggingId !== null) {
    e.preventDefault();
    commitDragMove();
  }
});

boardEl.addEventListener("dragend", () => {
  draggingId = null;
  boardEl.querySelectorAll(".card.dragging").forEach((c) => c.classList.remove("dragging"));
  boardEl.querySelectorAll(".column.drag-over").forEach((c) => c.classList.remove("drag-over"));
  // Ha a drop nem történt meg (pl. táblán kívül engedte el), az állapotból visszaáll
  renderAll();
});

/** A DOM aktuális sorrendje alapján frissíti az állapotot,
 *  optimista módon rendereli, majd a háttérben menti a változásokat. */
function commitDragMove() {
  const before = snapshotTickets();
  const byId = new Map(tickets.map((t) => [t.id, t]));

  boardEl.querySelectorAll(".card-list").forEach((list) => {
    const status = list.dataset.status;
    [...list.querySelectorAll(".card")].forEach((el, idx) => {
      const t = byId.get(Number(el.dataset.id));
      if (t) { t.status = status; t.order_index = idx; }
    });
  });

  const beforeMap = new Map(before.map((t) => [t.id, t]));
  const changed = tickets.filter((t) => {
    const b = beforeMap.get(t.id);
    return b && (b.status !== t.status || b.order_index !== t.order_index);
  });

  renderAll(); // optimista frissítés — azonnal a végleges helyén látszik

  if (!changed.length) return;

  Promise.all(
    changed.map((t) =>
      sb.from("tickets")
        .update({ status: t.status, order_index: t.order_index })
        .eq("id", t.id)
        .then(({ error }) => { if (error) throw error; })
    )
  )
    .then(() => setConnection(true))
    .catch((err) => {
      // Hiba esetén visszaállítjuk a korábbi állapotot
      tickets = before;
      renderAll();
      setConnection(false);
      toast("A mozgatás mentése nem sikerült, visszaállítva: " + err.message, "error");
    });
}

/* ---------- Modal kezelés ---------- */

const ticketModal = document.getElementById("ticket-modal");
const confirmModal = document.getElementById("confirm-modal");
const form = document.getElementById("ticket-form");
const statusSelect = document.getElementById("f-status-select");

statusSelect.innerHTML = STATUSES
  .map((s) => `<option value="${s.key}">${s.label}</option>`)
  .join("");

function openTicketModal({ ticket = null, status = "TODO" } = {}) {
  document.getElementById("modal-title").textContent = ticket ? "Ticket szerkesztése" : "Új ticket";
  document.getElementById("btn-save").textContent = ticket ? "Mentés" : "Létrehozás";
  document.getElementById("f-id").value = ticket ? ticket.id : "";
  document.getElementById("f-title").value = ticket ? ticket.title : "";
  document.getElementById("f-description").value = ticket ? ticket.description || "" : "";
  statusSelect.value = ticket ? ticket.status : status;
  const prio = ticket ? ticket.priority : "MEDIUM";
  const radio = form.querySelector(`input[name="priority"][value="${prio}"]`)
    || form.querySelector('input[name="priority"][value="MEDIUM"]');
  radio.checked = true;
  ticketModal.classList.remove("hidden");
  document.getElementById("f-title").focus();
}

function closeModals() {
  ticketModal.classList.add("hidden");
  confirmModal.classList.add("hidden");
  deleteTargetId = null;
}

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-close]")) closeModals();
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModals();
});

/* ---------- CRUD műveletek ---------- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("f-id").value;
  const payload = {
    title: document.getElementById("f-title").value.trim(),
    description: document.getElementById("f-description").value.trim(),
    priority: form.querySelector('input[name="priority"]:checked').value,
    status: statusSelect.value,
  };
  if (!payload.title) return;

  const saveBtn = document.getElementById("btn-save");
  saveBtn.disabled = true;
  try {
    if (id) await updateTicket(Number(id), payload);
    else await createTicket(payload);
    closeModals();
  } finally {
    saveBtn.disabled = false;
  }
});

async function createTicket(payload) {
  payload.order_index = columnTickets(payload.status).length; // oszlop végére
  const { data, error } = await sb.from("tickets").insert(payload).select().single();
  if (error) {
    setConnection(false);
    toast("Nem sikerült létrehozni a ticketet: " + error.message, "error");
    return;
  }
  setConnection(true);
  tickets.push(data);
  renderAll();
  toast(`„${data.title}” létrehozva`, "success");
}

async function updateTicket(id, payload) {
  const current = tickets.find((t) => t.id === id);
  if (current && current.status !== payload.status) {
    payload.order_index = columnTickets(payload.status).length; // új oszlop végére
  }
  const { data, error } = await sb.from("tickets").update(payload).eq("id", id).select().single();
  if (error) {
    setConnection(false);
    toast("Nem sikerült menteni a módosítást: " + error.message, "error");
    return;
  }
  setConnection(true);
  const idx = tickets.findIndex((t) => t.id === id);
  if (idx !== -1) tickets[idx] = data;
  renderAll();
  toast(`„${data.title}” frissítve`, "success");
}

function requestDelete(id) {
  const t = tickets.find((x) => x.id === id);
  if (!t) return;
  deleteTargetId = id;
  document.getElementById("confirm-text").textContent =
    `Biztosan törlöd a(z) „${t.title}” ticketet? Ez a művelet nem vonható vissza.`;
  confirmModal.classList.remove("hidden");
}

document.getElementById("btn-confirm-delete").addEventListener("click", async () => {
  const id = deleteTargetId;
  closeModals();
  if (id === null) return;

  // Optimista törlés: azonnal eltűnik, hiba esetén visszakerül
  const before = snapshotTickets();
  const t = tickets.find((x) => x.id === id);
  tickets = tickets.filter((x) => x.id !== id);
  renderAll();

  const { error } = await sb.from("tickets").delete().eq("id", id);
  if (error) {
    tickets = before;
    renderAll();
    setConnection(false);
    toast("A törlés nem sikerült, visszaállítva: " + error.message, "error");
    return;
  }
  setConnection(true);
  toast(`„${t ? t.title : id}” törölve`, "success");
});

/* ---------- Kattintás-kezelés (delegálva) ---------- */

boardEl.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === "add") {
    openTicketModal({ status: btn.dataset.status });
    return;
  }
  const card = btn.closest(".card");
  if (!card) return;
  const id = Number(card.dataset.id);
  if (action === "edit") {
    const t = tickets.find((x) => x.id === id);
    if (t) openTicketModal({ ticket: t });
  } else if (action === "delete") {
    requestDelete(id);
  }
});

document.getElementById("btn-new-ticket").addEventListener("click", () => openTicketModal());

/* ---------- Indítás ---------- */

buildBoard();
renderAll();
loadTickets();
