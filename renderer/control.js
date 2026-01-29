const { networkInterfaces } = require('os');
const QRCode = require('qrcode');
const { ipcRenderer } = require('electron');
const io = require('socket.io-client');

let socket;
let currentUrl = '';
let currentQrDataUrl = '';

// --- DOM Elements ---
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const serverUrlHeader = document.getElementById('server-url-header');
const portInput = document.getElementById('port-input');
const changePortBtn = document.getElementById('change-port-btn');
const showQrBtn = document.getElementById('show-qr-btn');
const qrModal = document.getElementById('qr-modal');
const qrModalImg = document.getElementById('qr-modal-img');
const qrCloseBtn = document.getElementById('qr-close-btn');

const input = document.getElementById('teacher-input');
const sendBtn = document.getElementById('teacher-send');
const detailToggleBtn = document.getElementById('detail-toggle-btn');
const detailSettings = document.getElementById('detail-settings');

const btnFontSans = document.getElementById('btn-font-sans');
const btnFontSerif = document.getElementById('btn-font-serif');
const btnSizeNormal = document.getElementById('btn-size-normal');
const btnSizeLarge = document.getElementById('btn-size-large');
const textColorBlocks = document.querySelectorAll('.text-color');

const fixedCheckbox = document.getElementById('teacher-fixed');
const clearFixedBtn = document.getElementById('clear-fixed');

const ngInput = document.getElementById('ng-words');
const ngBtn = document.getElementById('update-ng');
const historyContainer = document.getElementById('comment-history');

const addCircleBtn = document.getElementById('add-circle');
const addSquareBtn = document.getElementById('add-square');
const addLineBtn = document.getElementById('add-line');
const shapeColorBlocks = document.querySelectorAll('.shape-color');
const clearShapesBtn = document.getElementById('clear-shapes');
const previewOverlay = document.getElementById('preview-overlay');

const pptSyncToggle = document.getElementById('ppt-sync-toggle');
const pptStatus = document.getElementById('ppt-status');
const pptNotesDisplay = document.getElementById('ppt-notes-display');
const timerDisplay = document.getElementById('timer-display');
const timerToggleBtn = document.getElementById('timer-toggle');
const timerResetBtn = document.getElementById('timer-reset');

// --- State ---
let selectedTextColor = '#ffffff';
let currentFontSize = 'normal';
let currentFontFamily = 'sans-serif';
let currentShapeColor = '#ff0000';
let activeObjectId = null; 
let isDragging = false;
let isResizing = false;
let dragStart = { x: 0, y: 0 };
let initialObjState = { left: 0, top: 0, width: 0, height: 0 };
let timerSeconds = 0;
let isTimerRunning = false;
let pptSyncInterval = null;

// --- Tab Logic ---
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

// --- QR Logic ---
showQrBtn.addEventListener('click', () => {
    if (currentQrDataUrl) {
        qrModalImg.src = currentQrDataUrl;
        qrModal.classList.add('active');
        if (socket) socket.emit('show_qr', currentQrDataUrl);
    }
});
qrCloseBtn.addEventListener('click', () => {
    qrModal.classList.remove('active');
    if (socket) socket.emit('hide_qr');
});

