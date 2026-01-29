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
const studentColorBlocks = document.querySelectorAll('.student-color-block');

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
const screenPreview = document.getElementById('screen-preview');
const screenSelector = document.getElementById('screen-selector');
const refreshScreensBtn = document.getElementById('refresh-screens-btn');
const screenPreviewContainer = document.getElementById('screen-preview-container');

const pptSyncToggle = document.getElementById('ppt-sync-toggle');
const pptStatus = document.getElementById('ppt-status');
const pptNotesDisplay = document.getElementById('ppt-notes-display');
const pptPrevBtn = document.getElementById('ppt-prev-btn');
const pptNextBtn = document.getElementById('ppt-next-btn');

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
let timerInterval = null;

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
        timerToggleBtn.textContent = '開始';
    } else {
        timerInterval = setInterval(() => { timerSeconds++; updateTimerDisplay(); }, 1000);
        isTimerRunning = true; timerToggleBtn.textContent = '停止';
    }
});

timerResetBtn.addEventListener('click', () => {
    clearInterval(timerInterval); isTimerRunning = false;
    timerSeconds = 0; updateTimerDisplay();
    timerToggleBtn.textContent = '開始';
});

// --- Desktop Capture ---
async function startCapture(sourceId = null) {
    try {
        console.log('Fetching screen sources via main process...');
        // メインプロセス経由で取得することで権限ポップアップを促す
        const sources = await ipcRenderer.invoke('get-screen-sources');
        
        if (!sources || sources.length === 0) {
            console.warn('No sources found');
            return;
        }

        screenSelector.innerHTML = '';
        sources.forEach((source) => {
            const option = document.createElement('option');
            option.value = source.id;
            if (source.display_id) {
                option.dataset.displayId = source.display_id;
            }
            option.text = source.name || `Source ${source.id}`;
            screenSelector.appendChild(option);
        });
        
        screenSelector.onchange = (e) => startCapture(e.target.value);

        let selectedId = sourceId;
        if (!selectedId) {
            const extScreen = sources.find(s => s.name.includes("2") || s.id.includes("screen:1"));
            const slideShow = sources.find(s => s.name.includes('Slide Show') || s.name.includes('スライドショー'));
            selectedId = extScreen ? extScreen.id : (slideShow ? slideShow.id : sources[0].id);
        }
        screenSelector.value = selectedId;

        console.log('Requesting stream for:', selectedId);
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: selectedId,
                    maxWidth: 1920,
                    maxHeight: 1080
                }
            }
        });
        
        if (screenPreview.srcObject) {
            screenPreview.srcObject.getTracks().forEach(track => track.stop());
        }
        
        screenPreview.srcObject = stream;
        
        // 即座に再生を試みる
        screenPreview.play().catch(e => {
            console.error('Initial play failed, retrying on metadata:', e);
        });

        screenPreview.onloadedmetadata = () => {
            screenPreview.play().catch(e => console.error('Play failed again:', e));
            const w = screenPreview.videoWidth; const h = screenPreview.videoHeight;
            if (w > 0 && h > 0) {
                screenPreviewContainer.style.aspectRatio = `${w} / ${h}`;
            }
            console.log(`Capture started: ${w}x${h}`);
        };
    } catch (e) { 
        console.error('Capture Error:', e);
        if (e.name === 'NotAllowedError' || e.message.includes('permission')) {
            alert('画面キャプチャの権限がありません。\n1. システム設定 > プライバシーとセキュリティ > 画面収録 を開く\n2. Electronまたはターミナルのスイッチを一度「オフ」にしてから「オン」にする\n3. アプリを完全に終了して再起動する');
        }
    }
}

refreshScreensBtn.addEventListener('click', () => startCapture());

// --- PPT Sync ---
pptSyncToggle.addEventListener('change', () => {
    if (pptSyncToggle.checked) {
        pptStatus.textContent = '同期中...';
        pptSyncInterval = setInterval(async () => {
            try {
                const result = await ipcRenderer.invoke('get-ppt-data');
                if (result.status === 'success') {
                    pptStatus.textContent = `スライド ${result.slideIndex}`;
                    const notes = (result.notes || '').split('__NEWLINE__').join('\n');
                    if (pptNotesDisplay.textContent !== notes) {
                         pptNotesDisplay.textContent = notes || '(ノートなし)';
                    }
                } else pptStatus.textContent = result.status;
            } catch(e) { pptStatus.textContent = 'エラー'; }
        }, 1500);
    } else {
        if (pptSyncInterval) clearInterval(pptSyncInterval);
        pptSyncInterval = null; pptStatus.textContent = '停止';
    }
});

pptPrevBtn.addEventListener('click', () => ipcRenderer.invoke('ppt-prev-slide'));
pptNextBtn.addEventListener('click', () => ipcRenderer.invoke('ppt-next-slide'));

