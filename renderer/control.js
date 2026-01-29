const { networkInterfaces } = require('os');
const QRCode = require('qrcode');
const { ipcRenderer, desktopCapturer } = require('electron');
const io = require('socket.io-client');

let socket;
let currentUrl = '';

// DOM Elements
const serverUrlHeader = document.getElementById('server-url-header');
const qrImg = document.getElementById('qr-code');
const portInput = document.getElementById('port-input');
const changePortBtn = document.getElementById('change-port-btn');

const input = document.getElementById('teacher-input');
const sendBtn = document.getElementById('teacher-send');

// Details Toggle
const detailToggleBtn = document.getElementById('detail-toggle-btn');
const detailSettings = document.getElementById('detail-settings');

// Font/Size/Color/Fixed
const btnFontSans = document.getElementById('btn-font-sans');
const btnFontSerif = document.getElementById('btn-font-serif');
const btnSizeNormal = document.getElementById('btn-size-normal');
const btnSizeLarge = document.getElementById('btn-size-large');
const textColorBlocks = document.querySelectorAll('.text-color');

const fixedCheckbox = document.getElementById('teacher-fixed');
const clearFixedBtn = document.getElementById('clear-fixed');
const fixedPosContainer = document.getElementById('fixed-pos-container');
const fixedPosSlider = document.getElementById('fixed-pos');
const posVal = document.getElementById('pos-val');

// Shape Palette
const addCircleBtn = document.getElementById('add-circle');
const addSquareBtn = document.getElementById('add-square');
const shapeColorBlocks = document.querySelectorAll('.shape-color');
const clearShapesBtn = document.getElementById('clear-shapes');
const screenPreview = document.getElementById('screen-preview');
const screenPreviewContainer = document.getElementById('screen-preview-container');
const previewOverlay = document.getElementById('preview-overlay');

// Other
const ngInput = document.getElementById('ng-words');
const ngBtn = document.getElementById('update-ng');
const ngStatus = document.getElementById('ng-status');
const historyContainer = document.getElementById('comment-history');


// Initial State
let selectedTextColor = '#ffffff';
let currentFontSize = 'normal';
let currentFontFamily = 'sans-serif';
let currentShapeColor = '#ff0000'; // Default shape color

// Active Shape State
let activeShapeId = null;
let isDragging = false;
let isResizing = false;
let dragStart = { x: 0, y: 0 };
let initialShapeState = { left: 0, top: 0, width: 0, height: 0 };

// --- UI Logic ---

// Toggle Details
detailToggleBtn.addEventListener('click', () => {
    detailSettings.classList.toggle('show');
    if (detailSettings.classList.contains('show')) {
        detailToggleBtn.textContent = '▲ 詳細設定を隠す';
    } else {
        detailToggleBtn.textContent = '▼ 詳細設定を表示';
    }
});

// Text Color Selection (Independent)
textColorBlocks.forEach(block => {
    block.addEventListener('click', () => {
        textColorBlocks.forEach(b => b.classList.remove('selected'));
        block.classList.add('selected');
        selectedTextColor = block.dataset.color;
    });
});

// Font Family
btnFontSans.addEventListener('click', () => {
    currentFontFamily = 'sans-serif';
    btnFontSans.classList.add('selected');
    btnFontSerif.classList.remove('selected');
});
btnFontSerif.addEventListener('click', () => {
    currentFontFamily = 'serif';
    btnFontSerif.classList.add('selected');
    btnFontSans.classList.remove('selected');
});

// Font Size
btnSizeNormal.addEventListener('click', () => {
    currentFontSize = 'normal';
    btnSizeNormal.classList.add('selected');
    btnSizeLarge.classList.remove('selected');
});
btnSizeLarge.addEventListener('click', () => {
    currentFontSize = 'large';
    btnSizeLarge.classList.add('selected');
    btnSizeNormal.classList.remove('selected');
});