// --- Timer Logic ---
function updateTimerDisplay() {
    const h = Math.floor(timerSeconds / 3600);
    const m = Math.floor((timerSeconds % 3600) / 60);
    const s = timerSeconds % 60;
    timerDisplay.textContent = [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}
timerToggleBtn.addEventListener('click', () => {
    if (isTimerRunning) {
        clearInterval(timerInterval); isTimerRunning = false;
        timerToggleBtn.textContent = '開始'; timerToggleBtn.style.background = '#000';
    } else {
        timerInterval = setInterval(() => { timerSeconds++; updateTimerDisplay(); }, 1000);
        isTimerRunning = true; timerToggleBtn.textContent = '停止'; timerToggleBtn.style.background = '#d63384'; 
    }
});
timerResetBtn.addEventListener('click', () => {
    clearInterval(timerInterval); isTimerRunning = false;
    timerSeconds = 0; updateTimerDisplay();
    timerToggleBtn.textContent = '開始'; timerToggleBtn.style.background = '#000';
});

// --- PPT Sync ---
pptSyncToggle.addEventListener('change', () => {
    if (pptSyncToggle.checked) {
        pptStatus.textContent = '同期中...';
        pptSyncInterval = setInterval(async () => {
            try {
                const result = await ipcRenderer.invoke('get-ppt-notes');
                if (result.status === 'success') {
                    pptStatus.textContent = `スライド ${result.slideIndex}`;
                    pptNotesDisplay.textContent = result.notes || '(ノートなし)';
                } else pptStatus.textContent = result.status;
            } catch(e) { pptStatus.textContent = 'エラー'; }
        }, 1000);
    } else {
        if (pptSyncInterval) clearInterval(pptSyncInterval);
        pptSyncInterval = null; pptStatus.textContent = '停止';
    }
});

// --- UI Logic ---
detailToggleBtn.addEventListener('click', () => {
    detailSettings.classList.toggle('show');
    detailToggleBtn.textContent = detailSettings.classList.contains('show') ? '▲ 閉じる' : '▼ 詳細設定';
});
textColorBlocks.forEach(block => {
    block.addEventListener('click', () => {
        textColorBlocks.forEach(b => b.classList.remove('selected'));
        block.classList.add('selected'); selectedTextColor = block.dataset.color;
    });
});
btnFontSans.addEventListener('click', () => { currentFontFamily = 'sans-serif'; btnFontSans.classList.add('selected'); btnFontSerif.classList.remove('selected'); });
btnFontSerif.addEventListener('click', () => { currentFontFamily = 'serif'; btnFontSerif.classList.add('selected'); btnFontSans.classList.remove('selected'); });
btnSizeNormal.addEventListener('click', () => { currentFontSize = 'normal'; btnSizeNormal.classList.add('selected'); btnSizeLarge.classList.remove('selected'); });
btnSizeLarge.addEventListener('click', () => { currentFontSize = 'large'; btnSizeLarge.classList.add('selected'); btnSizeNormal.classList.remove('selected'); });
shapeColorBlocks.forEach(block => {
    block.addEventListener('click', () => {
        shapeColorBlocks.forEach(b => b.classList.remove('selected'));
        block.classList.add('selected'); currentShapeColor = block.dataset.color;
        if (activeObjectId && socket) {
            const el = document.querySelector(`[data-id="${activeObjectId}"]`);
            if (el && el.classList.contains('preview-shape')) updateActiveObject({ color: currentShapeColor });
        }
    });
});

clearFixedBtn.addEventListener('click', () => {
    if (socket) socket.emit('clear_fixed_comment');
    document.querySelectorAll('.preview-fixed-comment').forEach(el => el.remove());
});

// --- Sending & Shapes ---

function sendComment() {
    if (!socket) {
        console.error('Socket not initialized');
        return;
    }
    const text = input.value.trim();
    if (!text) return;
    
    // Default initial position for fixed comments: Center (50, 50)
    const data = { 
        text, 
        color: selectedTextColor, 
        fontFamily: currentFontFamily, 
        size: currentFontSize, 
        isFixed: fixedCheckbox.checked, 
        x: 50, 
        y: 50 
    };

    if (data.isFixed) {
        data.id = "fixed-" + Date.now();
        previewOverlay.appendChild(createPreviewFixedElement(data));
        setActiveObject(data.id);
    }
    
    socket.emit('send_comment', data);
    input.value = '';
}

function createPreviewFixedElement(data) {
    const el = document.createElement('div');
    el.className = 'preview-fixed-comment';
    el.dataset.id = data.id;
    el.textContent = data.text;
    Object.assign(el.style, { left: data.x + '%', top: data.y + '%' });
    el.addEventListener('mousedown', (e) => {
        setActiveObject(data.id);
        startDrag(e, el, 'move');
    });
    return el;
}

addCircleBtn.addEventListener('click', () => createShape('circle'));
addSquareBtn.addEventListener('click', () => createShape('square'));
addLineBtn.addEventListener('click', () => createShape('line'));
clearShapesBtn.addEventListener('click', () => { 
    if (socket) socket.emit('clear_shapes'); 
    previewOverlay.querySelectorAll('.preview-shape').forEach(el => el.remove());
    activeObjectId = null; 
});

window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && activeObjectId && document.activeElement.tagName !== 'INPUT') {
        const el = document.querySelector(`[data-id="${activeObjectId}"]`);
        if (el) {
            if (el.classList.contains('preview-shape')) {
                if (socket) socket.emit('delete_shape', activeObjectId);
            } else if (el.classList.contains('preview-fixed-comment')) {
                if (socket) socket.emit('delete_fixed_comment', activeObjectId);
            }
            el.remove(); activeObjectId = null;
        }
    }
});

