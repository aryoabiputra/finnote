/* ===== Keys & Utils ===== */
const APP_VERSION = "1.1";
const LS_WALLETS = 'fin_wallets';
const LS_CATS = 'fin_categories';
const LS_TX = 'fin_transactions';
const LS_NAME = 'fin_display_name';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const fmtIDR = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(Number(n || 0));
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const monthLabel = (yyyyMM) => {
  if (!yyyyMM || typeof yyyyMM !== "string") return yyyyMM || "";
  const [y, m] = [yyyyMM.slice(0, 4), yyyyMM.slice(4, 6)];
  const dt = new Date(`${y}-${m}-01T00:00:00`);
  return dt.toLocaleDateString('id-ID', { year: 'numeric', month: 'short' });
};
const themeCls = (t) => (t === 'green' ? 'grad-green' : (t === 'amber' ? 'grad-amber' : 'grad-blue'));
const iconCls = (i) => `fa-solid ${i}`;
const uuid = () => (crypto?.randomUUID?.() || Math.random().toString(36).slice(2));

const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};

const toISO = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toISOString().slice(0, 10);
}

/* ===== State ===== */
let wallets = load(LS_WALLETS, []);
let cats = load(LS_CATS, { income: ['Gaji', 'Bonus'], expense: ['Makan', 'Transport'] });
let txs = load(LS_TX, []);
let displayName = load(LS_NAME, 'User');

/* ===== Cache XLSX async ===== */
(function loadXLSX() {
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  s.defer = true;
  s.onload = () => { window.__XLSX_READY__ = true; };
  document.head.appendChild(s);
})();