// Shape Color Selection (Independent & Revived)
shapeColorBlocks.forEach(block => {
    block.addEventListener('click', () => {
        shapeColorBlocks.forEach(b => b.classList.remove('selected'));
        block.classList.add('selected');
        currentShapeColor = block.dataset.color;
        
        // Update active shape immediately if one is selected
        if (activeShapeId && socket) {
            updateActiveShape({ color: currentShapeColor });
        }
    });
});

// Fixed Comment
fixedCheckbox.addEventListener('change', () => {
    fixedPosContainer.style.display = fixedCheckbox.checked ? 'block' : 'none';
});

fixedPosSlider.addEventListener('input', () => {
    const val = fixedPosSlider.value;
    posVal.textContent = val + '%';
    if (socket) socket.emit('update_fixed_position', val);
});

clearFixedBtn.addEventListener('click', () => {
    if(socket) socket.emit('clear_fixed_comment');
});

// Sending
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendComment();
});
sendBtn.addEventListener('click', sendComment);

// NG Words
ngBtn.addEventListener('click', () => {
    if(!socket) return;
    const words = ngInput.value.split(',').map(w => w.trim()).filter(w => w);
    socket.emit('update_ng_words', words);
    ngStatus.textContent = 'OK';
    setTimeout(() => { ngStatus.textContent = ''; }, 2000);
});

// Port
changePortBtn.addEventListener('click', () => {
    const newPort = parseInt(portInput.value, 10);
    if (newPort > 0 && newPort < 65536) {
        ipcRenderer.send('change-port', newPort);
    } else {
        alert('無効なポート番号');
    }
});


// --- Shape Logic (PowerPoint Style) ---

addCircleBtn.addEventListener('click', () => createShape('circle'));
addSquareBtn.addEventListener('click', () => createShape('square'));

clearShapesBtn.addEventListener('click', () => {
    if (socket) socket.emit('clear_shapes');
    previewOverlay.innerHTML = ''; 
    activeShapeId = null;
});

function createShape(type) {
    if (!socket) return;
    const id = Date.now().toString(); 
    const defaultW = 10;
    const defaultH = 10;
    
    // Create with CURRENT Shape Color
    const shapeEl = createPreviewElement(id, type, 40, 40, defaultW, defaultH, currentShapeColor);
    previewOverlay.appendChild(shapeEl);
    setActiveShape(id);
    
    socket.emit('send_shape', {
        id: id, type: type, x: 40, y: 40, width: defaultW, height: defaultH, color: currentShapeColor
    });
}

function createPreviewElement(id, type, x, y, w, h, color) {
    const el = document.createElement('div');
    el.className = 'preview-shape';
    el.dataset.id = id;
    
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    el.appendChild(handle);

    el.style.left = x + '%';
    el.style.top = y + '%';
    el.style.width = w + '%';
    el.style.height = h + '%';
    el.style.border = `3px solid ${color}`;
    
    if (type === 'circle') el.style.borderRadius = '50%';

    el.addEventListener('mousedown', (e) => {
        setActiveShape(id);
        if (e.target === handle) {
            startDrag(e, el, 'resize');
        } else {
            startDrag(e, el, 'move');
        }
    });
    return el;
}

function setActiveShape(id) {
    activeShapeId = id;
    document.querySelectorAll('.preview-shape').forEach(el => {
        if (el.dataset.id === id) el.classList.add('active');
        else el.classList.remove('active');
    });
}

function updateActiveShape(updates) {
    const el = document.querySelector(`.preview-shape[data-id="${activeShapeId}"]`);
    if (!el) return;
    if (updates.color) el.style.borderColor = updates.color;
    
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    const w = parseFloat(el.style.width);
    const h = parseFloat(el.style.height);
    const col = el.style.borderColor;
    const type = el.style.borderRadius === '50%' ? 'circle' : 'square';
    
    socket.emit('update_shape', {
        id: activeShapeId, type: type, x: x, y: y, width: w, height: h, color: col
    });
}

