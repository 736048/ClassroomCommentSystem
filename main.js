const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { startServer } = require('./server/app');

let overlayWindow;
let controlWindow;

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

    // Make it click-through
    overlayWindow.setIgnoreMouseEvents(true);

    // macOS specific: Ensure it stays on top of other full-screen apps if possible
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    
    // Load the overlay HTML
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

app.whenReady().then(() => {
    // Start Express/Socket.io Server
    startServer(3000);
    
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
