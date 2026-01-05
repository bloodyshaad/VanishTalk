import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// primitive electron APIs without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onMainMessage: (callback: (message: string) => void) => {
        ipcRenderer.on('main-process-message', (_event, value) => callback(value))
    },
})