/* ===== Rendering ===== */
function renderWalletOptions() {
  const sel = $('#statsWallet');
  if (!sel) return;
  sel.innerHTML = '<option value="__ALL__">Semua Dompet</option>' +
    wallets.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
}
function renderWalletList() {
  const list = $('#walletList');
  if (!list) return;
  list.innerHTML = wallets.map(w => `
    <div class="wallet ${themeCls(w.theme)}">
      <div class="wallet-meta"><b>${w.name}</b><small>${w.note || ""}</small></div>
      <div class="wallet-balance">${fmtIDR(w.balance || 0)}</div>
      <div class="wallet-actions">
        <button class="btn small danger" data-act="del" data-id="${w.id}"><i class="fa fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}
function renderTxList() {
  const list = $('#txList');
  if (!list) return;
  const rows = txs.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")).reverse();
  list.innerHTML = rows.map(t => `
    <div class="tx ${t.type}">
      <div class="tx__left">
        <div class="tx__cat">${t.category || '-'}</div>
        <div class="tx__note">${t.note || ''}</div>
        <div class="tx__date">${fmtDate(t.date)}</div>
      </div>
      <div class="tx__right">
        <div class="tx__amt">${t.type === 'out' ? '-' : '+'} ${fmtIDR(t.amount || 0)}</div>
      </div>
    </div>
  `).join('');
}
function renderBalanceCard() {
  const el = $('#totalBalance');
  if (!el) return;
  const total = wallets.reduce((s, w) => s + Number(w.balance || 0), 0);
  el.textContent = fmtIDR(total);
}
function renderCharts() {
  const donutWrap = $('#chartDonut');
  const barWrap = $('#chartBar');
  if (!donutWrap || !barWrap) return;

  // Donut: per kategori untuk tipe aktif
  const activeType = $('#btnDonutIncome')?.classList.contains('active') ? 'in' : 'out';
  const counts = {};
  txs.forEach(t => {
    if (t.type !== activeType) return;
    counts[t.category || 'Lainnya'] = (counts[t.category || 'Lainnya'] || 0) + Number(t.amount || 0);
  });
  const donutData = Object.entries(counts).map(([k, v]) => ({ label: k, value: v }));
  donutWrap.innerHTML = donutData.length
    ? donutData.map(d => `<div class="chip"><span>${d.label}</span><b>${fmtIDR(d.value)}</b></div>`).join('')
    : `<div class="muted">Belum ada data.</div>`;

  // Bar: 6 bulan terakhir (in vs out)
  const agg = new Map(); // key: YYYYMM -> {inSum, outSum}
  txs.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date);
    if (isNaN(d)) return;
    const key = String(d.getFullYear()) + String(d.getMonth() + 1).padStart(2, '0');
    const obj = agg.get(key) || { inSum: 0, outSum: 0 };
    if (t.type === 'in') obj.inSum += Number(t.amount || 0);
    if (t.type === 'out') obj.outSum += Number(t.amount || 0);
    agg.set(key, obj);
  });
  const last6Keys = Array.from(agg.keys()).sort().slice(-6);
  const series = last6Keys.map(k => {
    const v = agg.get(k) || { inSum: 0, outSum: 0 };
    return { inSum: v.inSum, outSum: v.outSum, label: monthLabel(k) };
  });

  const maxVal = Math.max(1, ...series.flatMap((s) => [s.inSum, s.outSum]));
  const chartHeight = 120;
  barWrap.innerHTML = series.length ? `
    <div class="bars" style="--max:${maxVal}">
      ${series.map(s => `
        <div class="bar">
          <div class="col">
            <div class="in"   style="height:${(s.inSum / maxVal) * chartHeight}px" title="Pemasukan ${fmtIDR(s.inSum)}"></div>
            <div class="out"  style="height:${(s.outSum / maxVal) * chartHeight}px" title="Pengeluaran ${fmtIDR(s.outSum)}"></div>
          </div>
          <small>${s.label}</small>
        </div>
      `).join('')}
    </div>` : `<div class="muted">Belum ada data.</div>`;
}

/* ===== Tabs & Nav ===== */
function onTabChange() {
  const screens = $$('.screen');
  const activeId = $$('input[name="tab"]:checked')[0]?.dataset.target;
  screens.forEach(s => s.classList.toggle('active', '#' + s.id === activeId));
  renderAll();
}
function renderAll() {
  renderWalletOptions();
  renderWalletList();
  renderTxList();
  renderBalanceCard();
  renderCharts();
}
function bindBottomNav() {
  $$('#nav input[name="tab"]').forEach(r => r.addEventListener('change', onTabChange));
}

/* ===== Wallet Ops ===== */
function addWallet({ name, note = '', theme = 'blue', icon = 'fa-wallet', balance = 0 }) {
  const w = { id: uuid(), name, note, theme, icon, balance: Number(balance || 0) };
  wallets.push(w);
  save(LS_WALLETS, wallets);
  renderAll();
  return w;
}
function deleteWallet(id) {
  if (!confirm('Hapus dompet ini?')) return;
  // Hapus transaksi yang terkait
  txs = txs.filter(t => t.walletId !== id);
  wallets = wallets.filter(w => w.id !== id);
  save(LS_TX, txs);
  save(LS_WALLETS, wallets);
  renderAll();
}

/* ===== Transaction Ops ===== */
function addTransaction({ walletId, type, amount, category, note = '', date = new Date().toISOString() }) {
  const t = { id: uuid(), walletId, type, amount: Number(amount || 0), category, note, date };
  txs.push(t);
  applyTxEffect(t);
  save(LS_TX, txs);
  save(LS_WALLETS, wallets);
  renderAll();
  return t;
}
function applyTxEffect(t) {
  const w = wallets.find(w => w.id === t.walletId);
  if (!w) return;
  if (t.type === 'in') w.balance = Number(w.balance || 0) + Number(t.amount || 0);
  else if (t.type === 'out') w.balance = Number(w.balance || 0) - Number(t.amount || 0);
  // debt: tidak mengubah saldo
}

/* ===== Forms Bindings ===== */
function bindWalletForm() {
  const f = $('#formWallet');
  if (!f) return;
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = f.name.value.trim();
    if (!name) return;
    addWallet({
      name,
      note: f.note.value.trim(),
      theme: f.theme.value,
      icon: f.icon.value,
      balance: Number(f.balance.value || 0)
    });
    f.reset();
    $('#tab-wallet').checked = true;
    onTabChange();
  });

  // delete btn
  $('#walletList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="del"]');
    if (!btn) return;
    deleteWallet(btn.dataset.id);
  });
}
function bindTxForm() {
  const f = $('#formTx');
  if (!f) return;
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const walletId = f.walletId.value;
    const type = f.type.value;
    const amount = Number(f.amount.value || 0);
    const category = f.category.value.trim() || '-';
    const note = f.note.value.trim();
    const date = f.date.value ? new Date(f.date.value).toISOString() : new Date().toISOString();
    if (!walletId || !type || !amount) return;
    addTransaction({ walletId, type, amount, category, note, date });
    f.reset();
    $('#tab-home').checked = true;
    onTabChange();
  });
}

/* ===== Backup / Restore (JSON) ===== */
function isValidBackup(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.wallets) || !Array.isArray(data.txs)) return false;
  if (!data.cats || typeof data.cats !== 'object') return false;
  return true;
}
function handleBackupJSON() {
  const data = {
    app: "FinNote",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    displayName,
    wallets,
    cats,
    txs
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  a.href = URL.createObjectURL(blob);
  a.download = `FinNote-Backup-${ts}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function handleRestoreJSONFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!isValidBackup(data)) { alert('File cadangan tidak valid.'); return; }

    const ok = confirm(
      'Pulihkan data dari cadangan?\n\n' +
      'Catatan:\n' +
      '- Data AKAN DIGABUNGKAN (merge), bukan ditimpa.\n' +
      '- Wallet & transaksi baru TETAP DIPERTAHANKAN.\n' +
      '- Transaksi dari cadangan yang belum ada akan ditambahkan.'
    );
    if (!ok) return;

    // 1) Nama
    if ((!displayName || displayName === 'User') &&
        typeof data.displayName === 'string' && data.displayName.trim()) {
      displayName = data.displayName.trim().replace(/^"(.*)"$/, '$1');
      localStorage.setItem(LS_NAME, displayName);
    }

    // 2) Wallets: tambahkan hanya yang belum ada
    const backupWallets = Array.isArray(data.wallets) ? data.wallets : [];
    const currentWIds = new Set(wallets.map(w => w.id));
    const toAddWallets = backupWallets.filter(w => w && w.id && !currentWIds.has(w.id));
    if (toAddWallets.length) wallets = wallets.concat(toAddWallets);

    // Catat wallet yang BARU ditambahkan dari backup
    const newWalletIds = new Set(toAddWallets.map(w => w.id));

    // 3) Kategori: gabung unik
    const incSet = new Set([...(cats.income || []), ...(((data.cats || {}).income) || [])]);
    const expSet = new Set([...(cats.expense || []), ...(((data.cats || {}).expense) || [])]);
    cats = { income: Array.from(incSet), expense: Array.from(expSet) };

    // 4) Transaksi: de-dupe by id, dan apply efek saldo
    //    HANYA ke wallet yang SUDAH ADA sebelum restore.
    const backupTxs = Array.isArray(data.txs) ? data.txs : [];
    const currentTxIds = new Set(txs.map(t => t.id));
    const newTxs = [];

    for (const t of backupTxs) {
      if (!t || !t.id) continue;
      if (!currentTxIds.has(t.id)) {
        txs.push(t);
        newTxs.push(t);
        // Hindari double-count:
        // - Jika wallet baru diimpor dari backup, field balance wallet tsb
        //   SUDAH mencerminkan transaksi di backup -> JANGAN apply efek lagi.
        // - Jika wallet sudah ada sebelum restore, barulah apply efek.
        if (!newWalletIds.has(t.walletId)) {
          applyTxEffect(t);
        }
      }
    }

    // 5) Persist + render
    save(LS_WALLETS, wallets);
    save(LS_CATS, cats);
    save(LS_TX, txs);

    renderAll();
    alert(
      'Pemulihan selesai (merge).\n' +
      `Wallet baru ditambahkan: ${toAddWallets.length}\n` +
      `Transaksi baru digabungkan: ${newTxs.length}`
    );

    $('#tab-home').checked = true;
    onTabChange();
  } catch (e) {
    console.error(e);
    alert('Gagal memulihkan. Pastikan file .json asli dari cadangan aplikasi ini.');
  }
}

