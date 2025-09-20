/* ===== Build Version Gate (Anti-cache) ===== */
const BUILD_VER = "1.2"; // samakan dengan query ?v= di index.html
(function ensureFreshOnVersionChange() {
  try {
    const KEY = "__build_ver_seen__";
    const last = sessionStorage.getItem(KEY);
    if (last !== BUILD_VER) {
      sessionStorage.setItem(KEY, BUILD_VER);
      // Tambahkan ?v=BUILD_VER ke URL halaman supaya semua fetch ikut bust cache
      const url = new URL(location.href);
      if (url.searchParams.get("v") !== BUILD_VER) {
        url.searchParams.set("v", BUILD_VER);
        location.replace(url.toString());
        return;
      }
      // Bersihkan Cache Storage (kalau ada SW/Cache API) agar aset lama tidak dipakai
      if (window.caches?.keys) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
      }
      // Trigger SW update jika ada
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.update()));
      }
    }
  } catch { }
})();

/* ===== Keys & Utils ===== */
// const APP_VERSION = "1.2";
const APP_VERSION = String(window.BUILD_VER || "0"); // ikut index.html

const LS_WALLETS = "fin_wallets";
const LS_CATS = "fin_categories";
const LS_TX = "fin_transactions";
const LS_NAME = "fin_display_name";
const LS_HIDE_TOTAL = "fin_hide_total";
const LS_HIDE_WALLETS = "fin_hide_wallets";
const LS_HIDE_DEBT = "fin_hide_debt";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
// Escape HTML biar aman dipakai di innerHTML
function esc(s) {
  const map = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" };
  return String(s ?? "").replace(/[&<>"']/g, ch => map[ch]);
}

const fmtIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(n || 0));

// === Batas karakter untuk nominal ===
const MAX_CHARS_TOTAL = 14; // total saldo (atas)
const MAX_CHARS_WALLET = 14; // nominal per dompet (home & wallet)
const MAX_CHARS_TX = 14; // nominal di riwayat transaksi

function clampText(text, max) {
  const s = String(text ?? "");
  return s.length > max ? s.slice(0, Math.max(0, max - 1)) + "…" : s;
}

function applyAmountCharClamp() {
  // ⚠️ Total saldo: biarkan apa adanya (tidak di-clamp)

  // Nominal per dompet (Home & Wallet) — class .amount atau .pill
  $$(".amount, .wallet-item .pill, .wallet-item-home .pill").forEach(el => {
    if (el.textContent.trim() === "•••••") return; // jika disembunyikan
    const full = el.getAttribute("data-full") || el.textContent || "";
    const MAX = 14; // batas karakter untuk tampilan (boleh ubah)
    el.title = full;
    el.textContent = full.length > MAX ? (full.slice(0, MAX - 1) + "…") : full;
  });

  // Nominal di riwayat transaksi — class .tx-amount
  $$(".tx-amount").forEach(el => {
    const full = el.getAttribute("data-full") || el.textContent || "";
    const MAX = 14;
    el.title = full;
    el.textContent = full.length > MAX ? (full.slice(0, MAX - 1) + "…") : full;
  });
}

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    : "";

const themeCls = (t) =>
  t === "green" ? "grad-green" : t === "amber" ? "grad-amber" : "grad-blue";
const iconCls = (i) => `fa-solid ${i}`;
const uuid = () => crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

const load = (k, d) => {
  try {
    const r = localStorage.getItem(k);
    if (r) return JSON.parse(r);
  } catch { }
  return d;
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ===== State ===== */
let walletMode = "create"; // 'create' | 'edit'
let editingWalletId = null;

let wallets = load(LS_WALLETS, [
  { id: uuid(), name: "Rekening Bank", note: "Utama", balance: 0, theme: "blue", icon: "fa-building-columns" },
  { id: uuid(), name: "DANA", note: "Belanja & Harian", balance: 0, theme: "green", icon: "fa-mobile-screen" },
  { id: uuid(), name: "Tabungan", note: "Cadangan", balance: 0, theme: "amber", icon: "fa-piggy-bank" },
]);
let cats = load(LS_CATS, { income: [], expense: [] });
let txs = load(LS_TX, []);
let displayName = localStorage.getItem(LS_NAME) || "User";

let txType = "out", txMode = "create", editingTxId = null;
let statsWalletId = "all", statsDonutType = "expense";
let historyFilter = null; // null|'in'|'out'|'debt'

let debtSign = 1; // +1 = Pinjam, -1 = Bayar


/* NEW: Bulanan vs Tahunan */
let statsPeriod = "month"; // 'month' | 'year'

/* ===== Hidden balance toggles ===== */
let hideTotal = localStorage.getItem(LS_HIDE_TOTAL) === "1";
let hideWallets = localStorage.getItem(LS_HIDE_WALLETS) === "1";
let hideDebt = localStorage.getItem(LS_HIDE_DEBT) === "1";

/* ===== Reveal-on-scroll Observer ===== */
let _io = null;
function ensureObserver() {
  if (_io) return _io;
  _io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("reveal");
          _io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 }
  );
  return _io;
}

/* ===== Render: Header Name ===== */
function renderName() {
  $("#displayName").textContent = displayName;
  const initial = (displayName || "U").trim().charAt(0).toUpperCase();
  $("#avatarCircle").textContent = initial || "U";
}

function renderSummary() {
  const total = wallets.reduce((a, w) => a + (+w.balance || 0), 0);
  const full = fmtIDR(total);
  const el = $("#totalBalance");
  el.dataset.full = full;
  el.textContent = hideTotal ? "•••••" : full;

  $("#summaryText").textContent = `Ringkasan dari ${wallets.length} dompet aktif`;
  $("#walletCountHint").textContent = wallets.length ? `• ${wallets.length} dompet` : "";
}

