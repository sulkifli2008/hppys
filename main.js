// =============================================
// HPPYS — Main Process (Electron)
// HPP System Admin Panel
// =============================================

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');

const { initDb, query, run, getDbPath, saveDb } = require('./db/db.js');

let mainWindow = null;

// ========== WINDOW ==========
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0d1117',
    show: false,
    titleBarStyle: 'hidden',
  });

  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(async () => {
  await initDb();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ========== WINDOW CONTROLS ==========
ipcMain.handle('win:minimize', () => mainWindow?.minimize());
ipcMain.handle('win:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('win:close', () => mainWindow?.close());

// ========== AUTH ==========
ipcMain.handle('auth:verify-pin', (_, pin) => {
  const rows = query(`SELECT value FROM app_settings WHERE key = 'admin_pin'`);
  const stored = rows[0]?.value || '123456';
  return pin === stored;
});

ipcMain.handle('auth:change-pin', (_, oldPin, newPin) => {
  const rows = query(`SELECT value FROM app_settings WHERE key = 'admin_pin'`);
  const stored = rows[0]?.value || '123456';
  if (oldPin !== stored) return { success: false, error: 'PIN lama salah' };
  run(`UPDATE app_settings SET value = ?, updated_at = datetime('now') WHERE key = 'admin_pin'`, [newPin]);
  return { success: true };
});

// ========== RATE MANAGER — FEE RATES ==========
ipcMain.handle('rate:get-all', (_, platform = 'Shopee') => {
  const rates = query(
    `SELECT * FROM fee_rates WHERE platform = ? ORDER BY parent_kategori, kategori`,
    [platform]
  );
  const ongkir = query(
    `SELECT * FROM ongkir_tiers WHERE platform = ? ORDER BY tier_group, tier_key`,
    [platform]
  );
  return { success: true, rates, ongkir };
});

ipcMain.handle('rate:update-fee', (_, platform, kategori, newRate, note = '') => {
  try {
    const old = query(
      `SELECT rate FROM fee_rates WHERE platform = ? AND kategori = ?`,
      [platform, kategori]
    );
    const oldRate = old[0]?.rate ?? null;

    run(
      `INSERT INTO fee_rates (platform, kategori, rate, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(platform, kategori) DO UPDATE SET rate = excluded.rate, updated_at = excluded.updated_at`,
      [platform, kategori, newRate]
    );

    // Log history
    run(
      `INSERT INTO rate_history (platform, table_name, config_key, old_value, new_value, note)
       VALUES (?, 'fee_rates', ?, ?, ?, ?)`,
      [platform, kategori, oldRate, newRate, note]
    );

    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('rate:update-ongkir', (_, platform, tierKey, newRate, note = '') => {
  try {
    const old = query(
      `SELECT rate FROM ongkir_tiers WHERE platform = ? AND tier_key = ?`,
      [platform, tierKey]
    );
    const oldRate = old[0]?.rate ?? null;

    run(
      `UPDATE ongkir_tiers SET rate = ?, updated_at = datetime('now')
       WHERE platform = ? AND tier_key = ?`,
      [newRate, platform, tierKey]
    );

    run(
      `INSERT INTO rate_history (platform, table_name, config_key, old_value, new_value, note)
       VALUES (?, 'ongkir_tiers', ?, ?, ?, ?)`,
      [platform, tierKey, oldRate, newRate, note]
    );

    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('rate:import-xlsx', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Pilih File XLSX Tarif Shopee',
    filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });
  if (result.canceled) return { success: false, canceled: true };

  try {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(result.filePaths[0]);

    let importedFee = 0, importedOngkir = 0;

    // Parse sheet pertama — cari kolom Kategori & Rate
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    rows.forEach(row => {
      const keys = Object.keys(row);
      const kategoriKey = keys.find(k => /kategori|category/i.test(k));
      const rateKey = keys.find(k => /biaya|rate|fee|persen|%/i.test(k));
      const parentKey = keys.find(k => /grup|group|parent/i.test(k));

      if (!kategoriKey || !rateKey) return;
      const kategori = String(row[kategoriKey]).trim();
      let rate = String(row[rateKey]).replace('%', '').trim();
      rate = parseFloat(rate);
      if (!kategori || isNaN(rate)) return;
      // Konversi: jika rate > 1, anggap persen
      if (rate > 1) rate = rate / 100;
      const parent = parentKey ? String(row[parentKey]).trim() : '';

      run(
        `INSERT INTO fee_rates (platform, parent_kategori, kategori, rate, updated_at)
         VALUES ('Shopee', ?, ?, ?, datetime('now'))
         ON CONFLICT(platform, kategori) DO UPDATE SET
           rate = excluded.rate, parent_kategori = excluded.parent_kategori, updated_at = excluded.updated_at`,
        [parent, kategori, rate]
      );

      run(
        `INSERT INTO rate_history (platform, table_name, config_key, new_value, note)
         VALUES ('Shopee', 'fee_rates', ?, ?, 'Import XLSX')`,
        [kategori, rate]
      );
      importedFee++;
    });

    // Coba parse sheet kedua untuk ongkir
    if (wb.SheetNames.length > 1) {
      const ws2 = wb.Sheets[wb.SheetNames[1]];
      const rows2 = XLSX.utils.sheet_to_json(ws2, { defval: '' });
      rows2.forEach(row => {
        const keys = Object.keys(row);
        const tierKey = keys.find(k => /tier|ukuran|size/i.test(k));
        const rateKey = keys.find(k => /biaya|rate|fee|persen|%/i.test(k));
        if (!tierKey || !rateKey) return;
        const tier = String(row[tierKey]).trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
        let rate = String(row[rateKey]).replace('%', '').trim();
        rate = parseFloat(rate);
        if (!tier || isNaN(rate)) return;
        if (rate > 1) rate = rate / 100;
        run(
          `UPDATE ongkir_tiers SET rate = ?, updated_at = datetime('now')
           WHERE platform = 'Shopee' AND tier_key = ?`,
          [rate, tier]
        );
        importedOngkir++;
      });
    }

    return { success: true, importedFee, importedOngkir };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('rate:export-json', async (_, platform = 'Shopee') => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Simpan File Tarif',
    defaultPath: `rates-${platform.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled) return { success: false, canceled: true };

  try {
    const rates = query(`SELECT * FROM fee_rates WHERE platform = ?`, [platform]);
    const ongkir = query(`SELECT * FROM ongkir_tiers WHERE platform = ?`, [platform]);
    const exportData = {
      platform,
      exported_at: new Date().toISOString(),
      fee_rates: rates,
      ongkir_tiers: ongkir,
    };
    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf8');
    return { success: true, filePath: result.filePath };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('rate:reset-default', (_, platform = 'Shopee') => {
  try {
    run(`DELETE FROM fee_rates WHERE platform = ?`, [platform]);
    run(`DELETE FROM ongkir_tiers WHERE platform = ?`, [platform]);
    // Re-run seed
    const { initDb } = require('./db/db.js');
    const sqlPath = path.join(__dirname, 'db/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const { getDb } = require('./db/db.js');
    getDb().run(sql);
    saveDb();
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ========== RATE HISTORY ==========
ipcMain.handle('history:get', (_, platform, limit = 100) => {
  const rows = query(
    `SELECT * FROM rate_history WHERE platform = ? ORDER BY changed_at DESC LIMIT ?`,
    [platform, limit]
  );
  return { success: true, history: rows };
});

ipcMain.handle('history:clear', (_, platform) => {
  run(`DELETE FROM rate_history WHERE platform = ?`, [platform]);
  return { success: true };
});

// ========== TENANT MANAGER ==========
ipcMain.handle('tenant:get-all', () => {
  const rows = query(`SELECT * FROM tenants ORDER BY created_at DESC`);
  return { success: true, tenants: rows };
});

ipcMain.handle('tenant:add', (_, data) => {
  try {
    const { nama_diri, nama_perusahaan, email, notifn1, notifn2,
            mulai_sewa, expired_sewa, tipe_lisensi, catatan } = data;
    run(
      `INSERT INTO tenants
         (nama_diri, nama_perusahaan, email, notifn1, notifn2,
          mulai_sewa, expired_sewa, tipe_lisensi, catatan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nama_diri || '', nama_perusahaan || '', email || '',
       notifn1 || '', notifn2 || '',
       mulai_sewa || '', expired_sewa || '',
       tipe_lisensi || 'demo', catatan || '']
    );
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('tenant:update', (_, id, data) => {
  try {
    const { nama_diri, nama_perusahaan, email, notifn1, notifn2,
            status, tipe_lisensi, mulai_sewa, expired_sewa, catatan } = data;
    run(
      `UPDATE tenants SET
         nama_diri = ?, nama_perusahaan = ?, email = ?,
         notifn1 = ?, notifn2 = ?,
         status = ?, tipe_lisensi = ?,
         mulai_sewa = ?, expired_sewa = ?, catatan = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
      [nama_diri || '', nama_perusahaan || '', email || '',
       notifn1 || '', notifn2 || '',
       status || 'active', tipe_lisensi || 'demo',
       mulai_sewa || '', expired_sewa || '', catatan || '', id]
    );
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// Cek status & sisa waktu lisensi per tenant
ipcMain.handle('license:get-status', (_, tenantId) => {
  const tenant = query(`SELECT * FROM tenants WHERE id = ?`, [tenantId])[0];
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' };
  const now = new Date();
  const expired = tenant.expired_sewa ? new Date(tenant.expired_sewa) : null;
  const mulai   = tenant.mulai_sewa   ? new Date(tenant.mulai_sewa)   : null;
  const diffMs  = expired ? expired - now : null;
  const diffDays = diffMs !== null ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : null;
  const totalDays = (expired && mulai) ? Math.ceil((expired - mulai) / (1000 * 60 * 60 * 24)) : null;
  const pctLeft   = (diffDays !== null && totalDays) ? Math.max(0, (diffDays / totalDays) * 100) : null;
  return {
    success: true,
    tenant,
    expired_date: tenant.expired_sewa,
    days_left: diffDays,
    total_days: totalDays,
    pct_left: pctLeft,
    is_expired: diffDays !== null ? diffDays <= 0 : false,
    is_demo: tenant.tipe_lisensi === 'demo',
    status: tenant.status,
  };
});

ipcMain.handle('tenant:delete', (_, id) => {
  try {
    run(`DELETE FROM tenants WHERE id = ?`, [id]);
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// ========== LICENSE MANAGER ==========
function generateLicenseKey(prefix = 'HPPYS') {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${seg()}-${seg()}-${seg()}-${seg()}`;
}

ipcMain.handle('license:generate', (_, tenantId) => {
  try {
    const prefixRow = query(`SELECT value FROM app_settings WHERE key = 'license_prefix'`);
    const prefix = prefixRow[0]?.value || 'HPPYS';
    const key = generateLicenseKey(prefix);
    run(`UPDATE tenants SET license_key = ?, updated_at = datetime('now') WHERE id = ?`, [key, tenantId]);
    return { success: true, license_key: key };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('license:revoke', (_, tenantId) => {
  try {
    run(
      `UPDATE tenants SET status = 'revoked', updated_at = datetime('now') WHERE id = ?`,
      [tenantId]
    );
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('license:activate', (_, tenantId) => {
  try {
    run(
      `UPDATE tenants SET status = 'active', updated_at = datetime('now') WHERE id = ?`,
      [tenantId]
    );
    return { success: true };
  } catch (e) { return { success: false, error: e.message }; }
});

// Export license as .license file untuk dikirim ke tenant
ipcMain.handle('license:export-file', async (_, tenantId) => {
  const tenant = query(`SELECT * FROM tenants WHERE id = ?`, [tenantId])[0];
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' };

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Simpan File Lisensi',
    defaultPath: `${(tenant.nama_toko || 'tenant').replace(/\s+/g, '-')}.license`,
    filters: [{ name: 'License File', extensions: ['license'] }],
  });
  if (result.canceled) return { success: false, canceled: true };

  const licenseData = {
    key: tenant.license_key,
    nama_toko: tenant.nama_toko,
    expired: tenant.expired_sewa,
    issued_at: new Date().toISOString(),
  };
  fs.writeFileSync(result.filePath, JSON.stringify(licenseData, null, 2));
  return { success: true, filePath: result.filePath };
});

// ========== SETTINGS ==========
ipcMain.handle('settings:get', (_, key) => {
  const rows = query(`SELECT value FROM app_settings WHERE key = ?`, [key]);
  return rows[0]?.value ?? null;
});

ipcMain.handle('settings:set', (_, key, value) => {
  run(
    `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value]
  );
  return { success: true };
});

ipcMain.handle('settings:get-all', () => {
  return query(`SELECT key, value FROM app_settings`);
});

ipcMain.handle('db:get-info', () => {
  const dbPath = getDbPath();
  let size = 0;
  try { size = fs.statSync(dbPath).size; } catch {}
  const tenantCount = query(`SELECT COUNT(*) as c FROM tenants`)[0]?.c ?? 0;
  const feeCount = query(`SELECT COUNT(*) as c FROM fee_rates`)[0]?.c ?? 0;
  const historyCount = query(`SELECT COUNT(*) as c FROM rate_history`)[0]?.c ?? 0;
  return { path: dbPath, size, tenantCount, feeCount, historyCount };
});

// ========== SHELL ==========
ipcMain.handle('shell:open-url', (_, url) => {
  shell.openExternal(url);
});