/* ===== Export EXCEL (LEDGER) ===== */
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

  // Helper: urutkan transaksi per tanggal (asc) lalu id
  const byDateAsc = (a, b) => {
    const da = (a.date || ""), db = (b.date || "");
    if (da < db) return -1;
    if (da > db) return 1;
    return String(a.id || "").localeCompare(String(b.id || ""));
  };

  // Kumpulkan transaksi per dompet
  const txByWallet = {};
  for (const t of txs) {
    const wid = t.walletId;
    if (!wid) continue;
    (txByWallet[wid] ||= []).push(t);
  }

  // ===== Sheet RINGKASAN =====
  const summaryRows = [];
  for (const w of wallets) {
    const list = (txByWallet[w.id] || []).slice().sort(byDateAsc);
    let sumIn = 0, sumOut = 0, n = 0;
    for (const t of list) {
      if (t.type === "in") { sumIn += Number(t.amount || 0); n++; }
      else if (t.type === "out") { sumOut += Number(t.amount || 0); n++; }
      // debt tidak memengaruhi saldo
    }
    summaryRows.push({
      Dompet: w.name,
      "Saldo Akhir": Number(w.balance || 0),
      "Total Pemasukan": sumIn,
      "Total Pengeluaran": sumOut,
      "Jumlah Transaksi": n
    });
  }

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

  // ===== Sheet ledger per DOMPET =====
  for (const w of wallets) {
    const list = (txByWallet[w.id] || []).slice().sort(byDateAsc);
    let running = 0;
    const rows = [];

    // (Opsional) baris saldo awal nol:
    // rows.push({ Tanggal: "", Keterangan: "Saldo Awal", Kategori: "", Tipe: "", Debit: "", Kredit: "", Saldo: 0 });

    for (const t of list) {
      const amt = Number(t.amount || 0);
      let debit = "", kredit = "";

      if (t.type === "in") {
        debit = amt;
        running += amt;
      } else if (t.type === "out") {
        kredit = amt;
        running -= amt;
      } else if (t.type === "debt") {
        // hutang: tampilkan sebagai catatan, saldo tidak berubah
      }

      const keterangan = (t.note && t.note.trim()) ? t.note.trim() : (t.category || "");
      rows.push({
        Tanggal: toISO(t.date),
        Keterangan: keterangan,
        Kategori: t.category || "",
        Tipe: t.type === "in" ? "Pemasukan" : t.type === "out" ? "Pengeluaran" : "Hutang",
        Debit: debit,
        Kredit: kredit,
        Saldo: running
      });
    }

    const title = `Ledger - ${w.name}`.slice(0, 31); // batas nama sheet Excel
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, title);
  }

  // ===== (Opsional) Sheet Kategori & Master Dompet =====
  const catsIncome = (cats.income || []).map((name) => ({ Tipe: "Pemasukan", Kategori: name }));
  const catsExpense= (cats.expense|| []).map((name) => ({ Tipe: "Pengeluaran", Kategori: name }));
  const wsCats = XLSX.utils.json_to_sheet([...catsIncome, ...catsExpense]);
  XLSX.utils.book_append_sheet(wb, wsCats, "Kategori");

  const wsWallets = XLSX.utils.json_to_sheet(wallets.map(w => ({
    id: w.id, Nama: w.name, Catatan: w.note || "", Saldo: Number(w.balance || 0), Tema: w.theme, Icon: w.icon
  })));
  XLSX.utils.book_append_sheet(wb, wsWallets, "Master Wallet");

  // ===== Auto width kolom semua sheet =====
  const allSheets = wb.SheetNames.map(n => wb.Sheets[n]);
  allSheets.forEach((ws) => {
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
  XLSX.writeFile(wb, `FinNote-Ledger-${ts}.xlsx`);
}

/* ===== Settings & Misc ===== */
function bindSettings() {
  // Display name
  const f = $('#formName');
  if (f) {
    f.name.value = displayName;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = f.name.value.trim();
      if (!val) return;
      displayName = val;
      save(LS_NAME, displayName);
      alert('Nama disimpan.');
    });
  }

  // Backup / Restore
  $('#btnBackupJSON')?.addEventListener('click', handleBackupJSON);
  $('#fileRestoreJSON')?.addEventListener('change', (e) => handleRestoreJSONFile(e.target.files?.[0]));
  bindExportButtonGuard();

  // Donut switching
  $('#btnDonutIncome')?.addEventListener('click', () => {
    $('#btnDonutIncome').classList.add('active');
    $('#btnDonutExpense').classList.remove('active');
    renderCharts();
  });
  $('#btnDonutExpense')?.addEventListener('click', () => {
    $('#btnDonutExpense').classList.add('active');
    $('#btnDonutIncome').classList.remove('active');
    renderCharts();
  });
}

/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', () => {
  bindBottomNav();
  bindWalletForm();
  bindTxForm();
  bindSettings();
  onTabChange();
});