function walletItemHTML(w) {
  const full = fmtIDR(w.balance || 0);
  return `
  <div class="wallet-item" data-id="${w.id}" role="button" style="cursor:pointer">
    <div class="wallet-left">
      <div class="wallet-icon grad-${w.theme}">
        <i class="fa-solid ${w.icon}"></i>
      </div>
      <div class="wallet-meta">
        <b>${esc(w.name)}</b>
        <small>${esc(w.note || "")}</small>
      </div>
    </div>
    <div class="pill amount" data-full="${full}">
      ${hideWallets ? "•••••" : full}
    </div>
  </div>`;
}


function walletItemHomeHTML(w) {
  const full = fmtIDR(w.balance);
  return `<div class="wallet-item wallet-item-home" data-id="${w.id}" style="cursor:pointer">
    <div class="wallet-left">
      <div class="wallet-icon ${themeCls(w.theme)}"><i class="${iconCls(w.icon)}"></i></div>
      <div class="wallet-meta"><b>${w.name}</b><small>${w.note || ""}</small></div>
    </div>
    <div class="pill amount" data-full="${full}">${hideWallets ? "•••••" : full}</div>
  </div>`;
}

function renderWallets() {
  const list = $("#walletList");
  const home = $("#homeWalletList");
  if (!wallets.length) {
    list.innerHTML = `<div class="hint">Belum ada wallet. Tambahkan sekarang.</div>`;
    home.innerHTML = `<div class="hint">Belum ada dompet.</div>`;
  } else {
    list.innerHTML = wallets.map(walletItemHTML).join("");
    home.innerHTML = wallets.map(walletItemHomeHTML).join("");
  }
  fillStatsWalletSelect();
}

function renderDebtSummary() {
  const debts = txs.filter(t => t.type === "debt");

  // Grup per (walletId + judul) agar "Kopi" di dompet A beda dengan di dompet B.
  const groups = new Map(); // key -> { title, walletId, sum }
  for (const t of debts) {
    const title = (t.note || t.category || "Hutang").trim();
    const key = `${t.walletId || ""}||${title.toLowerCase()}`;
    const cur = groups.get(key) || { title, walletId: t.walletId || null, sum: 0 };
    cur.sum += Number(t.amount || 0); // pinjam (+), bayar (−)
    groups.set(key, cur);
  }

  // Tampilkan hanya yang masih ada sisa (> 0), urutkan terbesar ke kecil
  const items = Array.from(groups.values())
    .filter(g => g.sum > 0)
    .sort((a, b) => b.sum - a.sum);

  // Total sisa hutang
  const total = items.reduce((a, g) => a + g.sum, 0);
  $("#debtTotal").textContent = hideDebt ? "•••••" : fmtIDR(total);
  $("#debtCountPill").textContent = `${debts.length} transaksi`;

  // Render list judul + sisa per judul
  const box = $("#debtList");
  if (!box) return;

  if (!items.length) {
    box.innerHTML = `<div class="hint">Semua lunas. Mantap!</div>`;
  } else {
    box.innerHTML = items.map(g => {
      const w = wallets.find(x => x.id === g.walletId);
      const wname = w ? w.name : "—";
      return `
        <div class="wallet-item" style="padding:8px 0;border-bottom:1px dashed rgba(255,255,255,.08)">
          <div class="wallet-left">
            <div class="wallet-icon" style="width:28px;height:28px;border-radius:8px;font-size:12px">
              <i class="fa-solid fa-hand-holding-dollar"></i>
            </div>
            <div class="wallet-meta">
              <b>${esc(g.title)}</b>
              <small>${esc(wname)}</small>
            </div>
          </div>
          <div class="pill" style="font-size:12px" data-full="${fmtIDR(g.sum)}">
            ${hideDebt ? "•••••" : fmtIDR(g.sum)}
          </div>
        </div>`;
    }).join("");
  }
}



function syncEyeIcons() {
  const t = $("#toggleTotal i");
  const w = $("#toggleWallets i");
  const d = $("#toggleDebt i");
  if (t) t.className = hideTotal ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  if (w) w.className = hideWallets ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  if (d) d.className = hideDebt ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
}

// Bangun 1 item transaksi (tanpa tanggal di dalam item)
function recentTxItemHTML(t) {
  const sign = t.type === "in" ? "+" : t.type === "out" ? "-" : "";
  const cls = t.type === "in" ? "plus" : t.type === "out" ? "minus" : "";
  const w = wallets.find((x) => x.id === t.walletId);
  const walletName = w ? w.name : "—";
  const cat = t.type === "debt"
    ? (t.category || "Hutang")
    : (t.category || "Tanpa Kategori");
  const icon =
    t.type === "debt"
      ? "fa-hand-holding-dollar"
      : t.type === "in"
        ? "fa-arrow-down"
        : "fa-arrow-up";
  const fullAmount = `${sign}${fmtIDR(t.amount)}`;

  return `<div class="tx" data-txid="${t.id}" style="cursor:pointer">
    <div class="tx-info">
      <div class="ico"><i class="fa-solid ${icon}"></i></div>
      <div>
        <div class="tx-title">${cat}</div>
        <div class="tx-meta">${walletName}${t.note ? " • " + t.note : ""}</div>
      </div>
    </div>
    <span class="tx-amount ${cls}" data-full="${fullAmount}">${fullAmount}</span>
  </div>`;
}

// Klik baris transaksi => buka modal edit
$("#recentTx")?.addEventListener("click", (e) => {
  const row = e.target.closest?.(".tx");
  if (!row) return;
  const id = row.getAttribute("data-txid");
  if (id) openTxModalEdit(id);
});

