const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { startServer } = require('./server/app');
const { exec } = require('child_process');

let overlayWindow;
let controlWindow;
let serverInstance;
let currentPort = 3000;

function createWindows() {
    const displays = screen.getAllDisplays();
    const externalDisplay = displays.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0);
    const targetDisplay = externalDisplay || screen.getPrimaryDisplay();
    const { x, y, width, height } = targetDisplay.bounds;

    overlayWindow = new BrowserWindow({
        x: x, y: y, width: width, height: height,
        transparent: true, frame: false, hasShadow: false, alwaysOnTop: true,
        enableLargerThanScreen: true, resizable: false, focusable: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    overlayWindow.setIgnoreMouseEvents(true);
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.setBounds({ x, y, width, height });
    overlayWindow.loadFile(path.join(__dirname, 'renderer/overlay.html'));

    controlWindow = new BrowserWindow({
        width: 1200, height: 800,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    controlWindow.maximize();
    controlWindow.loadFile(path.join(__dirname, 'renderer/control.html'));
    
    controlWindow.webContents.on('did-finish-load', () => controlWindow.webContents.send('port-updated', currentPort));
    overlayWindow.webContents.on('did-finish-load', () => overlayWindow.webContents.send('port-updated', currentPort));
    controlWindow.on('closed', () => app.quit());
}

function setupScreenListeners() {
    const updateOverlayBounds = () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
            const displays = screen.getAllDisplays();
            const externalDisplay = displays.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0);
            const targetDisplay = externalDisplay || screen.getPrimaryDisplay();
            const { x, y, width, height } = targetDisplay.bounds;
            overlayWindow.setBounds({ x, y, width, height });
        }
    };
    screen.on('display-metrics-changed', updateOverlayBounds);
    screen.on('display-added', updateOverlayBounds);
    screen.on('display-removed', updateOverlayBounds);
}

ipcMain.on('change-port', (event, newPort) => {
    if (serverInstance && serverInstance.io) {
        serverInstance.io.emit('force_disconnect');
        serverInstance.io.close(() => {
            if (serverInstance.server) serverInstance.server.close(() => startNewServer(newPort));
        });
    } else startNewServer(newPort);
});

// PowerPointノートの取得
ipcMain.handle('get-ppt-data', async () => {
    return new Promise((resolve) => {
        const script = `
            tell application "Microsoft PowerPoint"
                if not running then return "NOT_RUNNING"
                try
                    if (count of slide show windows) is 0 then return "NO_SHOW"
                    set currentIndex to current show position of slide show view of slide show window 1
                    set activePres to active presentation
                    set currentSlide to slide currentIndex of activePres
                    
                    set notesText to ""
                    try
                        -- 標準的なノートプレースホルダーから取得
                        set notesText to content of text range of text frame of place holder 2 of notes page of currentSlide
                    on error
                        -- 取得できない場合は全シェイプから検索
                        repeat with shp in shapes of notes page of currentSlide
                            if has text frame of shp then
                                set t to content of text range of text frame of shp
                                if length of t > 5 then
                                    set notesText to t
                                    exit repeat
                                end if
                            end if
                        end repeat
                    end try
                    
                    return (currentIndex as string) & "|||" & notesText
                on error errStr
                    return "ERROR: " & errStr
                end try
            end tell
        `;

        exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
            if (error) { resolve({ status: 'error', message: error.message }); return; }
            let result = stdout.trim();
            
            if (result === 'NOT_RUNNING') resolve({ status: 'not_running' });
            else if (result === 'NO_SHOW') resolve({ status: 'no_show' });
            else if (result.startsWith('ERROR')) resolve({ status: 'error', message: result });
            else {
                // Node.js側で改行を確実に正規化 (\r -> \n)
                result = result.replace(/\r/g, '\n');
                const parts = result.split('|||');
                resolve({
                    status: 'success', 
                    slideIndex: parts[0], 
                    notes: parts.length > 1 ? parts[1] : '' 
                });
            }
        });
    });
});

// PPT Navigation
ipcMain.handle('ppt-prev-slide', async () => {
    return new Promise((resolve) => {
        const script = `
            tell application "Microsoft PowerPoint"
                try
                    if (count of slide show windows) > 0 then
                        go to previous slide slide show view of slide show window 1
                        return "SUCCESS"
                    else
                        return "NO_SHOW"
                    end if
                on error errStr
                    return "ERROR: " & errStr
                end try
            end tell
        `;
        exec(`osascript -e '${script}'`, (error, stdout) => resolve(stdout.trim()));
    });
});

ipcMain.handle('ppt-next-slide', async () => {
    return new Promise((resolve) => {
        const script = `
            tell application "Microsoft PowerPoint"
                try
                    if (count of slide show windows) > 0 then
                        go to next slide slide show view of slide show window 1
                        return "SUCCESS"
                    else
                        return "NO_SHOW"
                    end if
                on error errStr
                    return "ERROR: " & errStr
                end try
            end tell
        `;
        exec(`osascript -e '${script}'`, (error, stdout) => resolve(stdout.trim()));
    });
});

function startNewServer(port) {
    try {
        currentPort = port;
        serverInstance = startServer(port);
        if (controlWindow) controlWindow.webContents.send('port-updated', port);
        if (overlayWindow) overlayWindow.webContents.send('port-updated', port);
    } catch (e) { console.error('Failed to start server:', e); }
}

app.whenReady().then(() => {
    startNewServer(currentPort);
    createWindows();
    setupScreenListeners();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