// --- UI Logic ---
studentColorBlocks.forEach(block => {
    block.addEventListener('click', () => {
        studentColorBlocks.forEach(b => b.style.border = '1px solid #ccc');
        block.style.border = '3px solid #000';
        if (socket) socket.emit('set_student_color', block.dataset.color);
    });
});

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
        if (activeObjectId && socket) updateActiveObject({ color: currentShapeColor });
    });
});

clearFixedBtn.addEventListener('click', () => {
    if (socket) socket.emit('clear_fixed_comment');
    document.querySelectorAll('.preview-fixed-comment').forEach(el => el.remove());
});

// --- Sending & Shapes ---
function sendComment() {
    if (!socket) return;
    const text = input.value.trim(); if (!text) return;
    const data = { text, color: selectedTextColor, fontFamily: currentFontFamily, size: currentFontSize, isFixed: fixedCheckbox.checked, x: 50, y: 50 };
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
    el.dataset.id = data.id; el.textContent = data.text;
    Object.assign(el.style, { left: data.x + '%', top: data.y + '%' });
    el.addEventListener('mousedown', (e) => { setActiveObject(data.id); startDrag(e, el, 'move'); });
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

window.addEventListener('keydown', async (e) => {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const el = document.querySelector(`[data-id="${activeObjectId}"]`);
        if (el) {
            if (el.classList.contains('preview-shape')) { if (socket) socket.emit('delete_shape', activeObjectId); }
            else if (el.classList.contains('preview-fixed-comment')) { if (socket) socket.emit('delete_fixed_comment', activeObjectId); }
            el.remove(); activeObjectId = null;
        }
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { 
        await ipcRenderer.invoke('ppt-prev-slide'); 
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') { 
        if (e.key === ' ' && document.activeElement.tagName === 'BUTTON') return; // ボタン押下時はデフォルト動作優先
        await ipcRenderer.invoke('ppt-next-slide'); 
    }
});

function createShape(type) {
    if (!socket) return;
    const id = "shape-" + Date.now();
    let w = 10, h = 10; if (type === 'line') { w = 20; h = 1; }
    previewOverlay.appendChild(createPreviewShapeElement(id, type, 40, 40, w, h, currentShapeColor));
    setActiveObject(id);
    socket.emit('send_shape', { id, type, x: 40, y: 40, width: w, height: h, color: currentShapeColor });
}

function createPreviewShapeElement(id, type, x, y, w, h, color) {
    const el = document.createElement('div'); el.className = 'preview-shape'; el.dataset.id = id;
    const handle = document.createElement('div'); handle.className = 'resize-handle'; el.appendChild(handle);
    Object.assign(el.style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' });
    if (type === 'line') el.style.backgroundColor = color; else el.style.border = `3px solid ${color}`;
    if (type === 'circle') el.style.borderRadius = '50%';
    el.addEventListener('mousedown', (e) => { setActiveObject(id); if (e.target === handle) startDrag(e, el, 'resize'); else startDrag(e, el, 'move'); });
    return el;
}

function setActiveObject(id) {
    activeObjectId = id;
    document.querySelectorAll('.preview-shape, .preview-fixed-comment').forEach(el => el.classList.toggle('active', el.dataset.id === id));
}

function updateActiveObject(updates = {}) {
    const el = document.querySelector(`[data-id="${activeObjectId}"]`);
    if (!el) return;
    const x = parseFloat(el.style.left); const y = parseFloat(el.style.top);
    if (el.classList.contains('preview-fixed-comment')) {
        socket.emit('update_fixed_comment', { id: activeObjectId, x, y });
    } else {
        if (updates.color) {
            if (el.style.border === '' || el.style.border === 'none') el.style.backgroundColor = updates.color;
            else el.style.borderColor = updates.color;
        }
        const w = parseFloat(el.style.width); const h = parseFloat(el.style.height);
        const isLine = el.style.border === '' || el.style.border === 'none';
        socket.emit('update_shape', { id: activeObjectId, x, y, width: w, height: h, color: isLine ? el.style.backgroundColor : el.style.borderColor, type: isLine ? 'line' : (el.style.borderRadius === '50%' ? 'circle' : 'square') });
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
    
    // Start capture with a delay
    setTimeout(() => startCapture(), 1000);

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
input.addEventListener('keypress', (e) => e.key === 'Enter' && sendComment());

ngBtn.addEventListener('click', () => {
    if (!socket) return;
    const words = ngInput.value.split(',').map(w => w.trim()).filter(w => w);
    socket.emit('update_ng_words', words);
    const ngStatus = document.getElementById('ng-status');
    if (ngStatus) {
        ngStatus.textContent = '更新しました';
        setTimeout(() => { ngStatus.textContent = ''; }, 2000);
    }
});

// Initial startup
setTimeout(() => startCapture(), 1000);