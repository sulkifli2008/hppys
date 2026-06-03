// =============================================
// HPPYS — Renderer (Application Logic)
// HPP System Admin Panel
// =============================================

// ─── State ─────────────────────────────────
let allTenants = [];
let allRates = [];
let allOngkir = [];

// ─── Helpers ───────────────────────────────
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3500);
}

function formatPct(rate) {
  return (parseFloat(rate) * 100).toFixed(2) + '%';
}
function formatRp(n) {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function todayDate() {
  return new Date().toISOString().split('T')[0];
}
function formatDate(str) {
  if (!str) return '–';
  return new Date(str).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Navigation ────────────────────────────
function showPage(pageId, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
  if (el) el.classList.add('active');

  if (pageId === 'dashboard')  loadDashboard();
  if (pageId === 'rate-shopee') loadRateShopee();
  if (pageId === 'tenants')    loadTenants();
  if (pageId === 'licenses')   loadLicenses();
  if (pageId === 'history')    loadHistory();
  if (pageId === 'settings')   loadSettings();
}

// ─── Dashboard ─────────────────────────────
async function loadDashboard() {
  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  try {
    // Tenant stats
    const tRes = await window.api.getAllTenants();
    if (tRes.success) {
      allTenants = tRes.tenants;
      const active = allTenants.filter(t => t.status === 'active').length;
      const expired = allTenants.filter(t => t.status === 'expired').length;
      document.getElementById('statTotalTenant').textContent = allTenants.length;
      const activeBadge = document.getElementById('statTenantActive');
      activeBadge.textContent = `${active} aktif`;
      activeBadge.className = `stat-badge ${active === 0 ? 'danger' : ''}`;
      document.getElementById('statLicenseActive').textContent = active;
      const expBadge = document.getElementById('statLicenseExpireSoon');
      expBadge.textContent = expired > 0 ? `${expired} expired` : 'Semua ok';
      expBadge.className = `stat-badge ${expired > 0 ? 'danger' : ''}`;
    }

    // Rate stats
    const rRes = await window.api.getAllRates('Shopee');
    if (rRes.success) {
      document.getElementById('statShopeeCategories').textContent = rRes.rates.length;
    }

    // History stats
    const hRes = await window.api.getHistory('Shopee', 100);
    if (hRes.success) {
      document.getElementById('statHistoryCount').textContent = hRes.history.length;
    }

    // Render recent tenants
    renderDashTenants(allTenants.slice(0, 5));
    // Render recent history
    if (hRes.success) renderDashHistory(hRes.history.slice(0, 6));
  } catch (e) { console.error('Dashboard error:', e); }
}

function renderDashTenants(tenants) {
  const tbody = document.getElementById('dashTenantBody');
  if (!tbody) return;
  if (tenants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada tenant</td></tr>`;
    return;
  }
  tbody.innerHTML = tenants.map(t => `
    <tr>
      <td><strong>${t.nama_toko}</strong><br><span style="font-size:11px;color:var(--text-muted);">${t.email || '–'}</span></td>
      <td><span class="badge badge-${t.status}">${t.status}</span></td>
      <td>${formatDate(t.mulai_sewa)}</td>
      <td>${formatDate(t.expired_sewa)}</td>
      <td><code style="font-size:11px;color:var(--accent);">${t.license_key || '–'}</code></td>
    </tr>`).join('');
}

function renderDashHistory(history) {
  const tbody = document.getElementById('dashHistoryBody');
  if (!tbody) return;
  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">Belum ada perubahan tarif</td></tr>`;
    return;
  }
  tbody.innerHTML = history.map(h => {
    const diff = h.old_value !== null ? (h.new_value - h.old_value) : null;
    const diffStr = diff !== null ? `<span class="${diff > 0 ? 'history-change-up' : 'history-change-down'}">${diff > 0 ? '+' : ''}${(diff * 100).toFixed(2)}%</span>` : '–';
    return `<tr>
      <td style="font-size:11px;">${formatDate(h.changed_at)}</td>
      <td><span class="badge badge-shopee">${h.platform}</span></td>
      <td style="font-size:11px;color:var(--text-muted);">${h.table_name || '–'}</td>
      <td>${h.config_key}</td>
      <td style="color:var(--text-muted);">${h.old_value !== null ? formatPct(h.old_value) : '–'}</td>
      <td>${formatPct(h.new_value)}</td>
    </tr>`;
  }).join('');
}

// ─── Rate Manager — Shopee ─────────────────
async function loadRateShopee() {
  try {
    const res = await window.api.getAllRates('Shopee');
    if (res.success) {
      allRates = res.rates;
      allOngkir = res.ongkir;
      renderFeeRateTable(allRates);
      renderOngkirTable(allOngkir);
    }
  } catch (e) { showToast('Gagal memuat tarif', 'error'); }
}

function renderFeeRateTable(rates) {
  const tbody = document.getElementById('feeRateTableBody');
  if (!tbody) return;
  if (rates.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px;">Tidak ada data</td></tr>`;
    return;
  }
  let currentGroup = null;
  let html = '';
  let i = 0;
  rates.forEach(r => {
    const group = r.parent_kategori || 'Umum';
    if (group !== currentGroup) {
      html += `<tr><td colspan="6" class="rate-row-group">${group}</td></tr>`;
      currentGroup = group;
    }
    i++;
    html += `<tr>
      <td style="color:var(--text-muted);font-size:11px;">${i}</td>
      <td style="color:var(--text-muted);">${r.parent_kategori || '–'}</td>
      <td><strong>${r.kategori}</strong></td>
      <td>
        <input class="td-input" type="number" value="${(r.rate * 100).toFixed(2)}" step="0.01" min="0" max="100"
          data-kategori="${r.kategori}" data-platform="${r.platform}"
          onchange="updateFeeRate(this)" onkeydown="if(event.key==='Enter')this.blur()">
      </td>
      <td style="color:var(--text-muted);font-size:12px;">${r.rate}</td>
      <td style="font-size:11px;color:var(--text-muted);">${formatDate(r.updated_at)}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function renderOngkirTable(tiers) {
  const tbody = document.getElementById('ongkirTableBody');
  if (!tbody) return;
  tbody.innerHTML = tiers.map((t, i) => `
    <tr>
      <td style="color:var(--text-muted);font-size:11px;">${i + 1}</td>
      <td><code style="font-size:11px;color:var(--accent);">${t.tier_key}</code></td>
      <td>${t.tier_label || '–'}</td>
      <td><span class="badge ${t.tier_group === 'khusus' ? 'badge-shopee' : ''}">${t.tier_group}</span></td>
      <td>
        <input class="td-input" type="number" value="${(t.rate * 100).toFixed(2)}" step="0.01" min="0" max="100"
          data-tierkey="${t.tier_key}" data-platform="${t.platform}"
          onchange="updateOngkirRate(this)" onkeydown="if(event.key==='Enter')this.blur()">
      </td>
      <td style="color:var(--text-muted);font-size:12px;">${t.rate}</td>
      <td>${formatRp(t.cap_amount)}</td>
      <td style="font-size:11px;color:var(--text-muted);">${formatDate(t.updated_at)}</td>
    </tr>`).join('');
}

function filterRateTable() {
  const q = document.getElementById('searchCategory').value.toLowerCase();
  const filtered = allRates.filter(r =>
    r.kategori.toLowerCase().includes(q) ||
    (r.parent_kategori || '').toLowerCase().includes(q)
  );
  renderFeeRateTable(filtered);
}

async function updateFeeRate(input) {
  const pct = parseFloat(input.value);
  if (isNaN(pct)) return;
  const rate = pct / 100;
  const kategori = input.dataset.kategori;
  const platform = input.dataset.platform || 'Shopee';
  const res = await window.api.updateFeeRate(platform, kategori, rate, 'Edit manual via HPPYS');
  if (res.success) {
    showToast(`✅ ${kategori}: ${formatPct(rate)}`, 'success');
    // Update local state
    const idx = allRates.findIndex(r => r.kategori === kategori);
    if (idx >= 0) allRates[idx].rate = rate;
  } else {
    showToast('❌ Gagal update: ' + res.error, 'error');
  }
}

async function updateOngkirRate(input) {
  const pct = parseFloat(input.value);
  if (isNaN(pct)) return;
  const rate = pct / 100;
  const tierKey = input.dataset.tierkey;
  const platform = input.dataset.platform || 'Shopee';
  const res = await window.api.updateOngkir(platform, tierKey, rate, 'Edit manual via HPPYS');
  if (res.success) {
    showToast(`✅ ${tierKey}: ${formatPct(rate)}`, 'success');
  } else {
    showToast('❌ Gagal update: ' + res.error, 'error');
  }
}

function switchRateTab(tab) {
  document.getElementById('ratePanelFee').style.display = tab === 'fee' ? 'block' : 'none';
  document.getElementById('ratePanelOngkir').style.display = tab === 'ongkir' ? 'block' : 'none';
  document.getElementById('tabFeeBtn').classList.toggle('active', tab === 'fee');
  document.getElementById('tabOngkirBtn').classList.toggle('active', tab === 'ongkir');
}

async function importShopeeXlsx() {
  const res = await window.api.importRateXlsx();
  if (res.success) {
    showToast(`✅ Import berhasil: ${res.importedFee} fee + ${res.importedOngkir} ongkir`, 'success');
    loadRateShopee();
  } else if (!res.canceled) {
    showToast('❌ Gagal import: ' + res.error, 'error');
  }
}

async function exportShopeeJson() {
  const res = await window.api.exportRatesJson('Shopee');
  if (res.success) {
    showToast(`✅ File tarif disimpan: ${res.filePath.split('/').pop()}`, 'success');
  } else if (!res.canceled) {
    showToast('❌ Gagal export: ' + res.error, 'error');
  }
}

function confirmResetRates() {
  openConfirm(
    '🔄 Reset Tarif ke Default',
    'Semua tarif akan direset ke nilai bawaan aplikasi. Perubahan manual akan hilang. Lanjutkan?',
    async () => {
      const res = await window.api.resetRateDefault('Shopee');
      if (res.success) { showToast('Tarif direset ke default', 'info'); loadRateShopee(); }
      else showToast('❌ ' + res.error, 'error');
    }
  );
}

// ─── Tenant Manager ─────────────────────────
async function loadTenants() {
  const res = await window.api.getAllTenants();
  if (res.success) { allTenants = res.tenants; renderTenants(allTenants); }
}

function renderTenants(tenants) {
  const el = document.getElementById('tenantList');
  if (!el) return;
  if (tenants.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>Belum ada tenant</p></div>`;
    return;
  }
  el.innerHTML = tenants.map(t => `
    <div class="tenant-card">
      <div class="tenant-avatar">${t.nama_toko.charAt(0).toUpperCase()}</div>
      <div class="tenant-info">
        <div class="tenant-name">${t.nama_toko}</div>
        <div class="tenant-meta">
          ${t.nama_pemilik ? t.nama_pemilik + ' • ' : ''}
          ${t.email || ''} ${t.no_hp ? '• ' + t.no_hp : ''}
        </div>
        <div style="margin-top:4px;display:flex;gap:6px;align-items:center;">
          <span class="badge badge-${t.status}">${t.status}</span>
          ${t.expired_sewa ? `<span style="font-size:11px;color:var(--text-muted);">Expired: ${formatDate(t.expired_sewa)}</span>` : ''}
        </div>
      </div>
      <div class="tenant-actions">
        <button class="btn btn-sm btn-outline" onclick="editTenant(${t.id})">✏️ Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTenantConfirm(${t.id}, '${t.nama_toko.replace(/'/g, "\\'")}')">🗑️</button>
      </div>
    </div>`).join('');
}

function filterTenants() {
  const q = document.getElementById('searchTenant').value.toLowerCase();
  const status = document.getElementById('filterStatus').value;
  const filtered = allTenants.filter(t =>
    (t.nama_toko.toLowerCase().includes(q) || (t.email || '').toLowerCase().includes(q)) &&
    (status === '' || t.status === status)
  );
  renderTenants(filtered);
}

function openTenantModal(tenant = null) {
  document.getElementById('tenantModal').style.display = 'flex';
  document.getElementById('tenantModalTitle').textContent = tenant ? 'Edit Tenant' : 'Tambah Tenant';
  document.getElementById('tenantId').value = tenant?.id || '';
  document.getElementById('tenantNamaToko').value = tenant?.nama_toko || '';
  document.getElementById('tenantNamaPemilik').value = tenant?.nama_pemilik || '';
  document.getElementById('tenantEmail').value = tenant?.email || '';
  document.getElementById('tenantHp').value = tenant?.no_hp || '';
  document.getElementById('tenantMulai').value = tenant?.mulai_sewa || todayDate();
  document.getElementById('tenantExpired').value = tenant?.expired_sewa || '';
  document.getElementById('tenantStatus').value = tenant?.status || 'active';
  document.getElementById('tenantCatatan').value = tenant?.catatan || '';
}

function closeTenantModal() {
  document.getElementById('tenantModal').style.display = 'none';
}

async function saveTenant() {
  const id = document.getElementById('tenantId').value;
  const data = {
    nama_toko:     document.getElementById('tenantNamaToko').value.trim(),
    nama_pemilik:  document.getElementById('tenantNamaPemilik').value.trim(),
    email:         document.getElementById('tenantEmail').value.trim(),
    no_hp:         document.getElementById('tenantHp').value.trim(),
    mulai_sewa:    document.getElementById('tenantMulai').value,
    expired_sewa:  document.getElementById('tenantExpired').value,
    status:        document.getElementById('tenantStatus').value,
    catatan:       document.getElementById('tenantCatatan').value.trim(),
  };
  if (!data.nama_toko) { showToast('Nama toko wajib diisi!', 'error'); return; }

  const res = id
    ? await window.api.updateTenant(parseInt(id), data)
    : await window.api.addTenant(data);

  if (res.success) {
    showToast(id ? '✅ Tenant diupdate!' : '✅ Tenant ditambahkan!', 'success');
    closeTenantModal();
    loadTenants();
  } else {
    showToast('❌ ' + res.error, 'error');
  }
}

async function editTenant(id) {
  const t = allTenants.find(t => t.id === id);
  if (t) openTenantModal(t);
}

function deleteTenantConfirm(id, name) {
  openConfirm('🗑️ Hapus Tenant', `Hapus tenant "${name}"? Tindakan ini tidak bisa dibatalkan.`, async () => {
    const res = await window.api.deleteTenant(id);
    if (res.success) { showToast('Tenant dihapus', 'info'); loadTenants(); }
    else showToast('❌ ' + res.error, 'error');
  });
}

// ─── License Manager ────────────────────────
async function loadLicenses() {
  const res = await window.api.getAllTenants();
  if (!res.success) return;
  const tbody = document.getElementById('licenseTableBody');
  if (!tbody) return;
  const tenants = res.tenants;
  if (tenants.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px;">Belum ada tenant</td></tr>`;
    return;
  }
  tbody.innerHTML = tenants.map(t => `
    <tr>
      <td><strong>${t.nama_toko}</strong></td>
      <td>
        ${t.license_key
          ? `<code class="license-key-display" style="font-size:12px;padding:4px 10px;">${t.license_key}</code>`
          : '<span style="color:var(--text-muted);">Belum ada</span>'}
      </td>
      <td><span class="badge badge-${t.status}">${t.status}</span></td>
      <td>${formatDate(t.expired_sewa)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-sm btn-success" onclick="generateLicense(${t.id})">🔑 Generate</button>
          ${t.license_key ? `<button class="btn btn-sm btn-outline" onclick="exportLicense(${t.id})">📤 Export</button>` : ''}
          ${t.status === 'active' && t.license_key
            ? `<button class="btn btn-sm btn-danger" onclick="revokeLicense(${t.id}, '${t.nama_toko.replace(/'/g, "\\'")}')">❌ Revoke</button>`
            : t.status === 'revoked'
            ? `<button class="btn btn-sm btn-warning" onclick="activateLicense(${t.id})">✅ Aktifkan</button>`
            : ''}
        </div>
      </td>
    </tr>`).join('');
}

async function generateLicense(tenantId) {
  const res = await window.api.generateLicense(tenantId);
  if (res.success) {
    showToast(`✅ License Key: ${res.license_key}`, 'success');
    loadLicenses();
  } else {
    showToast('❌ ' + res.error, 'error');
  }
}

async function exportLicense(tenantId) {
  const res = await window.api.exportLicenseFile(tenantId);
  if (res.success) {
    showToast(`✅ File lisensi disimpan: ${res.filePath.split('/').pop()}`, 'success');
  } else if (!res.canceled) {
    showToast('❌ ' + res.error, 'error');
  }
}

function revokeLicense(tenantId, name) {
  openConfirm('❌ Revoke Lisensi', `Cabut lisensi untuk "${name}"? Tenant tidak bisa lagi menggunakan fitur premium.`, async () => {
    const res = await window.api.revokeLicense(tenantId);
    if (res.success) { showToast('Lisensi dicabut', 'info'); loadLicenses(); }
    else showToast('❌ ' + res.error, 'error');
  });
}

async function activateLicense(tenantId) {
  const res = await window.api.activateLicense(tenantId);
  if (res.success) { showToast('✅ Lisensi diaktifkan kembali', 'success'); loadLicenses(); }
  else showToast('❌ ' + res.error, 'error');
}

// ─── History / Audit Log ────────────────────
async function loadHistory() {
  const platform = document.getElementById('historyPlatform')?.value || 'Shopee';
  const res = await window.api.getHistory(platform, 200);
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;
  if (!res.success || res.history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">Belum ada log perubahan</td></tr>`;
    return;
  }
  tbody.innerHTML = res.history.map(h => {
    const diff = h.old_value !== null ? (h.new_value - h.old_value) : null;
    const arrow = diff !== null
      ? `<span class="${diff > 0 ? 'history-change-up' : 'history-change-down'}">${diff > 0 ? '▲' : '▼'} ${Math.abs(diff * 100).toFixed(2)}%</span>`
      : '';
    return `<tr>
      <td style="font-size:11px;">${new Date(h.changed_at).toLocaleString('id-ID')}</td>
      <td><span class="badge badge-shopee">${h.platform}</span></td>
      <td style="font-size:11px;color:var(--text-muted);">${h.table_name || '–'}</td>
      <td>${h.config_key}</td>
      <td style="color:var(--text-muted);">${h.old_value !== null ? formatPct(h.old_value) : '–'}</td>
      <td>${formatPct(h.new_value)} ${arrow}</td>
      <td style="font-size:11px;color:var(--text-muted);">${h.note || '–'}</td>
    </tr>`;
  }).join('');
}

async function clearHistory() {
  openConfirm('🗑️ Hapus Semua Log', 'Semua riwayat perubahan tarif akan dihapus. Lanjutkan?', async () => {
    const platform = document.getElementById('historyPlatform')?.value || 'Shopee';
    await window.api.clearHistory(platform);
    showToast('Log perubahan dihapus', 'info');
    loadHistory();
  });
}

// ─── Settings ───────────────────────────────
async function loadSettings() {
  try {
    const info = await window.api.getDbInfo();
    document.getElementById('dbTenants').textContent = info.tenantCount;
    document.getElementById('dbFeeRates').textContent = info.feeCount;
    document.getElementById('dbHistory').textContent = info.historyCount;
    document.getElementById('dbSize').textContent = info.size ? (info.size / 1024).toFixed(1) + ' KB' : '–';
    document.getElementById('dbPath').textContent = info.path || '–';

    const prefix = await window.api.getSetting('license_prefix');
    if (prefix) document.getElementById('licensePrefix').value = prefix;
  } catch (e) { console.error(e); }
}

async function changePin() {
  const old_ = document.getElementById('pinOld').value;
  const new_ = document.getElementById('pinNew').value;
  const conf = document.getElementById('pinConfirm').value;
  const status = document.getElementById('pinStatus');

  if (new_ !== conf) { status.textContent = '❌ PIN baru tidak cocok'; status.style.color = 'var(--danger)'; return; }
  if (new_.length < 4) { status.textContent = '❌ PIN minimal 4 digit'; status.style.color = 'var(--danger)'; return; }

  const res = await window.api.changePin(old_, new_);
  if (res.success) {
    status.textContent = '✅ PIN berhasil diubah!'; status.style.color = 'var(--success)';
    document.getElementById('pinOld').value = '';
    document.getElementById('pinNew').value = '';
    document.getElementById('pinConfirm').value = '';
  } else {
    status.textContent = '❌ ' + res.error; status.style.color = 'var(--danger)';
  }
}

async function saveLicensePrefix() {
  const val = document.getElementById('licensePrefix').value.trim().toUpperCase();
  if (!val) { showToast('Prefix tidak boleh kosong', 'error'); return; }
  await window.api.setSetting('license_prefix', val);
  showToast(`✅ Prefix disimpan: ${val}`, 'success');
}

// ─── Confirm Modal ──────────────────────────
let _confirmCallback = null;

function openConfirm(title, message, callback) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  _confirmCallback = callback;
  document.getElementById('confirmOkBtn').onclick = async () => {
    closeConfirm();
    if (_confirmCallback) await _confirmCallback();
  };
  document.getElementById('confirmModal').style.display = 'flex';
}

function closeConfirm() {
  document.getElementById('confirmModal').style.display = 'none';
  _confirmCallback = null;
}

// ─── Init ───────────────────────────────────
async function startApp() {
  // Set today's date
  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  await loadDashboard();
}

startApp();