// Render daftar riwayat transaksi, dikelompokkan per tanggal
function renderRecentTx() {
  const wrap = $("#recentTx");
  if (!txs.length) {
    wrap.innerHTML = `<div class="hint">Belum ada transaksi.</div>`;
    return;
  }

  // 1) Filter sesuai pilihan
  let list = [...txs];
  if (historyFilter === "in") list = list.filter(t => t.type === "in");
  if (historyFilter === "out") list = list.filter(t => t.type === "out");
  if (historyFilter === "debt") list = list.filter(t => t.type === "debt");

  // 2) Map id -> index untuk urutan input (yang terbaru indeksnya lebih besar)
  const idxMap = new Map(txs.map((t, i) => [t.id, i]));

  // 3) Sort: tanggal terbaru dulu, lalu index terbaru dulu
  const sorted = list.sort((a, b) => {
    const da = new Date(a.date), db = new Date(b.date);
    if (db - da !== 0) return db - da; // beda tanggal
    return (idxMap.get(b.id) ?? 0) - (idxMap.get(a.id) ?? 0); // sama hari, terbaru di atas
  });

  // 4) Jika tanpa filter, batasi 10 transaksi terbaru
  const limited = historyFilter ? sorted : sorted.slice(0, 10);

  // 5) Kelompokkan per-hari (YYYY-MM-DD)
  const byDay = new Map();
  for (const t of limited) {
    const d = new Date(t.date);
    const dayKey = d.toISOString().slice(0, 10);
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey).push(t); // urutan dalam hari ikut 'sorted' (sudah terbaru->lama)
  }

  // 6) Render header tanggal + itemnya
  const sections = [];
  for (const [dayKey, items] of byDay.entries()) {
    const d = new Date(dayKey + "T00:00:00");
    const label = d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const itemsHtml = items.map(recentTxItemHTML).join("");
    sections.push(
      `<div class="tx-day">
         <div class="tx-date">${label}</div>
         ${itemsHtml}
       </div>`
    );
  }

  wrap.innerHTML = sections.join("") || `<div class="hint">Tidak ada transaksi sesuai filter.</div>`;
}

function renderAll() {
  renderName();
  renderSummary();
  renderWallets();
  renderDebtSummary();
  renderRecentTx();
  renderStats();
  animateCurrentScreen();

  applyAmountCharClamp();
}

/* ===== Modal helpers ===== */
function openModal(sel) { $(sel).classList.add("show"); }
function closeModal(sel) { $(sel).classList.remove("show"); }

/* ===== Wallet CRUD (Tambah/Edit) ===== */
function openWalletModalCreate() {
  walletMode = "create";
  editingWalletId = null;
  $("#walletModalTitle").textContent = "Tambah Wallet";
  $("#inWName").value = "";
  $("#inWNote").value = "";
  $("#inWBalance").value = "";
  $("#inWTheme").value = "blue|fa-building-columns";
  $("#btnDeleteWallet")?.style.setProperty("display", "none"); // sembunyikan di mode tambah
  openModal("#modalAddWallet");
}

function openWalletModalEdit(id) {
  const w = wallets.find((x) => x.id === id);
  if (!w) return;
  walletMode = "edit";
  editingWalletId = id;
  $("#walletModalTitle").textContent = "Edit Wallet";
  $("#inWName").value = w.name || "";
  $("#inWNote").value = w.note || "";
  $("#inWBalance").value = Number(w.balance || 0);
  $("#inWTheme").value = `${w.theme}|${w.icon}`;
  $("#btnDeleteWallet")?.style.setProperty("display", "inline-grid"); // TAMPILKAN di mode edit
  openModal("#modalAddWallet");
}

function saveWalletFromModal() {
  const name = ($("#inWName").value || "").trim();
  const note = ($("#inWNote").value || "").trim();
  const balance = Number($("#inWBalance").value || 0);
  const [theme, icon] = ($("#inWTheme").value || "blue|fa-building-columns").split("|");
  if (!name) { alert("Nama wallet wajib diisi."); return; }

  if (walletMode === "create") {
    wallets.push({ id: uuid(), name, note, balance, theme, icon });
  } else {
    const idx = wallets.findIndex((w) => w.id === editingWalletId);
    if (idx !== -1) wallets[idx] = { ...wallets[idx], name, note, balance, theme, icon };
  }
  save(LS_WALLETS, wallets);
  renderAll();
  closeModal("#modalAddWallet");
  $("#tab-wallet").checked = true;
  onTabChange();
}
function doDeleteWallet(id) {
  const related = txs.filter((t) => t.walletId === id).length;
  if (!confirm(related ? `Hapus wallet ini? ${related} transaksi terkait akan dihapus.` : `Hapus wallet ini?`)) return;
  wallets = wallets.filter((w) => w.id !== id);
  txs = txs.filter((t) => t.walletId !== id);
  save(LS_WALLETS, wallets);
  save(LS_TX, txs);
  if (statsWalletId === id) statsWalletId = "all";
  renderAll();
}

/* ===== Categories ===== */
function renderCatList() {
  const type = $("#catType").value;
  const list = cats[type] || [];
  const wrap = $("#catList");
  if (!list.length) {
    wrap.innerHTML = `<div class="hint">Belum ada kategori ${type === "income" ? "pemasukan" : "pengeluaran"}.</div>`;
    return;
  }
  wrap.innerHTML = list.map((c) => `
    <div class="catitem" data-name="${c}" style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px dashed rgba(255,255,255,.08)">
      <div>${c}</div>
      <button class="btn-mini" data-del="${c}"><i class="fa-solid fa-xmark"></i></button>
    </div>`).join("");
}
function addCategory() {
  const type = $("#catType").value;
  const name = $("#catName").value.trim();
  if (!name) { alert("Nama kategori wajib diisi."); return; }
  if (!cats[type]) cats[type] = [];
  if (cats[type].includes(name)) { alert("Kategori sudah ada."); return; }
  cats[type].push(name);
  save(LS_CATS, cats);
  $("#catName").value = "";
  renderCatList();
}
function deleteCategory(name) {
  const type = $("#catType").value;
  if (!confirm(`Hapus kategori "${name}"?`)) return;
  cats[type] = (cats[type] || []).filter((x) => x !== name);
  save(LS_CATS, cats);
  renderCatList();
}

