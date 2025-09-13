# FinNote — Aplikasi Pencatat Keuangan Pribadi

FinNote adalah aplikasi web pencatat keuangan sederhana dengan tampilan modern yang terinspirasi dari aplikasi dompet digital seperti **DANA**. Dibuat menggunakan **HTML, CSS, dan JavaScript**, aplikasi ini membantu kamu mengelola dompet, mencatat transaksi, dan menganalisis pemasukan serta pengeluaran dengan mudah dan cepat.

---

## ✨ Fitur Utama

### 🏠 Home
- Ringkasan total saldo dari semua dompet.  
- Daftar saldo per dompet.  
- Ringkasan total hutang.  
- Riwayat transaksi terbaru (pemasukan, pengeluaran, maupun hutang).  

### 👛 Wallet
- Tambah, hapus, dan kelola dompet sesuai kebutuhan (Bank, E-Wallet, Tabungan, dll).  
- Setiap dompet memiliki tema warna dan ikon berbeda.  
- Saldo otomatis terupdate saat ada transaksi baru.  

### 📊 Statistik
- Diagram Donut: distribusi pengeluaran/pemasukan per kategori.  
- Diagram Batang: perbandingan pemasukan dan pengeluaran 6 bulan terakhir.  
- Filter berdasarkan dompet tertentu atau semua dompet.  

### ⚙️ Settings
- Ubah nama profil dengan mudah.  
- Kelola kategori transaksi (pemasukan/pengeluaran).  
- Export seluruh data ke format **Excel (.xlsx)** untuk backup atau analisis lebih lanjut.  

---

## 🎨 Desain & UX
- Tampilan modern bergaya **glassmorphism** dengan efek blur, shadow, dan animasi halus.  
- Navigasi bawah (bottom navigation) ala aplikasi mobile.  
- Animasi *reveal on scroll* membuat transisi lebih hidup.  
- **Responsif**: nyaman digunakan di desktop maupun smartphone.  

---

## 🛠️ Teknologi yang Digunakan
- **HTML5** — Struktur halaman.  
- **CSS3** (Glassmorphism, Animasi) — Tampilan modern dan responsif.  
- **JavaScript (Vanilla JS)** — Logika aplikasi, CRUD dompet/transaksi, statistik, export Excel.  
- **SheetJS (xlsx)** — Export data ke Excel.  
- **Font Awesome** — Ikon navigasi dan UI.  

---

## 🚀 Cara Menjalankan
1. **Akses langsung melalui GitHub Pages**  
   Kamu bisa langsung mencoba aplikasi tanpa install apa pun lewat link berikut:  
   👉 [http://aryoabiputra.github.io/finnote](http://aryoabiputra.github.io/finnote)

2. **Jalankan secara lokal**  
   - Clone repo ini:
     ```bash
     git clone https://github.com/username/repo-finnote.git
     ```
   - Masuk ke folder project:
     ```bash
     cd repo-finnote
     ```
   - Buka file `index.html` dengan browser favoritmu.  

---

## 📌 Catatan
- Data disimpan di **localStorage** browser, jadi aman dan tidak butuh server/database.  
- Hapus data = clear cache/localStorage browser.  
- Cocok untuk **pengguna personal** yang ingin mengatur keuangan dengan ringan dan praktis.  

---

## 📷 Preview
(Tambahkan screenshot/gif aplikasi di sini)  

---

## 📄 Lisensi
Proyek ini dibuat untuk tujuan pembelajaran dan penggunaan pribadi. Silakan modifikasi sesuai kebutuhanmu.  