function startDrag(e, el, mode) {
    e.preventDefault(); e.stopPropagation();
    if (mode === 'resize') isResizing = true;
    else isDragging = true;

    dragStart = { x: e.clientX, y: e.clientY };
    initialShapeState = {
        left: parseFloat(el.style.left), top: parseFloat(el.style.top),
        width: parseFloat(el.style.width), height: parseFloat(el.style.height)
    };
    
    const parentRect = previewOverlay.getBoundingClientRect();
    
    const onMove = (moveEvent) => {
        const dxPx = moveEvent.clientX - dragStart.x;
        const dyPx = moveEvent.clientY - dragStart.y;
        const dxP = (dxPx / parentRect.width) * 100;
        const dyP = (dyPx / parentRect.height) * 100;
        
        if (isDragging) {
            el.style.left = (initialShapeState.left + dxP) + '%';
            el.style.top = (initialShapeState.top + dyP) + '%';
        } else if (isResizing) {
            el.style.width = Math.max(1, initialShapeState.width + dxP) + '%';
            el.style.height = Math.max(1, initialShapeState.height + dyP) + '%';
        }
        
        socket.emit('update_shape', {
            id: activeShapeId,
            x: parseFloat(el.style.left), y: parseFloat(el.style.top),
            width: parseFloat(el.style.width), height: parseFloat(el.style.height),
            color: el.style.borderColor,
            type: el.style.borderRadius === '50%' ? 'circle' : 'square'
        });
    };
    
    const onUp = () => {
        isDragging = false; isResizing = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}


// --- Desktop Capture & Ratio Sync ---
async function startCapture() {
    try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sources[0].id,
                    maxWidth: 1920, maxHeight: 1080 
                }
            }
        });
        
        screenPreview.srcObject = stream;
        
        screenPreview.onloadedmetadata = () => {
            const w = screenPreview.videoWidth;
            const h = screenPreview.videoHeight;
            screenPreviewContainer.style.aspectRatio = `${w} / ${h}`;
        };
        
    } catch (e) {
        console.error('Error capturing screen:', e);
    }
}
startCapture();


// --- Standard Functions ---

function sendComment() {
    if (!socket) return;
    const text = input.value;
    if(!text) return;
    
    socket.emit('send_comment', {
        text: text,
        color: selectedTextColor,
        fontFamily: currentFontFamily,
        size: currentFontSize,
        isFixed: fixedCheckbox.checked,
        position: fixedPosSlider.value
    });
    input.value = '';
}

function getLocalIP() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

function setupSocket(port) {
    if (socket) { socket.disconnect(); socket.removeAllListeners(); }

    const ip = getLocalIP();
    currentUrl = `http://${ip}:${port}`;
    serverUrlHeader.textContent = currentUrl;
    portInput.value = port; 

    QRCode.toDataURL(currentUrl, { errorCorrectionLevel: 'H' }, (err, data_url) => {
        if (!err) {
            qrImg.src = data_url;
            qrImg.style.display = 'inline-block';
        }
    });

    socket = io(`http://localhost:${port}`);

    socket.on('connect', () => { console.log('Connected: ' + port); });

    socket.on('new_comment', (data) => {
        const div = document.createElement('div');
        div.className = 'history-item'; 
        
        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const type = data.isFixed ? '<span style="color:red">[固定]</span> ' : '';
        const fontStyle = data.fontFamily === 'serif' ? 'font-family: serif;' : '';
        const sizeInfo = data.size === 'large' ? ' (大)' : '';

        div.innerHTML = `<div style="color:#888; font-size:0.7em;">${time}</div>
                         <div>${type}<span style="color:${data.color || 'black'}; text-shadow: 0 0 1px #000;">■</span> 
                         <span style="${fontStyle}">${data.text}</span>${sizeInfo}</div>`;
        
        historyContainer.prepend(div);
    });
    
    socket.on('init_ng_words', () => {});
}

ipcRenderer.on('port-updated', (event, port) => {
    setupSocket(port);
});