/* ===== Transactions ===== */
function setTxType(t) {
  txType = t;
  $("#tagIn").style.outline = t === "in" ? "2px solid rgba(34,197,94,.6)" : "none";
  $("#tagOut").style.outline = t === "out" ? "2px solid rgba(239,68,68,.6)" : "none";
  $("#tagDebt").style.outline = t === "debt" ? "2px solid rgba(245,158,11,.6)" : "none";
  fillTxCategory();
}
function setTxType(t) {
  txType = t;
  $("#tagIn").style.outline = t === "in" ? "2px solid rgba(34,197,94,.6)" : "none";
  $("#tagOut").style.outline = t === "out" ? "2px solid rgba(239,68,68,.6)" : "none";
  $("#tagDebt").style.outline = t === "debt" ? "2px solid rgba(245,158,11,.6)" : "none";

  // Tampilkan toggle Pinjam/Bayar khusus hutang
  const dir = $("#debtDir");
  if (dir) dir.style.display = (t === "debt") ? "grid" : "none";

  // Ubah placeholder catatan agar jadi "judul hutang"
  const note = $("#inNoteTx");
  if (note) note.placeholder = (t === "debt")
    ? "Judul hutang / keterangan (mis: Kopi)"
    : "Catatan (opsional)";

  fillTxCategory(); // hutang: di UI kamu memang tanpa kategori

  // ⬇️ BARU: sembunyikan/ munculkan pilih dompet
  const wl = $("#inWallet");
  if (wl) wl.style.display = (t === "debt") ? "none" : "";
}

$("#debtPlus")?.addEventListener("click", () => {
  debtSign = 1;
  $("#debtPlus")?.classList.add("active");
  $("#debtMinus")?.classList.remove("active");
});
$("#debtMinus")?.addEventListener("click", () => {
  debtSign = -1;
  $("#debtMinus")?.classList.add("active");
  $("#debtPlus")?.classList.remove("active");
});


function fillTxWallet() {
  const sel = $("#inWallet");
  if (!wallets.length) { sel.innerHTML = `<option value="">(Belum ada wallet)</option>`; return; }
  sel.innerHTML = wallets.map((w) => `<option value="${w.id}">${w.name}</option>`).join("");
}
function fillTxCategory(selectedValue = null) {
  const sel = $("#inCategory");
  const type = txType === "in" ? "income" : txType === "out" ? "expense" : null;
  if (!type) {
    sel.innerHTML = `<option value="">(Hutang tidak butuh kategori)</option>`;
    $("#catHint").style.display = "none";
    return;
  }
  const list = cats[type] || [];
  if (!list.length) {
    sel.innerHTML = `<option value="">(Belum ada kategori)</option>`;
    $("#catHint").style.display = "block";
  } else {
    sel.innerHTML = list.map((c) => `<option value="${c}">${c}</option>`).join("");
    $("#catHint").style.display = "none";
    if (selectedValue && list.includes(selectedValue)) sel.value = selectedValue;
  }
}
function openTxModalCreate() {
  txMode = "create";
  editingTxId = null;
  $("#txModalTitle").textContent = "Tambah Transaksi";
  setTxType("out");
  $("#inAmount").value = "";
  $("#inNoteTx").value = "";
  $("#inDate").valueAsDate = new Date();
  fillTxWallet();
  fillTxCategory();
  $("#btnDeleteTx").style.display = "none";
  openModal("#modalTx");
}

function openTxModalEdit(txId) {
  const t = txs.find((x) => x.id === txId);
  if (!t) return;
  txMode = "edit";
  editingTxId = txId;
  $("#txModalTitle").textContent = "Edit Transaksi";
  setTxType(t.type);

  // Untuk hutang: tampilkan nilai absolut dan set toggle sesuai tanda
  if (t.type === "debt") {
    debtSign = t.amount >= 0 ? 1 : -1;
    $("#debtPlus")?.classList.toggle("active", debtSign === 1);
    $("#debtMinus")?.classList.toggle("active", debtSign === -1);
    $("#inAmount").value = Math.abs(Number(t.amount || 0));
  } else {
    $("#inAmount").value = t.amount;
  }

  fillTxWallet();
  if (t.walletId) $("#inWallet").value = t.walletId; // tidak ada untuk hutang
  fillTxCategory(t.category);
  $("#inNoteTx").value = t.note || "";
  $("#inDate").value = t.date;
  $("#btnDeleteTx").style.display = "inline-grid";
  openModal("#modalTx");
}

function reverseTxEffect(t) {
  if (t.type === "debt") return;
  const w = wallets.find((w) => w.id === t.walletId);
  if (!w) return;
  w.balance = Number(w.balance || 0) + (t.type === "in" ? -t.amount : +t.amount);
}
function applyTxEffect(t) {
  if (t.type === "debt") return;
  const w = wallets.find((w) => w.id === t.walletId);
  if (!w) return;
  w.balance = Number(w.balance || 0) + (t.type === "in" ? +t.amount : -t.amount);
}
function applyEditWalletAdjustments(oldT, newT) {
  reverseTxEffect(oldT);
  applyTxEffect(newT);
}

function saveTxFromModal() {
  const amountAbs = Number($("#inAmount").value || 0);
  const walletIdRaw = $("#inWallet")?.value || "";
  const category = $("#inCategory").value;
  const note = $("#inNoteTx").value.trim();
  const date = $("#inDate").value || new Date().toISOString().slice(0, 10);

  if (!amountAbs || amountAbs <= 0) { alert("Nominal harus > 0"); return; }

  // Hutang tidak pakai dompet; pemasukan/pengeluaran tetap wajib dompet
  const walletId = (txType === "debt") ? null : walletIdRaw;
  if (txType !== "debt" && !walletId) { alert("Pilih dompet"); return; }

  // Terapkan tanda khusus hutang
  const amount = (txType === "debt") ? (debtSign * amountAbs) : amountAbs;

  if (txMode === "create") {
    const t = { id: uuid(), type: txType, amount, category, note, walletId, date };
    txs.push(t);
    applyTxEffect(t); // aman: applyTxEffect() akan return untuk hutang
  } else {
    const idx = txs.findIndex((x) => x.id === editingTxId);
    if (idx < 0) { closeModal("#modalTx"); return; }
    const oldT = { ...txs[idx] };
    const newT = { ...oldT, type: txType, amount, category, note, walletId, date };

    // sesuaikan saldo dompet hanya untuk in/out
    applyEditWalletAdjustments(oldT, newT);
    txs[idx] = newT;
  }

  save(LS_TX, txs);
  save(LS_WALLETS, wallets);
  renderAll();
  closeModal("#modalTx");
  $("#tab-home").checked = true;
  onTabChange();
  updateFabForTab?.();
}

