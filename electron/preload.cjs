// ══════════════════════════════════════
// SuperDS Preload Script
// Minimal — app uses HTTP/WS to backend
// ══════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('superds', {
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
  // Native folder picker — opens OS directory dialog
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
})
