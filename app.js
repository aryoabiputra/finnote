/* ===== Keys & Utils ===== */
const LS_WALLETS = "fin_wallets",
  LS_CATS = "fin_categories",
  LS_TX = "fin_transactions";
const $ = (s) => document.querySelector(s),
  $$ = (s) => document.querySelectorAll(s);
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
let wallets = load(LS_WALLETS, [
  {
    id: uuid(),
    name: "Bank BRI",
    note: "Utama",
    balance: 8200000,
    theme: "blue",
    icon: "fa-building-columns",
  },
  {
    id: uuid(),
    name: "DANA",
    note: "Belanja & Harian",
    balance: 2140000,
    theme: "green",
    icon: "fa-mobile-screen",
  },
  {
    id: uuid(),
    name: "Tabungan",
    note: "Cadangan",
    balance: 2200000,
    theme: "amber",
    icon: "fa-piggy-bank",
  },
]);
let cats = load(LS_CATS, { income: [], expense: [] });
let txs = load(LS_TX, []);

let txType = "out",
  txMode = "create",
  editingTxId = null;
let statsWalletId = "all",
  statsDonutType = "expense";

/* ===== Render Home/Wallet ===== */
function renderSummary() {
  const total = wallets.reduce((a, w) => a + (+w.balance || 0), 0);
  $("#totalBalance").textContent = fmtIDR(total);
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
    <div>
      <span class="pill">${fmtIDR(w.balance)}</span>
      <button class="btn-del" data-action="del" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
    </div>
  </div>`;
}
function walletItemHomeHTML(w) {
  return `<div class="wallet-item">
    <div class="wallet-left">
      <div class="wallet-icon ${themeCls(w.theme)}"><i class="${iconCls(
    w.icon
  )}"></i></div>
      <div class="wallet-meta"><b>${w.name}</b><small>${
    w.note || ""
  }</small></div>
    </div>
    <div class="pill">${fmtIDR(w.balance)}</div>
  </div>`;
}
function renderWallets() {
  const list = $("#walletList"),
    home = $("#homeWalletList");
  if (!wallets.length) {
    list.innerHTML = `<div class="hint">Belum ada wallet. Tambahkan sekarang.</div>`;
    home.innerHTML = `<div class="hint">Belum ada dompet.</div>`;
  } else {
    list.innerHTML = wallets.map(walletItemHTML).join("");
    home.innerHTML = wallets.map(walletItemHomeHTML).join("");
  }
  fillStatsWalletSelect();
}
function recentTxItemHTML(t) {
  // ikon & gaya tiap tipe
  let icon = '<i class="fa-solid fa-arrow-up"></i>';
  let clsAmount = "minus"; // default pengeluaran
  let sign = "-";

  if (t.type === "in") {
    icon = '<i class="fa-solid fa-arrow-down"></i>';
    clsAmount = "plus";
    sign = "+";
  }
  if (t.type === "debt") {
    icon = '<i class="fa-solid fa-hand-holding-dollar"></i>';
    clsAmount = "";
    sign = "";
  }

  const w = wallets.find((x) => x.id === t.walletId);
  const walletName = w ? w.name : t.walletId ? "—" : "Tanpa Dompet";
  const cat = t.category || (t.type === "debt" ? "Hutang" : "Tanpa Kategori");

  return `<div class="tx" data-txid="${t.id}">
    <div class="tx-info">
      <div class="ico">${icon}</div>
      <div>
        <div class="tx-title">${cat}</div>
        <div class="tx-meta">${fmtDate(t.date)} • ${walletName}${
    t.note ? " • " + t.note : ""
  }</div>
      </div>
    </div>
    <div class="tx-actions">
      <span class="tx-amount ${clsAmount}">${sign}${fmtIDR(t.amount)}</span>
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
  const latest = [...txs]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);
  wrap.innerHTML = latest.map(recentTxItemHTML).join("");
}
function renderDebtSummary(){
  const total = txs.filter(t => t.type === 'debt')
                   .reduce((a,b)=> a + Number(b.amount||0), 0);
  const count = txs.filter(t => t.type === 'debt').length;

  const elTotal = document.getElementById('debtTotal');
  const elCount = document.getElementById('debtCountPill');
  if (elTotal) elTotal.textContent = fmtIDR(total);
  if (elCount) elCount.textContent = `${count} transaksi`;
}

function renderAll() {
  renderSummary();
  renderWallets();
  renderRecentTx();
  renderDebtSummary();  // <- tambah ini
  renderStats();
}