function doDeleteTx(txId, silentClose = false) {
  const idx = txs.findIndex((t) => t.id === txId);
  if (idx < 0) return;
  const t = txs[idx];
  if (!confirm("Hapus transaksi ini?")) return;
  reverseTxEffect(t);
  txs.splice(idx, 1);
  save(LS_TX, txs);
  save(LS_WALLETS, wallets);
  renderAll();
  if (!silentClose) closeModal("#modalTx");
  $("#tab-home").checked = true;
  onTabChange();
}

/* ===== Statistik (Donut + Bars) ===== */
const PALETTE = ["#60a5fa", "#34d399", "#f59e0b", "#ef4444", "#a78bfa", "#22d3ee", "#f472b6", "#f97316"];

function fillStatsWalletSelect() {
  const sel = $("#statsWallet");
  sel.innerHTML = [`<option value="all">Semua Dompet (${wallets.length})</option>`]
    .concat(wallets.map((w) => `<option value="${w.id}">${w.name}</option>`)).join("");
  if (statsWalletId !== "all" && !wallets.some((w) => w.id === statsWalletId)) statsWalletId = "all";
  sel.value = statsWalletId;
}
function getWalletFilteredTx() {
  return statsWalletId === "all" ? [...txs] : txs.filter((t) => t.walletId === statsWalletId);
}

/* Keys & labels untuk agregasi */
function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][m - 1];
}
function yearKey(d) { return String(new Date(d).getFullYear()); }
function yearLabel(y) { return y; }

function lastNMonthsKeys(n) {
  const now = new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}
function lastNYearsKeys(n) {
  const now = new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const y = now.getFullYear() - i;
    keys.push(String(y));
  }
  return keys;
}

/* Donut mengikuti periode berjalan (bulan ini vs tahun ini) */
function periodStartDate() {
  const now = new Date();
  if (statsPeriod === "year") return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function renderDonut() {
  const base = getWalletFilteredTx().filter(t => t.type !== "debt");
  const start = periodStartDate();
  const rangeList = base.filter(t => new Date(t.date) >= start);

  const type = statsDonutType === "income" ? "in" : "out";
  const list = rangeList.filter(t => t.type === type);

  const total = list.reduce((a, b) => a + Number(b.amount || 0), 0);

  const donut = $("#donut"), legend = $("#legend"), lblTotal = $("#totalByType");

  if (total <= 0) {
    donut.style.background = "conic-gradient(#2a2f3b 0 100%)";
    legend.innerHTML = `<div class="muted">Belum ada data ${statsDonutType === "income" ? "pemasukan" : "pengeluaran"} untuk ${statsPeriod === "year" ? "tahun ini" : "bulan ini"}.</div>`;
    lblTotal.textContent = `Total: ${fmtIDR(0)}`;
    return;
  }

  const map = {};
  list.forEach(t => {
    const key = t.category && t.category.trim() ? t.category.trim() : "Tanpa Kategori";
    map[key] = (map[key] || 0) + Number(t.amount || 0);
  });

  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 5);
  if (entries.length > 5) {
    const rest = entries.slice(5).reduce((a, [, v]) => a + v, 0);
    top.push(["Lainnya", rest]);
  }

  let acc = 0;
  const segs = top.map(([name, val], i) => {
    const pct = (val / total) * 100;
    const start = acc;
    const end = acc + pct;
    acc = end;
    return { name, val, pct, start, end, color: PALETTE[i % PALETTE.length] };
  });
  if (segs.length) segs[segs.length - 1].end = 100;

  donut.style.background = "conic-gradient(" +
    segs.map(s => `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`).join(",") +
    ")";

  legend.innerHTML = segs
    .map(s => `<div class="lg"><div class="left"><span class="dot" style="background:${s.color}"></span> ${s.name}</div><div>${fmtIDR(s.val)} • ${s.pct.toFixed(1)}%</div></div>`)
    .join("");
  lblTotal.textContent = `Total: ${fmtIDR(total)}`;
}

/* Bars: jika Bulanan → 6 bulan terakhir; jika Tahunan → 5 tahun terakhir */
function renderBars() {
  const base = getWalletFilteredTx().filter((t) => t.type !== "debt");
  const barsEl = $("#bars");

  if (statsPeriod === "year") {
    const keys = lastNYearsKeys(5);
    barsEl.style.gridTemplateColumns = `repeat(${keys.length}, 1fr)`;

    const series = keys.map((k) => {
      const inSum = base.filter((t) => t.type === "in" && yearKey(t.date) === k).reduce((a, b) => a + b.amount, 0);
      const outSum = base.filter((t) => t.type === "out" && yearKey(t.date) === k).reduce((a, b) => a + b.amount, 0);
      return { k, inSum, outSum, label: k };
    });

    const maxVal = Math.max(1, ...series.flatMap((s) => [s.inSum, s.outSum]));
    const chartHeight = 170, ghost = 6, minNZ = 10;

    barsEl.innerHTML = series.map((s) => {
      const hInRaw = (s.inSum / maxVal) * chartHeight;
      const hOutRaw = (s.outSum / maxVal) * chartHeight;
      const hIn = s.inSum === 0 ? ghost : Math.max(minNZ, Math.round(hInRaw));
      const hOut = s.outSum === 0 ? ghost : Math.max(minNZ, Math.round(hOutRaw));
      return `<div class="bar" title="${s.label} • In: ${fmtIDR(s.inSum)} | Out: ${fmtIDR(s.outSum)}">
        <div class="cols">
          <div class="col in"  style="height:${hIn}px;  opacity:${s.inSum === 0 ? 0.35 : 1}"></div>
          <div class="col out" style="height:${hOut}px; opacity:${s.outSum === 0 ? 0.35 : 1}"></div>
        </div>
        <label>${s.label}</label>
      </div>`;
    }).join("");

  } else {
    const keys = lastNMonthsKeys(6);
    barsEl.style.gridTemplateColumns = `repeat(${keys.length}, 1fr)`;

    const series = keys.map((k) => {
      const inSum = base.filter((t) => t.type === "in" && monthKey(t.date) === k).reduce((a, b) => a + b.amount, 0);
      const outSum = base.filter((t) => t.type === "out" && monthKey(t.date) === k).reduce((a, b) => a + b.amount, 0);
      return { k, inSum, outSum, label: monthLabel(k) };
    });

    const maxVal = Math.max(1, ...series.flatMap((s) => [s.inSum, s.outSum]));
    const chartHeight = 170, ghost = 6, minNZ = 10;

    barsEl.innerHTML = series.map((s) => {
      const hInRaw = (s.inSum / maxVal) * chartHeight;
      const hOutRaw = (s.outSum / maxVal) * chartHeight;
      const hIn = s.inSum === 0 ? ghost : Math.max(minNZ, Math.round(hInRaw));
      const hOut = s.outSum === 0 ? ghost : Math.max(minNZ, Math.round(hOutRaw));
      return `<div class="bar" title="${s.label} • In: ${fmtIDR(s.inSum)} | Out: ${fmtIDR(s.outSum)}">
        <div class="cols">
          <div class="col in"  style="height:${hIn}px;  opacity:${s.inSum === 0 ? 0.35 : 1}"></div>
          <div class="col out" style="height:${hOut}px; opacity:${s.outSum === 0 ? 0.35 : 1}"></div>
        </div>
        <label>${s.label}</label>
      </div>`;
    }).join("");
  }
}

