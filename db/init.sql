-- =============================================
-- HPPYS Database Schema
-- HPP System — Admin Panel
-- =============================================

-- Tarif biaya admin per kategori & platform
CREATE TABLE IF NOT EXISTS fee_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL DEFAULT 'Shopee',
  parent_kategori TEXT,
  kategori TEXT NOT NULL,
  rate REAL NOT NULL,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform, kategori)
);

-- Tier Gratis Ongkir Xtra
CREATE TABLE IF NOT EXISTS ongkir_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL DEFAULT 'Shopee',
  tier_key TEXT NOT NULL,
  tier_label TEXT,
  tier_group TEXT DEFAULT 'biasa',
  rate REAL NOT NULL,
  cap_amount INTEGER DEFAULT 40000,
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(platform, tier_key)
);

-- Riwayat perubahan tarif (audit log)
CREATE TABLE IF NOT EXISTS rate_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT,
  table_name TEXT,
  config_key TEXT,
  old_value REAL,
  new_value REAL,
  changed_at TEXT DEFAULT (datetime('now')),
  note TEXT
);

-- Tenant / penyewa aplikasi
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_toko TEXT NOT NULL,
  nama_pemilik TEXT,
  email TEXT,
  no_hp TEXT,
  license_key TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  mulai_sewa TEXT,
  expired_sewa TEXT,
  catatan TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Pengaturan aplikasi
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed: default settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES
  ('app_version', '1.0.0'),
  ('admin_pin', '123456'),
  ('license_prefix', 'HPPYS');

-- Seed: tarif Shopee default (dari XLSX)
INSERT OR IGNORE INTO fee_rates (platform, parent_kategori, kategori, rate) VALUES
  ('Shopee', 'Fashion', 'Fashion Wanita', 0.04),
  ('Shopee', 'Fashion', 'Fashion Pria', 0.04),
  ('Shopee', 'Fashion', 'Fashion Anak', 0.04),
  ('Shopee', 'Fashion', 'Fashion Muslim', 0.04),
  ('Shopee', 'Fashion', 'Aksesoris Fashion', 0.04),
  ('Shopee', 'Fashion', 'Jam Tangan', 0.04),
  ('Shopee', 'Fashion', 'Kacamata', 0.04),
  ('Shopee', 'Fashion', 'Tas Wanita', 0.04),
  ('Shopee', 'Fashion', 'Tas Pria', 0.04),
  ('Shopee', 'Fashion', 'Sepatu Wanita', 0.04),
  ('Shopee', 'Fashion', 'Sepatu Pria', 0.04),
  ('Shopee', 'Fashion', 'Sepatu Anak', 0.04),
  ('Shopee', 'Kecantikan & Perawatan', 'Perawatan & Kecantikan', 0.04),
  ('Shopee', 'Kecantikan & Perawatan', 'Skincare', 0.04),
  ('Shopee', 'Kecantikan & Perawatan', 'Makeup', 0.04),
  ('Shopee', 'Kecantikan & Perawatan', 'Parfum', 0.04),
  ('Shopee', 'Kesehatan', 'Kesehatan', 0.04),
  ('Shopee', 'Kesehatan', 'Suplemen & Vitamin', 0.04),
  ('Shopee', 'Kesehatan', 'Alat Kesehatan', 0.04),
  ('Shopee', 'Elektronik', 'Elektronik', 0.02),
  ('Shopee', 'Elektronik', 'Handphone & Aksesoris', 0.02),
  ('Shopee', 'Elektronik', 'Komputer & Laptop', 0.02),
  ('Shopee', 'Elektronik', 'Kamera', 0.02),
  ('Shopee', 'Elektronik', 'TV & Audio', 0.02),
  ('Shopee', 'Rumah & Dapur', 'Peralatan Dapur', 0.03),
  ('Shopee', 'Rumah & Dapur', 'Peralatan Rumah', 0.03),
  ('Shopee', 'Rumah & Dapur', 'Furnitur', 0.03),
  ('Shopee', 'Rumah & Dapur', 'Dekorasi Rumah', 0.03),
  ('Shopee', 'Ibu & Bayi', 'Perlengkapan Bayi', 0.04),
  ('Shopee', 'Ibu & Bayi', 'Pakaian Bayi', 0.04),
  ('Shopee', 'Mainan & Hobi', 'Mainan Anak', 0.04),
  ('Shopee', 'Mainan & Hobi', 'Hobi', 0.04),
  ('Shopee', 'Olahraga', 'Olahraga & Outdoor', 0.03),
  ('Shopee', 'Olahraga', 'Alat Olahraga', 0.03),
  ('Shopee', 'Makanan & Minuman', 'Makanan & Minuman', 0.03),
  ('Shopee', 'Otomotif', 'Otomotif', 0.03),
  ('Shopee', 'Otomotif', 'Aksesoris Motor', 0.03),
  ('Shopee', 'Otomotif', 'Aksesoris Mobil', 0.03),
  ('Shopee', 'Buku & Alat Tulis', 'Buku & Alat Tulis', 0.03),
  ('Shopee', 'Investasi & Keuangan', 'Logam Mulia', 0.015),
  ('Shopee', 'Voucher & Tiket', 'Voucher Digital', 0.015),
  ('Shopee', 'Voucher & Tiket', 'Tiket & Voucher', 0.02),
  ('Shopee', 'Umum', 'Lainnya', 0.03);

-- Seed: Tier Ongkir Xtra Shopee default
INSERT OR IGNORE INTO ongkir_tiers (platform, tier_key, tier_label, tier_group, rate, cap_amount) VALUES
  ('Shopee', 'biasa_a', 'Ukuran Biasa - A', 'biasa', 0.01,  40000),
  ('Shopee', 'biasa_b', 'Ukuran Biasa - B', 'biasa', 0.02,  40000),
  ('Shopee', 'biasa_c', 'Ukuran Biasa - C', 'biasa', 0.035, 40000),
  ('Shopee', 'biasa_d', 'Ukuran Biasa - D', 'biasa', 0.055, 40000),
  ('Shopee', 'biasa_e', 'Ukuran Biasa - E', 'biasa', 0.06,  40000),
  ('Shopee', 'biasa_f', 'Ukuran Biasa - F', 'biasa', 0.065, 40000),
  ('Shopee', 'biasa_g', 'Ukuran Biasa - G', 'biasa', 0.075, 40000),
  ('Shopee', 'biasa_h', 'Ukuran Biasa - H', 'biasa', 0.08,  40000),
  ('Shopee', 'khusus_a', 'Ukuran Khusus - A', 'khusus', 0.025, 60000),
  ('Shopee', 'khusus_b', 'Ukuran Khusus - B', 'khusus', 0.035, 60000),
  ('Shopee', 'khusus_c', 'Ukuran Khusus - C', 'khusus', 0.05,  60000),
  ('Shopee', 'khusus_d', 'Ukuran Khusus - D', 'khusus', 0.07,  60000),
  ('Shopee', 'khusus_e', 'Ukuran Khusus - E', 'khusus', 0.075, 60000),
  ('Shopee', 'khusus_f', 'Ukuran Khusus - F', 'khusus', 0.08,  60000),
  ('Shopee', 'khusus_g', 'Ukuran Khusus - G', 'khusus', 0.09,  60000),
  ('Shopee', 'khusus_h', 'Ukuran Khusus - H', 'khusus', 0.095, 60000);