/* ===== Wallet CRUD ===== */
function openModal(s) {
  $(s).classList.add("show");
}
function closeModal(s) {
  $(s).classList.remove("show");
}
function doAddWallet() {
  const name = $("#inWName").value.trim(),
    note = $("#inWNote").value.trim(),
    bal = Number($("#inWBalance").value || 0);
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
  const type = $("#catType").value,
    list = cats[type] || [],
    wrap = $("#catList");
  if (!list.length) {
    wrap.innerHTML = `<div class="hint">Belum ada kategori ${
      type === "income" ? "pemasukan" : "pengeluaran"
    }.</div>`;
    return;
  }
  wrap.innerHTML = list
    .map(
      (c) =>
        `<div class="catitem" data-name="${c}"><div>${c}</div><button class="btn-mini-del" data-del="${c}"><i class="fa-solid fa-xmark"></i></button></div>`
    )
    .join("");
}
function addCategory() {
  const type = $("#catType").value,
    name = $("#catName").value.trim();
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
  // highlight pilihan
  $("#tagIn") &&
    ($("#tagIn").style.outline =
      t === "in" ? "2px solid rgba(34,197,94,.6)" : "none");
  $("#tagOut") &&
    ($("#tagOut").style.outline =
      t === "out" ? "2px solid rgba(239,68,68,.6)" : "none");
  $("#tagDebt") &&
    ($("#tagDebt").style.outline =
      t === "debt" ? "2px solid rgba(245,158,11,.6)" : "none");
  fillTxCategory();
}
function fillTxWallet() {
  const sel = $("#inWallet");
  if (!sel) return;
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
  const hint = $("#catHint");
  if (!sel) return;

  if (txType === "debt") {
    // Hutang → kategori opsional
    sel.innerHTML = `<option value="">(Tidak ada)</option>`;
    if (hint) hint.style.display = "none";
    return;
  }
  const type = txType === "in" ? "income" : "expense";
  const list = cats[type] || [];
  if (!list.length) {
    sel.innerHTML = `<option value="">(Belum ada kategori)</option>`;
    if (hint) hint.style.display = "block";
  } else {
    sel.innerHTML = list
      .map((c) => `<option value="${c}">${c}</option>`)
      .join("");
    if (hint) hint.style.display = "none";
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
  if (t.walletId) $("#inWallet").value = t.walletId;
  fillTxCategory(t.category);
  $("#inNoteTx").value = t.note || "";
  $("#inDate").value = t.date;
  $("#btnDeleteTx").style.display = "inline-grid";
  openModal("#modalTx");
}
// Efek saldo (abaikan HUTANG)
function reverseTxEffect(t) {
  if (t.type !== "in" && t.type !== "out") return; // hutang → no-op
  const w = wallets.find((w) => w.id === t.walletId);
  if (!w) return;
  w.balance =
    Number(w.balance || 0) + (t.type === "in" ? -t.amount : +t.amount);
}
function applyTxEffect(t) {
  if (t.type !== "in" && t.type !== "out") return; // hutang → no-op
  const w = wallets.find((w) => w.id === t.walletId);
  if (!w) return;
  w.balance =
    Number(w.balance || 0) + (t.type === "in" ? +t.amount : -t.amount);
}
function applyEditWalletAdjustments(oldT, newT) {
  // balikkan efek lama (abaikan hutang) lalu terapkan efek baru (abaikan hutang)
  reverseTxEffect(oldT);
  applyTxEffect(newT);
}
function saveTxFromModal() {
  const amount = Number($("#inAmount").value || 0);
  const walletId = $("#inWallet").value; // boleh kosong untuk hutang
  const category = $("#inCategory").value;
  const note = $("#inNoteTx").value.trim();
  const date = $("#inDate").value || new Date().toISOString().slice(0, 10);

  if (!amount || amount <= 0) {
    alert("Nominal harus > 0");
    return;
  }
  if (txType !== "debt" && !walletId) {
    alert("Pilih dompet");
    return;
  }
  // untuk hutang, wallet opsional

  if (txMode === "create") {
    const t = {
      id: uuid(),
      type: txType,
      amount,
      category,
      note,
      walletId: walletId || "",
      date,
    };
    txs.push(t);
    applyTxEffect(t); // untuk hutang, applyTxEffect no-op
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
      walletId: walletId || "",
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
}

/* ===== Statistik ===== */
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
  // Statistik hanya hitung in/out — hutang diabaikan
  const base =
    statsWalletId === "all"
      ? [...txs]
      : txs.filter((t) => t.walletId === statsWalletId);
  return base.filter((t) => t.type === "in" || t.type === "out");
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
  const list = getFilteredTx();
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
  const chartHeight = 170;
  const ghost = 6;
  const minNZ = 10;

  const barsHTML = series
    .map((s) => {
      const hInRaw = (s.inSum / maxVal) * chartHeight;
      const hOutRaw = (s.outSum / maxVal) * chartHeight;
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
  const list = getFilteredTx(); // sudah exclude hutang
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
  if (segs.length) {
    segs[segs.length - 1].end = 100;
  }
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

/* ===== Export: SheetJS (.xlsx) ===== */
function toISO(d) {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toISOString().slice(0, 10);
}

// tombol export di-enable saat SheetJS siap (dimuat lewat HTML loader)
function bindExportButtonGuard() {
  const btn = document.getElementById("btnExportXlsx");
  if (!btn) return;
  btn.disabled = true;
  const enableWhenReady = setInterval(() => {
    if (window.__XLSX_READY__ && window.XLSX) {
      btn.disabled = false;
      clearInterval(enableWhenReady);
    }
  }, 300);
  btn.addEventListener("click", exportToExcel);
}

function exportToExcel() {
  if (!window.XLSX) {
    alert("Sedang memuat modul Excel… coba lagi dalam beberapa detik.");
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

  // Transaksi sheet: sertakan HUTANG (tipe = "Hutang")
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
      dompet: w ? w.name : t.walletId ? "(tidak ditemukan)" : "",
      kategori: t.category || (t.type === "debt" ? "Hutang" : ""),
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

  // Autofit sederhana
  [wsWallets, wsTx, wsCats].forEach((ws) => {
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
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

/* ===== Events ===== */
document.addEventListener("DOMContentLoaded", () => {
  renderAll();

  // Open modals
  $("#btnOpenAdd")?.addEventListener("click", () =>
    openModal("#modalAddWallet")
  );
  $("#btnOpenTx")?.addEventListener("click", openTxModalCreate);
  $("#btnOpenCats")?.addEventListener("click", () => {
    openModal("#modalCats");
    renderCatList();
  });

  // Close modals
  $$("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () =>
      closeModal(btn.getAttribute("data-close"))
    )
  );
  ["#modalAddWallet", "#modalTx", "#modalCats"].forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    el.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal(sel);
    });
  });

  // Wallet actions
  $("#btnDoAddWallet")?.addEventListener("click", doAddWallet);
  $("#walletList")?.addEventListener("click", (e) => {
    const btn = e.target.closest('[data-action="del"]');
    if (!btn) return;
    const row = e.target.closest(".wallet-item");
    const id = row?.dataset?.id;
    if (id) doDeleteWallet(id);
  });

  // Tx modal — pilih tipe
  $("#tagIn")?.addEventListener("click", () => setTxType("in"));
  $("#tagOut")?.addEventListener("click", () => setTxType("out"));
  $("#tagDebt")?.addEventListener("click", () => setTxType("debt"));

  // Tx modal — simpan/hapus
  $("#btnDoSaveTx")?.addEventListener("click", saveTxFromModal);
  $("#btnDeleteTx")?.addEventListener("click", () => {
    if (editingTxId) doDeleteTx(editingTxId);
  });

  // Edit/Delete dari Riwayat
  $("#recentTx")?.addEventListener("click", (e) => {
    const row = e.target.closest(".tx");
    if (!row) return;
    const txId = row.getAttribute("data-txid");
    const actEdit = e.target.closest('[data-action="edit"]');
    const actDel = e.target.closest('[data-action="del"]');
    if (actEdit && txId) openTxModalEdit(txId);
    if (actDel && txId) doDeleteTx(txId, true);
  });

  // Categories
  $("#catType")?.addEventListener("change", renderCatList);
  $("#btnAddCat")?.addEventListener("click", addCategory);
  $("#catList")?.addEventListener("click", (e) => {
    const d = e.target.closest("[data-del]")?.getAttribute("data-del");
    if (d) deleteCategory(d);
  });

  // Statistik controls
  $("#statsWallet")?.addEventListener("change", (e) => {
    statsWalletId = e.target.value;
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

  // Export Excel (enable setelah SheetJS siap)
  bindExportButtonGuard();
});