function renderStats() {
  fillStatsWalletSelect();
  renderDonut();
  renderBars();
}

/* ===== Export Excel ===== */
function toISO(d) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toISOString().slice(0, 10);
}
function bindExportButtonGuard() {
  const btn = $("#btnExportXlsx");
  if (!btn) return;
  btn.disabled = true;
  const timer = setInterval(() => {
    if (window.__XLSX_READY__ && window.XLSX) {
      btn.disabled = false;
      clearInterval(timer);
    }
  }, 300);
  btn.addEventListener("click", exportToExcel);
}
function exportToExcel() {
  if (!window.XLSX) { alert("Sedang memuat modul Excel… coba lagi sebentar lagi."); return; }

  // --- Helper: nama sheet aman (maks 31 char, tanpa karakter ilegal) ---
  const usedSheetNames = new Set();
  function safeSheetName(name) {
    let base = String(name || "Sheet").replace(/[:\\/?*\[\]]/g, " ").trim();
    if (!base) base = "Sheet";
    if (base.length > 28) base = base.slice(0, 28); // sisakan slot untuk (n)
    let candidate = base;
    let i = 2;
    while (usedSheetNames.has(candidate)) {
      candidate = `${base}(${i++})`;
      if (candidate.length > 31) candidate = candidate.slice(0, 31);
    }
    usedSheetNames.add(candidate);
    return candidate;
  }

  // --- Helper: Saldo awal = saldo sekarang - (total in - total out) ---
  function computeOpeningBalance(walletId) {
    const w = wallets.find(x => x.id === walletId);
    if (!w) return 0;
    let sumIn = 0, sumOut = 0;
    for (const t of txs) {
      if (t.walletId !== walletId) continue;
      if (t.type === "in") sumIn += Number(t.amount || 0);
      if (t.type === "out") sumOut += Number(t.amount || 0);
      // debt diabaikan: tidak mempengaruhi saldo dompet (sesuai app)
    }
    return Number(w.balance || 0) - (sumIn - sumOut);
  }

  // --- Helper: format ISO YYYY-MM-DD aman ---
  function toISO(d) {
    if (!d) return "";
    const dt = new Date(d);
    return isNaN(dt) ? String(d) : dt.toISOString().slice(0, 10);
  }

  // --- Workbook baru ---
  const wb = XLSX.utils.book_new();

  // === Sheet RINGKASAN (opsional tapi berguna) ===
  const summaryRows = [
    { Dompet: "Ringkasan", "Saldo Awal": "", "Total Debit": "", "Total Kredit": "", "Saldo Akhir": "" }
  ];
  let grandOpen = 0, grandDebit = 0, grandKredit = 0, grandAkhir = 0;

  // === Satu sheet per dompet: Buku Besar ===
  for (const w of wallets) {
    const opening = computeOpeningBalance(w.id);
    let running = opening;

    // Ambil transaksi dompet ini (hanya in/out yang memengaruhi saldo)
    const list = txs
      .filter(t => t.walletId === w.id && (t.type === "in" || t.type === "out"))
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // urut kronologis

    const rows = [];
    rows.push({
      Tanggal: "", Keterangan: "Saldo Awal", Debit: 0, Kredit: 0, Saldo: running, Ref: ""
    });

    let totalDebit = 0, totalKredit = 0;

    for (const t of list) {
      const isIn = t.type === "in";
      const isOut = t.type === "out";
      const debit = isIn ? Number(t.amount || 0) : 0;
      const kredit = isOut ? Number(t.amount || 0) : 0;
      running += (debit - kredit);

      const ket = `${t.category && t.category.trim() ? t.category.trim() : "Tanpa Kategori"}${t.note ? " — " + t.note : ""}`;

      rows.push({
        Tanggal: toISO(t.date),
        Keterangan: ket,
        Debit: debit,
        Kredit: kredit,
        Saldo: running,
        Ref: t.id
      });

      totalDebit += debit;
      totalKredit += kredit;
    }

    // Baris total
    rows.push({
      Tanggal: "", Keterangan: "TOTAL", Debit: totalDebit, Kredit: totalKredit, Saldo: running, Ref: ""
    });

    // --- Header judul & meta (baris 1-3) ---
    const title = [`Buku Besar — ${w.name}`, "", "", "", "", ""];
    const meta = [`Tema: ${w.theme} | Ikon: ${w.icon}`, "", "", "", "", ""];

    // Mulai sheet dari judul (tanpa tabel dulu)
    const ws = XLSX.utils.aoa_to_sheet([title, meta, []]);

    // --- Tabel data: tulis SEKALI mulai A4 ---
    XLSX.utils.sheet_add_json(ws, rows, {
      origin: "A4",
      header: ["Tanggal", "Keterangan", "Debit", "Kredit", "Saldo", "Ref"],
      skipHeader: false
    });

    // Lebar kolom
    ws["!cols"] = [
      { wch: 12 },  // Tanggal
      { wch: 40 },  // Keterangan
      { wch: 14 },  // Debit
      { wch: 14 },  // Kredit
      { wch: 14 },  // Saldo
      { wch: 24 },  // Ref
    ];

    // Nama sheet aman
    const sheetName = safeSheetName(`WL - ${w.name}`);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Tambah ke ringkasan
    summaryRows.push({
      Dompet: w.name,
      "Saldo Awal": opening,
      "Total Debit": totalDebit,
      "Total Kredit": totalKredit,
      "Saldo Akhir": running
    });
    grandOpen += opening;
    grandDebit += totalDebit;
    grandKredit += totalKredit;
    grandAkhir += running;
  }

  // Tambah baris total ringkasan
  summaryRows.push({
    Dompet: "TOTAL",
    "Saldo Awal": grandOpen,
    "Total Debit": grandDebit,
    "Total Kredit": grandKredit,
    "Saldo Akhir": grandAkhir
  });

  // Sheet RINGKASAN
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows, { header: ["Dompet", "Saldo Awal", "Total Debit", "Total Kredit", "Saldo Akhir"] });
  wsSummary["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, safeSheetName("Ringkasan"));

  // Sheet HUTANG (global, tidak memengaruhi saldo dompet)
  const debts = txs.filter(t => t.type === "debt");
  const debtRows = debts.length ? debts.map(t => {
    const w = wallets.find(x => x.id === t.walletId);
    return {
      Tanggal: toISO(t.date),
      Dompet: w ? w.name : "(tidak ditemukan)",
      Kategori: t.category || "Hutang",
      Keterangan: t.note || "",
      Nominal: Number(t.amount || 0),
      Ref: t.id
    };
  }) : [{ Tanggal: "", Dompet: "", Kategori: "", Keterangan: "(Tidak ada data hutang)", Nominal: 0, Ref: "" }];
  const wsDebt = XLSX.utils.json_to_sheet(debtRows, { header: ["Tanggal", "Dompet", "Kategori", "Keterangan", "Nominal", "Ref"] });
  wsDebt["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 16 }, { wch: 40 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsDebt, safeSheetName("Hutang"));

  // Tanggal file
  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  XLSX.writeFile(wb, `FinNote-Ledger-${ts}.xlsx`);
}

/* ===== Backup (.json) & Restore (merge) ===== */
function makeBackupPayload() {
  return {
    app: "FinNote",
    version: 1,
    exportedAt: new Date().toISOString(),
    displayName,
    wallets,
    cats,
    txs,
  };
}
function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
function handleBackupJSON() {
  const payload = makeBackupPayload();
  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  downloadJSON(payload, `FinNote-Backup-${ts}.json`);
  alert("Cadangan berhasil dibuat.");
}
function isValidBackup(json) {
  if (!json) return false;
  return (
    (json.app === "FinNote" || typeof json.app === "undefined") &&
    Array.isArray(json.wallets) &&
    json.cats &&
    Array.isArray(json.cats.income || []) &&
    Array.isArray(json.cats.expense || []) &&
    Array.isArray(json.txs)
  );
}
// REPLACE PENUH: menimpa semua data dengan isi cadangan
async function handleRestoreJSONFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!isValidBackup(data)) {
      alert("File cadangan tidak valid.");
      return;
    }

    const ok = confirm(
      "Pulihkan data dari cadangan?\n\n" +
      "MODE: REPLACE PENUH (ditimpa)\n" +
      "- Seluruh data saat ini akan DIGANTI dengan isi cadangan.\n" +
      "- Ini mencegah saldo dobel.\n\n" +
      "Lanjutkan?"
    );
    if (!ok) return;

    // 1) Timpa state dari backup (JANGAN applyTxEffect di sini!)
    displayName = (typeof data.displayName === "string" && data.displayName.trim())
      ? data.displayName.trim().replace(/^"(.*)"$/, "$1")
      : "User";

    wallets = Array.isArray(data.wallets) ? data.wallets : [];
    cats = data.cats && Array.isArray(data.cats.income) && Array.isArray(data.cats.expense)
      ? { income: data.cats.income, expense: data.cats.expense }
      : { income: [], expense: [] };
    txs = Array.isArray(data.txs) ? data.txs : [];

    // 2) Simpan ke localStorage
    localStorage.setItem(LS_NAME, displayName);
    save(LS_WALLETS, wallets);
    save(LS_CATS, cats);
    save(LS_TX, txs);

    // 3) Reset filter/seleksi yang mungkin tidak valid
    statsWalletId = "all";
    historyFilter = null;

    // 4) Render ulang UI
    renderAll();

    alert("Data berhasil dipulihkan.");
    $("#tab-home").checked = true;
    onTabChange();
  } catch (e) {
    console.error(e);
    alert("Gagal memulihkan. Pastikan file .json asli dari cadangan aplikasi ini.");
  }
}

