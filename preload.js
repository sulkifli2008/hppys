// =============================================
// HPPYS — Preload (Context Bridge)
// =============================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('win:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('win:maximize'),
  closeWindow:    () => ipcRenderer.invoke('win:close'),

  // Auth
  verifyPin:  (pin)          => ipcRenderer.invoke('auth:verify-pin', pin),
  changePin:  (old_, new_)   => ipcRenderer.invoke('auth:change-pin', old_, new_),

  // Rate Manager — Fee Rates
  getAllRates:     (platform)                   => ipcRenderer.invoke('rate:get-all', platform),
  updateFeeRate:  (platform, kategori, rate, note) => ipcRenderer.invoke('rate:update-fee', platform, kategori, rate, note),
  updateOngkir:   (platform, tierKey, rate, note)  => ipcRenderer.invoke('rate:update-ongkir', platform, tierKey, rate, note),
  importRateXlsx: ()                           => ipcRenderer.invoke('rate:import-xlsx'),
  exportRatesJson:(platform)                   => ipcRenderer.invoke('rate:export-json', platform),
  resetRateDefault:(platform)                  => ipcRenderer.invoke('rate:reset-default', platform),

  // Rate History
  getHistory:   (platform, limit) => ipcRenderer.invoke('history:get', platform, limit),
  clearHistory: (platform)        => ipcRenderer.invoke('history:clear', platform),

  // Tenant Manager
  getAllTenants:  ()       => ipcRenderer.invoke('tenant:get-all'),
  addTenant:     (data)   => ipcRenderer.invoke('tenant:add', data),
  updateTenant:  (id, d)  => ipcRenderer.invoke('tenant:update', id, d),
  deleteTenant:  (id)     => ipcRenderer.invoke('tenant:delete', id),

  // License
  generateLicense:   (tenantId) => ipcRenderer.invoke('license:generate', tenantId),
  revokeLicense:     (tenantId) => ipcRenderer.invoke('license:revoke', tenantId),
  activateLicense:   (tenantId) => ipcRenderer.invoke('license:activate', tenantId),
  exportLicenseFile: (tenantId) => ipcRenderer.invoke('license:export-file', tenantId),

  // Settings
  getSetting:    (key)        => ipcRenderer.invoke('settings:get', key),
  setSetting:    (key, value) => ipcRenderer.invoke('settings:set', key, value),
  getAllSettings: ()           => ipcRenderer.invoke('settings:get-all'),
  getDbInfo:     ()           => ipcRenderer.invoke('db:get-info'),

  // Shell
  openExternalUrl: (url) => ipcRenderer.invoke('shell:open-url', url),
});
