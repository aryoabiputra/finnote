/* ===== Keys & Utils ===== */
const APP_VERSION = "1.1";
const LS_WALLETS = "fin_wallets";
const LS_CATS = "fin_categories";
const LS_TX = "fin_transactions";
const LS_NAME = "fin_display_name";
const LS_HIDE_TOTAL = "fin_hide_total";
const LS_HIDE_WALLETS = "fin_hide_wallets";
const LS_HIDE_DEBT = "fin_hide_debt";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const fmtIDR = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(n || 0));
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
const uuid = () =>
  crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

const load = (k, d) => {
  try {
    const r = localStorage.getItem(k);
    if (r) return JSON.parse(r);
  } catch {}
  return d;
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ===== State ===== */
let walletMode = "create"; // 'create' | 'edit'
let editingWalletId = null;

function openWalletModalCreate() {
  walletMode = "create";
  editingWalletId = null;
  $("#walletModalTitle").textContent = "Tambah Wallet";
  $("#inWName").value = "";
  $("#inWNote").value = "";
  $("#inWBalance").value = "";
  $("#inWTheme").value = "blue|fa-building-columns";
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
  openModal("#modalAddWallet");
}

function saveWalletFromModal() {
  const name = ($("#inWName").value || "").trim();
  const note = ($("#inWNote").value || "").trim();
  const balance = Number($("#inWBalance").value || 0);
  const [theme, icon] = (
    $("#inWTheme").value || "blue|fa-building-columns"
  ).split("|");

  if (!name) {
    alert("Nama wallet wajib diisi.");
    return;
  }

  if (walletMode === "create") {
    wallets.push({ id: uuid(), name, note, balance, theme, icon });
  } else {
    const idx = wallets.findIndex((w) => w.id === editingWalletId);
    if (idx !== -1) {
      wallets[idx] = { ...wallets[idx], name, note, balance, theme, icon };
    }
  }

  save(LS_WALLETS, wallets);
  renderAll();
  closeModal("#modalAddWallet");
  // Tetap di tab Wallet
  $("#tab-wallet").checked = true;
  onTabChange();
}

let wallets = load(LS_WALLETS, [
  {
    id: uuid(),
    name: "Rekening Bank",
    note: "Utama",
    balance: 0,
    theme: "blue",
    icon: "fa-building-columns",
  },
  {
    id: uuid(),
    name: "DANA",
    note: "Belanja & Harian",
    balance: 0,
    theme: "green",
    icon: "fa-mobile-screen",
  },
  {
    id: uuid(),
    name: "Tabungan",
    note: "Cadangan",
    balance: 0,
    theme: "amber",
    icon: "fa-piggy-bank",
  },
]);
let cats = load(LS_CATS, { income: [], expense: [] });
let txs = load(LS_TX, []);
let displayName = localStorage.getItem(LS_NAME) || "User";

let txType = "out",
  txMode = "create",
  editingTxId = null;
let statsWalletId = "all",
  statsDonutType = "expense";
let historyFilter = null; // null|'in'|'out'|'debt'

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

/* ===== Render: Home/Summary ===== */
function renderSummary() {
  const total = wallets.reduce((a, w) => a + (+w.balance || 0), 0);
  $("#totalBalance").textContent = hideTotal ? "•••••" : fmtIDR(total);
  $(
    "#summaryText"
  ).textContent = `Ringkasan dari ${wallets.length} dompet aktif`;
  $("#walletCountHint").textContent = wallets.length
    ? `• ${wallets.length} dompet`
    : "";
}

function walletItemHTML(w) {
  return `<div class="wallet-item" data-id="${w.id}">
    <div class="wallet-left">
      <div class="wallet-icon ${themeCls(w.theme)}"><i class="${iconCls(
    w.icon
  )}"></i></div>
      <div class="wallet-meta"><b>${w.name}</b><small>${
    w.note || ""
  }</small></div>
    </div>
    <div class="wallet-actions">
      <span class="pill">${fmtIDR(w.balance)}</span>
      <button class="btn-mini" data-action="edit" data-id="${
        w.id
      }" title="Edit"><i class="fa-solid fa-pen"></i></button>
      <button class="btn-del"  data-action="del"  data-id="${
        w.id
      }" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
    </div>
  </div>`;
}

/* Saldo per dompet di HOME — seluruh kartu bisa diklik */
function walletItemHomeHTML(w) {
  return `<div class="wallet-item wallet-item-home" data-id="${
    w.id
  }" style="cursor:pointer">
    <div class="wallet-left">
      <div class="wallet-icon ${themeCls(w.theme)}"><i class="${iconCls(
    w.icon
  )}"></i></div>
      <div class="wallet-meta"><b>${w.name}</b><small>${
    w.note || ""
  }</small></div>
    </div>
    <div class="pill">${hideWallets ? "•••••" : fmtIDR(w.balance)}</div>
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

/* Hutang = tx.type === 'debt' */
function renderDebtSummary() {
  const debts = txs.filter((t) => t.type === "debt");
  const total = debts.reduce((a, b) => a + Number(b.amount || 0), 0);
  $("#debtTotal").textContent = hideDebt ? "•••••" : fmtIDR(total);
  $("#debtCountPill").textContent = `${debts.length} transaksi`;
}

function syncEyeIcons() {
  const t = $("#toggleTotal i");
  const w = $("#toggleWallets i");
  const d = $("#toggleDebt i");
  if (t) t.className = hideTotal ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  if (w)
    w.className = hideWallets ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  if (d) d.className = hideDebt ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
}

function recentTxItemHTML(t) {
  const sign = t.type === "in" ? "+" : t.type === "out" ? "-" : "";
  const cls = t.type === "in" ? "plus" : t.type === "out" ? "minus" : "";
  const w = wallets.find((x) => x.id === t.walletId);
  const walletName = w ? w.name : "—";
  const cat =
    t.type === "debt" ? t.category || "Hutang" : t.category || "Tanpa Kategori";
  const icon =
    t.type === "debt"
      ? "fa-hand-holding-dollar"
      : t.type === "in"
      ? "fa-arrow-down"
      : "fa-arrow-up";
  return `<div class="tx" data-txid="${t.id}">
    <div class="tx-info">
      <div class="ico"><i class="fa-solid ${icon}"></i></div>
      <div>
        <div class="tx-title">${cat}</div>
        <div class="tx-meta">${fmtDate(t.date)} • ${walletName}${
    t.note ? " • " + t.note : ""
  }</div>
      </div>
    </div>
    <div class="tx-actions">
      <span class="tx-amount ${cls}">${sign}${fmtIDR(t.amount)}</span>
      <button class="btn-mini" data-action="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
      <button class="btn-mini" data-action="del"  title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
    </div>
  </div>`;
}
function renderRecentTx() {
  const wrap = $("#recentTx");
  if (!txs.length) {
    wrap.innerHTML = `<div class="hint">Belum ada transaksi.</div>`;
    return;
  }
  let list = [...txs];
  if (historyFilter === "in") list = list.filter((t) => t.type === "in");
  if (historyFilter === "out") list = list.filter((t) => t.type === "out");
  if (historyFilter === "debt") list = list.filter((t) => t.type === "debt");
  const sorted = list.sort((a, b) => new Date(b.date) - new Date(a.date));
  const limited = historyFilter ? sorted : sorted.slice(0, 10);
  wrap.innerHTML =
    limited.map(recentTxItemHTML).join("") ||
    `<div class="hint">Tidak ada transaksi sesuai filter.</div>`;
}

function renderAll() {
  renderName();
  renderSummary();
  renderWallets();
  renderDebtSummary();
  renderRecentTx();
  renderStats();
  animateCurrentScreen();
}

/* ===== Wallet CRUD ===== */
function openModal(sel) {
  $(sel).classList.add("show");
}
function closeModal(sel) {
  $(sel).classList.remove("show");
}

function doAddWallet() {
  const name = $("#inWName").value.trim();
  const note = $("#inWNote").value.trim();
  const bal = Number($("#inWBalance").value || 0);
  const [theme, icon] = $("#inWTheme").value.split("|");
  if (!name) {
    alert("Nama wallet wajib diisi.");
    return;
  }
  wallets.push({ id: uuid(), name, note, balance: bal, theme, icon });
  save(LS_WALLETS, wallets);
  renderAll();
  closeModal("#modalAddWallet");
  $("#tab-wallet").checked = true;
  onTabChange();
}
function doDeleteWallet(id) {
  const related = txs.filter((t) => t.walletId === id).length;
  if (
    !confirm(
      related
        ? `Hapus wallet ini? ${related} transaksi terkait akan dihapus.`
        : `Hapus wallet ini?`
    )
  )
    return;
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
    wrap.innerHTML = `<div class="hint">Belum ada kategori ${
      type === "income" ? "pemasukan" : "pengeluaran"
    }.</div>`;
    return;
  }
  wrap.innerHTML = list
    .map(
      (c) => `
    <div class="catitem" data-name="${c}" style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px dashed rgba(255,255,255,.08)">
      <div>${c}</div>
      <button class="btn-mini" data-del="${c}"><i class="fa-solid fa-xmark"></i></button>
    </div>
  `
    )
    .join("");
}
function addCategory() {
  const type = $("#catType").value;
  const name = $("#catName").value.trim();
  if (!name) {
    alert("Nama kategori wajib diisi.");
    return;
  }
  if (!cats[type]) cats[type] = [];
  if (cats[type].includes(name)) {
    alert("Kategori sudah ada.");
    return;
  }
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
  $("#tagIn").style.outline =
    t === "in" ? "2px solid rgba(34,197,94,.6)" : "none";
  $("#tagOut").style.outline =
    t === "out" ? "2px solid rgba(239,68,68,.6)" : "none";
  $("#tagDebt").style.outline =
    t === "debt" ? "2px solid rgba(245,158,11,.6)" : "none";
  fillTxCategory();
}
function fillTxWallet() {
  const sel = $("#inWallet");
  if (!wallets.length) {
    sel.innerHTML = `<option value="">(Belum ada wallet)</option>`;
    return;
  }
  sel.innerHTML = wallets
    .map((w) => `<option value="${w.id}">${w.name}</option>`)
    .join("");
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
    sel.innerHTML = list
      .map((c) => `<option value="${c}">${c}</option>`)
      .join("");
    $("#catHint").style.display = "none";
    if (selectedValue && list.includes(selectedValue))
      sel.value = selectedValue;
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
  $("#inAmount").value = t.amount;
  fillTxWallet();
  $("#inWallet").value = t.walletId;
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
  w.balance =
    Number(w.balance || 0) + (t.type === "in" ? -t.amount : +t.amount);
}
function applyTxEffect(t) {
  if (t.type === "debt") return;
  const w = wallets.find((w) => w.id === t.walletId);
  if (!w) return;
  w.balance =
    Number(w.balance || 0) + (t.type === "in" ? +t.amount : -t.amount);
}
function applyEditWalletAdjustments(oldT, newT) {
  reverseTxEffect(oldT);
  applyTxEffect(newT);
}
function saveTxFromModal() {
  const amount = Number($("#inAmount").value || 0);
  const walletId = $("#inWallet").value;
  const category = $("#inCategory").value;
  const note = $("#inNoteTx").value.trim();
  const date = $("#inDate").value || new Date().toISOString().slice(0, 10);
  if (!amount || amount <= 0) {
    alert("Nominal harus > 0");
    return;
  }
  if (!walletId) {
    alert("Pilih dompet");
    return;
  }

  if (txMode === "create") {
    const t = {
      id: uuid(),
      type: txType,
      amount,
      category,
      note,
      walletId,
      date,
    };
    txs.push(t);
    applyTxEffect(t);
  } else {
    const idx = txs.findIndex((x) => x.id === editingTxId);
    if (idx < 0) {
      closeModal("#modalTx");
      return;
    }
    const oldT = { ...txs[idx] };
    const newT = {
      ...oldT,
      type: txType,
      amount,
      category,
      note,
      walletId,
      date,
    };
    applyEditWalletAdjustments(oldT, newT);
    txs[idx] = newT;
  }
  save(LS_TX, txs);
  save(LS_WALLETS, wallets);
  renderAll();
  closeModal("#modalTx");
  $("#tab-home").checked = true;
  onTabChange();
  updateFabForTab();
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
const PALETTE = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#ef4444",
  "#a78bfa",
  "#22d3ee",
  "#f472b6",
  "#f97316",
];

function fillStatsWalletSelect() {
  const sel = $("#statsWallet");
  sel.innerHTML = [
    `<option value="all">Semua Dompet (${wallets.length})</option>`,
  ]
    .concat(wallets.map((w) => `<option value="${w.id}">${w.name}</option>`))
    .join("");
  if (statsWalletId !== "all" && !wallets.some((w) => w.id === statsWalletId))
    statsWalletId = "all";
  sel.value = statsWalletId;
}
function getFilteredTx() {
  return statsWalletId === "all"
    ? [...txs]
    : txs.filter((t) => t.walletId === statsWalletId);
}
function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [, m] = key.split("-").map(Number);
  return [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ][m - 1];
}
function lastSixMonthsKeys() {
  const now = new Date();
  const keys = [];
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return keys;
}
function renderBars() {
  const list = getFilteredTx().filter((t) => t.type !== "debt");
  const keys = lastSixMonthsKeys();
  const series = keys.map((k) => {
    const inSum = list
      .filter((t) => t.type === "in" && monthKey(t.date) === k)
      .reduce((a, b) => a + b.amount, 0);
    const outSum = list
      .filter((t) => t.type === "out" && monthKey(t.date) === k)
      .reduce((a, b) => a + b.amount, 0);
    return { k, inSum, outSum };
  });
  const maxVal = Math.max(1, ...series.flatMap((s) => [s.inSum, s.outSum]));
  const chartHeight = 170,
    ghost = 6,
    minNZ = 10;
  const barsHTML = series
    .map((s) => {
      const hInRaw = (s.inSum / maxVal) * chartHeight,
        hOutRaw = (s.outSum / maxVal) * chartHeight;
      const hIn = s.inSum === 0 ? ghost : Math.max(minNZ, Math.round(hInRaw));
      const hOut =
        s.outSum === 0 ? ghost : Math.max(minNZ, Math.round(hOutRaw));
      return `<div class="bar" title="${monthLabel(s.k)} • In: ${fmtIDR(
        s.inSum
      )} | Out: ${fmtIDR(s.outSum)}">
      <div class="cols">
        <div class="col in"  style="height:${hIn}px;  opacity:${
        s.inSum === 0 ? 0.35 : 1
      }"></div>
        <div class="col out" style="height:${hOut}px; opacity:${
        s.outSum === 0 ? 0.35 : 1
      }"></div>
      </div>
      <label>${monthLabel(s.k)}</label>
    </div>`;
    })
    .join("");
  $("#bars").innerHTML = barsHTML;
}
function renderDonut() {
  const list = getFilteredTx().filter((t) => t.type !== "debt");
  const type = statsDonutType === "income" ? "in" : "out";
  const total = list
    .filter((t) => t.type === type)
    .reduce((a, b) => a + b.amount, 0);
  const donut = $("#donut"),
    legend = $("#legend"),
    lblTotal = $("#totalByType");
  if (total <= 0) {
    donut.style.background = "conic-gradient(#2a2f3b 0 100%)";
    legend.innerHTML = `<div class="muted">Belum ada data ${
      statsDonutType === "income" ? "pemasukan" : "pengeluaran"
    }.</div>`;
    lblTotal.textContent = `Total: ${fmtIDR(0)}`;
    return;
  }
  const map = {};
  list
    .filter((t) => t.type === type)
    .forEach((t) => {
      const key =
        t.category && t.category.trim() ? t.category.trim() : "Tanpa Kategori";
      map[key] = (map[key] || 0) + t.amount;
    });
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 5);
  if (entries.length > 5) {
    const rest = entries.slice(5).reduce((a, [, v]) => a + v, 0);
    top.push(["Lainnya", rest]);
  }
  let acc = 0;
  const segs = top.map(([name, val], i) => {
    const pct = (val / total) * 100,
      start = acc;
    let end = acc + pct;
    acc = end;
    return { name, val, pct, start, end, color: PALETTE[i % PALETTE.length] };
  });
  if (segs.length) segs[segs.length - 1].end = 100;
  donut.style.background =
    "conic-gradient(" +
    segs
      .map((s) => `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`)
      .join(",") +
    ")";
  legend.innerHTML = segs
    .map(
      (s) =>
        `<div class="lg"><div class="left"><span class="dot" style="background:${
          s.color
        }"></span> ${s.name}</div><div>${fmtIDR(s.val)} • ${s.pct.toFixed(
          1
        )}%</div></div>`
    )
    .join("");
  lblTotal.textContent = `Total: ${fmtIDR(total)}`;
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
  if (!window.XLSX) {
    alert("Sedang memuat modul Excel… coba lagi sebentar lagi.");
    return;
  }
  const walletsSheet = wallets.map((w) => ({
    id: w.id,
    nama: w.name,
    catatan: w.note || "",
    saldo: Number(w.balance || 0),
    tema: w.theme,
    icon: w.icon,
  }));
  const txSheet = txs.map((t) => {
    const w = wallets.find((x) => x.id === t.walletId);
    return {
      id: t.id,
      tanggal: toISO(t.date),
      tipe:
        t.type === "in"
          ? "Pemasukan"
          : t.type === "out"
          ? "Pengeluaran"
          : "Hutang",
      nominal: Number(t.amount || 0),
      dompet: w ? w.name : "(tidak ditemukan)",
      kategori: t.category || "",
      catatan: t.note || "",
    };
  });
  const catsIncome = (cats.income || []).map((name) => ({
    tipe: "Pemasukan",
    kategori: name,
  }));
  const catsExpense = (cats.expense || []).map((name) => ({
    tipe: "Pengeluaran",
    kategori: name,
  }));
  const catsSheet = [...catsIncome, ...catsExpense];
  const wb = XLSX.utils.book_new();
  const wsWallets = XLSX.utils.json_to_sheet(walletsSheet);
  const wsTx = XLSX.utils.json_to_sheet(txSheet);
  const wsCats = XLSX.utils.json_to_sheet(catsSheet);
  XLSX.utils.book_append_sheet(wb, wsWallets, "Wallets");
  XLSX.utils.book_append_sheet(wb, wsTx, "Transaksi");
  XLSX.utils.book_append_sheet(wb, wsCats, "Kategori");

  [wsWallets, wsTx, wsCats].forEach((ws) => {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const widths = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let max = 10;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        const v = cell && cell.v != null ? String(cell.v) : "";
        max = Math.max(max, v.length + 2);
      }
      widths.push({ wch: Math.min(max, 40) });
    }
    ws["!cols"] = widths;
  });

  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  XLSX.writeFile(wb, `FinNote-Export-${ts}.xlsx`);
}

/* ===== Backup (.json) & Restore ===== */
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
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
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
async function handleRestoreJSONFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!isValidBackup(data)) {
      alert("File cadangan tidak valid.");
      return;
    }
    if (
      !confirm(
        "Pulihkan data dari cadangan? Ini akan MENIMPA data lokal saat ini."
      )
    )
      return;

    if (typeof data.displayName === "string" && data.displayName.trim()) {
      displayName = data.displayName.trim().replace(/^"(.*)"$/, "$1");
      localStorage.setItem(LS_NAME, displayName);
    }
    wallets = Array.isArray(data.wallets) ? data.wallets : [];
    cats = data.cats || { income: [], expense: [] };
    txs = Array.isArray(data.txs) ? data.txs : [];

    save(LS_WALLETS, wallets);
    save(LS_CATS, cats);
    save(LS_TX, txs);
    renderAll();
    alert("Pemulihan berhasil. Data telah dimuat.");
    $("#tab-home").checked = true;
    onTabChange();
  } catch (e) {
    console.error(e);
    alert(
      "Gagal memulihkan. Pastikan file .json asli dari cadangan aplikasi ini."
    );
  }
}

/* ===== Smooth UX: screen activation + stagger ===== */
function animateCurrentScreen() {
  $$(".screen").forEach((s) => s.classList.remove("is-active"));
  const activeId = $("#tab-home").checked
    ? "home"
    : $("#tab-wallet").checked
    ? "wallet"
    : $("#tab-stats").checked
    ? "stats"
    : "settings";
  const scr = document.getElementById(activeId);
  if (!scr) return;
  scr.classList.add("is-active");

  const cards = Array.from(scr.querySelectorAll(".card"));
  cards.forEach((c) => c.classList.remove("reveal"));
  requestAnimationFrame(() => {
    cards.forEach((c, i) => {
      setTimeout(() => c.classList.add("reveal"), i * 70);
    });
  });
  const io = ensureObserver();
  cards.forEach((c) => io.observe(c));
}
function onTabChange() {
  animateCurrentScreen();
  updateFabForTab();
}

function updateFabForTab() {
  const fab = $("#btnFabTx");
  if (!fab) return;

  const isHome = $("#tab-home").checked;
  const isWallet = $("#tab-wallet").checked;
  const isStats = $("#tab-stats").checked;
  const isSetting = $("#tab-settings").checked;

  // Reset handler dulu biar nggak dobel
  fab.onclick = null;

  if (isHome) {
    fab.style.display = "grid";
    fab.title = "Tambah Transaksi";
    fab.onclick = openTxModalCreate;
  } else if (isWallet) {
    fab.style.display = "grid";
    fab.title = "Tambah Wallet";
    // fab.onclick = () => openModal("#modalAddWallet");
    fab.onclick = openWalletModalCreate;
  } else if (isStats || isSetting) {
    fab.style.display = "none";
  } else {
    fab.style.display = "none";
  }
}

/* ===== Events ===== */
document.addEventListener("DOMContentLoaded", () => {
  // Inisialisasi nama
  renderName();
  $("#inDisplayName").value = displayName;

  // Render awal
  renderAll();
  onTabChange();
  syncEyeIcons();

  const v = document.getElementById("appVersion");
  if (v) v.textContent = `Versi ${APP_VERSION}`;

  // Nav tabs
  ["#tab-home", "#tab-wallet", "#tab-stats", "#tab-settings"].forEach((sel) =>
    $(sel)?.addEventListener("change", onTabChange)
  );

  // Close modals (klik luar kartu / tombol batal)
  $$("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () =>
      closeModal(btn.getAttribute("data-close"))
    )
  );
  ["#modalAddWallet", "#modalTx", "#modalCats"].forEach((sel) => {
    const el = $(sel);
    el?.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal(sel);
    });
  });

  // Wallet actions
  // $("#btnDoAddWallet")?.addEventListener("click", doAddWallet);
  $("#btnSaveWallet")?.addEventListener("click", saveWalletFromModal);

  $("#walletList")?.addEventListener("click", (e) => {
    const editBtn = e.target.closest?.('[data-action="edit"]');
    const delBtn = e.target.closest?.('[data-action="del"]');
    if (editBtn) {
      const id = editBtn.dataset.id;
      if (id) openWalletModalEdit(id);
      return;
    }
    if (delBtn) {
      const id = delBtn.dataset.id;
      if (id) doDeleteWallet(id);
    }
  });

  // Tx actions
  $("#btnDoSaveTx")?.addEventListener("click", saveTxFromModal);
  $("#btnDeleteTx")?.addEventListener("click", () => {
    if (editingTxId) doDeleteTx(editingTxId);
  });
  $("#recentTx")?.addEventListener("click", (e) => {
    const btn = e.target.closest?.(".btn-mini");
    const row = e.target.closest?.(".tx");
    if (!row || !btn) return;
    const id = row.getAttribute("data-txid");
    if (!id) return;
    if (btn.dataset.action === "edit") openTxModalEdit(id);
    if (btn.dataset.action === "del") doDeleteTx(id, true);
  });

  // History filters
  $("#hfAll")?.addEventListener("click", () => {
    historyFilter = null;
    renderRecentTx();
  });
  $("#hfIn")?.addEventListener("click", () => {
    historyFilter = "in";
    renderRecentTx();
  });
  $("#hfOut")?.addEventListener("click", () => {
    historyFilter = "out";
    renderRecentTx();
  });
  $("#hfDebt")?.addEventListener("click", () => {
    historyFilter = "debt";
    renderRecentTx();
  });

  // Stats
  $("#statsWallet")?.addEventListener("change", (e) => {
    statsWalletId = e.target.value || "all";
    renderStats();
  });
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

  // Categories
  $("#btnOpenCats")?.addEventListener("click", () => {
    openModal("#modalCats");
    renderCatList();
  });
  $("#btnAddCat")?.addEventListener("click", addCategory);
  $("#catList")?.addEventListener("click", (e) => {
    const del = e.target.closest?.("[data-del]");
    if (del) deleteCategory(del.getAttribute("data-del"));
  });

  // Settings
  $("#btnSaveName")?.addEventListener("click", () => {
    displayName = ($("#inDisplayName").value || "").trim() || "User";
    localStorage.setItem(LS_NAME, displayName);
    renderName();
  });

  // Backup/Restore & Export
  $("#btnBackupJSON")?.addEventListener("click", handleBackupJSON);
  $("#fileRestoreJSON")?.addEventListener("change", (e) =>
    handleRestoreJSONFile(e.target.files?.[0])
  );
  bindExportButtonGuard();

  // Hide/Show saldo
  // Hide/Show saldo
  $("#toggleTotal")?.addEventListener("click", () => {
    hideTotal = !hideTotal;
    localStorage.setItem(LS_HIDE_TOTAL, hideTotal ? "1" : "0");
    syncEyeIcons();
    renderSummary();
  });

  $("#toggleWallets")?.addEventListener("click", () => {
    hideWallets = !hideWallets;
    localStorage.setItem(LS_HIDE_WALLETS, hideWallets ? "1" : "0");
    syncEyeIcons();
    renderWallets();
  });

  $("#toggleDebt")?.addEventListener("click", () => {
    hideDebt = !hideDebt;
    localStorage.setItem(LS_HIDE_DEBT, hideDebt ? "1" : "0");
    syncEyeIcons();
    renderDebtSummary();
  });

  // Tag type clicks
  $("#tagIn")?.addEventListener("click", () => setTxType("in"));
  $("#tagOut")?.addEventListener("click", () => setTxType("out"));
  $("#tagDebt")?.addEventListener("click", () => setTxType("debt"));
});