/* ===== Smooth UX: screen activation + stagger ===== */
function animateCurrentScreen() {
  $$(".screen").forEach((s) => s.classList.remove("is-active"));
  const activeId = $("#tab-home").checked ? "home" :
    $("#tab-wallet").checked ? "wallet" :
      $("#tab-stats").checked ? "stats" : "settings";
  const scr = document.getElementById(activeId);
  if (!scr) return;
  scr.classList.add("is-active");

  const cards = Array.from(scr.querySelectorAll(".card"));
  cards.forEach((c) => c.classList.remove("reveal"));
  requestAnimationFrame(() => {
    cards.forEach((c, i) => { setTimeout(() => c.classList.add("reveal"), i * 70); });
  });
  const io = ensureObserver();
  cards.forEach((c) => io.observe(c));
}
function onTabChange() {
  animateCurrentScreen();
  updateFabForTab();
}

/* ===== FAB dinamis ===== */
function updateFabForTab() {
  const fab = $("#btnFabTx");
  if (!fab) return;

  const isHome = $("#tab-home").checked;
  const isWallet = $("#tab-wallet").checked;
  const isStats = $("#tab-stats").checked;
  const isSetting = $("#tab-settings").checked;

  fab.onclick = null;

  if (isHome) {
    fab.style.display = "grid";
    fab.title = "Tambah Transaksi";
    fab.onclick = openTxModalCreate;
  } else if (isWallet) {
    fab.style.display = "grid";
    fab.title = "Tambah Wallet";
    fab.onclick = openWalletModalCreate;
  } else if (isStats || isSetting) {
    fab.style.display = "none";
  } else {
    fab.style.display = "none";
  }
}

