const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { startServer } = require('./server/app');

let overlayWindow;
let controlWindow;
let serverInstance;
let currentPort = 3000;

function createWindows() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x, y, width, height } = primaryDisplay.bounds;

    // 1. Comment Overlay Window
    overlayWindow = new BrowserWindow({
        x: x,
        y: y,
        width: width,
        height: height,
        transparent: true,
        frame: false,
        hasShadow: false,
        alwaysOnTop: true,
        enableLargerThanScreen: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    overlayWindow.setIgnoreMouseEvents(true);
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.loadFile(path.join(__dirname, 'renderer/overlay.html'));

    // 2. Control Panel Window
    controlWindow = new BrowserWindow({
        width: 400,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    controlWindow.loadFile(path.join(__dirname, 'renderer/control.html'));
    
    // Initial port send (after load)
    controlWindow.webContents.on('did-finish-load', () => {
        controlWindow.webContents.send('port-updated', currentPort);
    });
    
    // Also send to overlay
    overlayWindow.webContents.on('did-finish-load', () => {
        overlayWindow.webContents.send('port-updated', currentPort);
    });

    controlWindow.on('closed', () => {
        app.quit();
    });
}

// Screen resize handling
function setupScreenListeners() {
    const updateOverlayBounds = () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            const primaryDisplay = screen.getPrimaryDisplay();
            const { x, y, width, height } = primaryDisplay.bounds;
            overlayWindow.setBounds({ x, y, width, height });
        }
    };

    screen.on('display-metrics-changed', updateOverlayBounds);
    screen.on('display-added', updateOverlayBounds);
    screen.on('display-removed', updateOverlayBounds);
}

// IPC Handlers
ipcMain.on('change-port', (event, newPort) => {
    if (serverInstance) {
        console.log(`Closing server on port ${currentPort}...`);
        
        const closeServer = () => {
            if (serverInstance.server) {
                if (serverInstance.server.closeAllConnections) {
                    serverInstance.server.closeAllConnections();
                }
                serverInstance.server.close(() => {
                    console.log('Server closed.');
                    startNewServer(newPort);
                });
            } else {
                startNewServer(newPort);
            }
        };

        if (serverInstance.io) {
            // Notify clients to disconnect/reload
            serverInstance.io.emit('force_disconnect');
            
            // Give a tiny delay for the message to send? No, io.close might be fast. 
            // io.emit is async in nature but we can try just sending it.
            
            serverInstance.io.close(() => {
                closeServer();
            });
        } else {
            closeServer();
        }
    } else {
        startNewServer(newPort);
    }
});

function startNewServer(port) {
    try {
        currentPort = port;
        serverInstance = startServer(port);
        console.log(`Server started on port ${port}`);
        
        // Notify windows
        if (controlWindow) controlWindow.webContents.send('port-updated', port);
        if (overlayWindow) overlayWindow.webContents.send('port-updated', port);
        
    } catch (e) {
        console.error('Failed to start server:', e);
    }
}

app.whenReady().then(() => {
    // Start initial server
    startNewServer(currentPort);
    
    createWindows();
    setupScreenListeners();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindows();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});