function createShape(type) {
    if (!socket) return;
    const id = "shape-" + Date.now();
    let w = 10, h = 10;
    if (type === 'line') { w = 20; h = 1; }
    previewOverlay.appendChild(createPreviewShapeElement(id, type, 40, 40, w, h, currentShapeColor));
    setActiveObject(id);
    socket.emit('send_shape', { id, type, x: 40, y: 40, width: w, height: h, color: currentShapeColor });
}

function createPreviewShapeElement(id, type, x, y, w, h, color) {
    const el = document.createElement('div'); el.className = 'preview-shape'; el.dataset.id = id;
    const handle = document.createElement('div'); handle.className = 'resize-handle'; el.appendChild(handle);
    Object.assign(el.style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' });
    if (type === 'line') el.style.backgroundColor = color;
    else el.style.border = `3px solid ${color}`;
    if (type === 'circle') el.style.borderRadius = '50%';
    el.addEventListener('mousedown', (e) => {
        setActiveObject(id);
        if (e.target === handle) startDrag(e, el, 'resize');
        else startDrag(e, el, 'move');
    });
    return el;
}

function setActiveObject(id) {
    activeObjectId = id;
    document.querySelectorAll('.preview-shape, .preview-fixed-comment').forEach(el => el.classList.toggle('active', el.dataset.id === id));
}

function updateActiveObject(updates = {}) {
    const el = document.querySelector(`[data-id="${activeObjectId}"]`);
    if (!el) return;
    
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);

    if (el.classList.contains('preview-fixed-comment')) {
        socket.emit('update_fixed_comment', { id: activeObjectId, x, y });
    } else {
        if (updates.color) {
            if (el.style.border === '' || el.style.border === 'none') el.style.backgroundColor = updates.color;
            else el.style.borderColor = updates.color;
        }
        const w = parseFloat(el.style.width);
        const h = parseFloat(el.style.height);
        const isLine = el.style.border === '' || el.style.border === 'none';
        socket.emit('update_shape', {
            id: activeObjectId, x, y, width: w, height: h,
            color: isLine ? el.style.backgroundColor : el.style.borderColor,
            type: isLine ? 'line' : (el.style.borderRadius === '50%' ? 'circle' : 'square')
        });
    }
}

function startDrag(e, el, mode) {
    e.preventDefault(); e.stopPropagation();
    dragStart = { x: e.clientX, y: e.clientY };
    initialObjState = { left: parseFloat(el.style.left), top: parseFloat(el.style.top), width: parseFloat(el.style.width), height: parseFloat(el.style.height) };
    const rect = previewOverlay.getBoundingClientRect();
    const onMove = (me) => {
        const dx = ((me.clientX - dragStart.x) / rect.width) * 100;
        const dy = ((me.clientY - dragStart.y) / rect.height) * 100;
        if (mode === 'move') { el.style.left = (initialObjState.left + dx) + '%'; el.style.top = (initialObjState.top + dy) + '%'; }
        else { el.style.width = Math.max(0.5, initialObjState.width + dx) + '%'; el.style.height = Math.max(0.5, initialObjState.height + dy) + '%'; }
        updateActiveObject();
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
}

// --- Connection ---
function setupSocket(port) {
    if (socket) { socket.disconnect(); socket.removeAllListeners(); }
    const nets = networkInterfaces(); let ip = 'localhost';
    for (const n of Object.keys(nets)) { for (const net of nets[n]) { if (net.family === 'IPv4' && !net.internal) { ip = net.address; break; } } }
    currentUrl = `http://${ip}:${port}`; serverUrlHeader.textContent = currentUrl; portInput.value = port;
    QRCode.toDataURL(currentUrl, { errorCorrectionLevel: 'H' }, (err, url) => { currentQrDataUrl = url; });
    socket = io(`http://localhost:${port}`);
    socket.on('new_comment', (data) => {
        const div = document.createElement('div'); div.className = 'history-item';
        const time = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        div.innerHTML = `<div style="color:#888; font-size:0.7em;">${time}</div><div>${data.isFixed?'[固定] ':''}<span style="color:${data.color||'black'}; text-shadow:0 0 1px #000;">■</span> <span style="${data.fontFamily==='serif'?'font-family:serif;':''}">${data.text}</span></div>`;
        historyContainer.prepend(div);
    });
}
changePortBtn.addEventListener('click', () => ipcRenderer.send('change-port', parseInt(portInput.value)));
ipcRenderer.on('port-updated', (e, p) => setupSocket(p));
sendBtn.addEventListener('click', sendComment);
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendComment();
});