/* ===== Events ===== */
document.addEventListener("DOMContentLoaded", () => {
  // Nama & versi
  renderName();
  $("#inDisplayName").value = displayName;
  const v = document.getElementById("appVersion");
  if (v) v.textContent = `Versi ${APP_VERSION}`;

  // Render awal + nav
  renderAll();
  onTabChange();
  syncEyeIcons();
  ["#tab-home", "#tab-wallet", "#tab-stats", "#tab-settings"].forEach((sel) =>
    $(sel)?.addEventListener("change", onTabChange)
  );

  // Close modals
  $$("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => closeModal(btn.getAttribute("data-close")))
  );
  ["#modalAddWallet", "#modalTx", "#modalCats"].forEach((sel) => {
    const el = $(sel);
    el?.addEventListener("click", (e) => { if (e.target === e.currentTarget) closeModal(sel); });
  });

  // Wallet actions: klik baris untuk edit
  $("#walletList")?.addEventListener("click", (e) => {
    const row = e.target.closest?.(".wallet-item");
    if (!row) return;
    const id = row.getAttribute("data-id");
    if (id) openWalletModalEdit(id);
  });
  $("#btnDeleteWallet")?.addEventListener("click", () => {
    if (!editingWalletId) return;
    doDeleteWallet(editingWalletId);
    closeModal("#modalAddWallet");
  });

  // Tx actions
  $("#btnDoSaveTx")?.addEventListener("click", saveTxFromModal);
  $("#btnDeleteTx")?.addEventListener("click", () => { if (editingTxId) doDeleteTx(editingTxId); });

  // Tx actions: klik baris transaksi untuk edit
  $("#recentTx")?.addEventListener("click", (e) => {
    const row = e.target.closest?.(".tx");
    if (!row) return;
    const id = row.getAttribute("data-txid");
    if (id) openTxModalEdit(id);
  });

  // History filters
  $("#hfAll")?.addEventListener("click", () => { historyFilter = null; renderRecentTx(); });
  $("#hfIn")?.addEventListener("click", () => { historyFilter = "in"; renderRecentTx(); });
  $("#hfOut")?.addEventListener("click", () => { historyFilter = "out"; renderRecentTx(); });
  $("#hfDebt")?.addEventListener("click", () => { historyFilter = "debt"; renderRecentTx(); });

  // Stats
  $("#statsWallet")?.addEventListener("change", (e) => { statsWalletId = e.target.value || "all"; renderStats(); });
  $("#btnDonutExpense")?.addEventListener("click", () => {
    statsDonutType = "expense";
    $("#btnDonutExpense").classList.add("active");
    $("#btnDonutIncome").classList.remove("active");
    renderDonut();
  });
  $("#btnDonutIncome")?.addEventListener("click", () => {
    statsDonutType = "income";
    $("#btnDonutIncome").classList.add("active");
    $("#btnDonutExpense").classList.remove("active");
    renderDonut();
  });

  // Period (Bulanan/Tahunan)
  function setStatsPeriod(p) {
    statsPeriod = p;
    $('#periodMonthly')?.classList.toggle('active', p === 'month');
    $('#periodYearly')?.classList.toggle('active', p === 'year');
    renderStats();
  }
  $('#periodMonthly')?.addEventListener('click', () => setStatsPeriod('month'));
  $('#periodYearly')?.addEventListener('click', () => setStatsPeriod('year'));
  setStatsPeriod(statsPeriod); // set awal

  // Categories
  $("#btnOpenCats")?.addEventListener("click", () => { openModal("#modalCats"); renderCatList(); });
  $("#btnAddCat")?.addEventListener("click", addCategory);
  $("#catList")?.addEventListener("click", (e) => {
    const del = e.target.closest?.("[data-del]");
    if (del) deleteCategory(del.getAttribute("data-del"));
  });

  // Settings: nama
  $("#btnSaveName")?.addEventListener("click", () => {
    displayName = ($("#inDisplayName").value || "").trim() || "User";
    localStorage.setItem(LS_NAME, displayName);
    renderName();
  });

  // Backup/Restore & Export
  $("#btnBackupJSON")?.addEventListener("click", handleBackupJSON);
  $("#fileRestoreJSON")?.addEventListener("change", (e) => handleRestoreJSONFile(e.target.files?.[0]));
  bindExportButtonGuard();

  // Toggle hide/show saldo
  $("#toggleTotal")?.addEventListener("click", () => {
    hideTotal = !hideTotal; localStorage.setItem(LS_HIDE_TOTAL, hideTotal ? "1" : "0");
    syncEyeIcons(); renderSummary();
  });
  $("#toggleWallets")?.addEventListener("click", () => {
    hideWallets = !hideWallets; localStorage.setItem(LS_HIDE_WALLETS, hideWallets ? "1" : "0");
    syncEyeIcons(); renderWallets();
  });
  $("#toggleDebt")?.addEventListener("click", () => {
    hideDebt = !hideDebt; localStorage.setItem(LS_HIDE_DEBT, hideDebt ? "1" : "0");
    syncEyeIcons(); renderDebtSummary();
  });

  // Tag type
  $("#tagIn")?.addEventListener("click", () => setTxType("in"));
  $("#tagOut")?.addEventListener("click", () => setTxType("out"));
  $("#tagDebt")?.addEventListener("click", () => setTxType("debt"));
});
