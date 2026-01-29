const { ipcRenderer } = require('electron');
const io = require('socket.io-client');

let socket;
const container = document.getElementById('comment-container');

function setupSocket(port) {
    if (socket) {
        socket.disconnect();
        socket.removeAllListeners();
    }

    socket = io(`http://localhost:${port}`);

    socket.on('new_comment', (data) => {
        const div = document.createElement('div');
        div.className = 'comment';
        div.textContent = data.text;
        
        // Font Family
        if (data.fontFamily === 'serif') {
            div.style.fontFamily = '"Hiragino Mincho ProN", "YuMincho", "Times New Roman", serif';
        } else {
            div.style.fontFamily = '"Helvetica Neue", Arial, sans-serif';
        }
        
        // Font Size
        let baseSize = 48; 
        if (data.size === 'large') baseSize = 96;
        div.style.fontSize = baseSize + 'px';

        // Color handling
        if (data.color) {
            div.style.color = data.color;
            const c = data.color.toLowerCase();
            if (c === '#000000' || c === '#000' || c === 'black') {
                div.classList.add('dark-text');
            }
        }
        
        div.style.opacity = '0';
        container.appendChild(div);
        
        // 固定コメント処理
        if (data.isFixed) {
            createOrUpdateFixedComment(data);
            // new_commentで生成したdivは不要なので削除（createOrUpdateFixedComment内で別途生成・管理）
            div.remove();
            return;
        }
        
        // 蛍方式 (ランダム位置)
        const width = div.offsetWidth || 200;
        const height = div.offsetHeight || 60;
        const x = Math.max(50, Math.random() * (window.innerWidth - width - 100));
        const y = Math.max(50, Math.random() * (window.innerHeight - height - 100));

        div.style.left = `${x}px`;
        div.style.top = `${y}px`;
        
        const duration = 4000 + Math.random() * 3000;
        const animation = div.animate([
            { opacity: 0, transform: 'scale(0.8)', offset: 0 },
            { opacity: 1, transform: 'scale(1)', offset: 0.1 },
            { opacity: 1, transform: 'scale(1)', offset: 0.8 },
            { opacity: 0, transform: 'scale(1.1)', offset: 1 } 
        ], { duration: duration, easing: 'ease-in-out', fill: 'forwards' });

        animation.onfinish = () => div.remove();
    });

    // --- Shapes Logic ---
    socket.on('new_shape', (data) => createOrUpdateShape(data));
    socket.on('update_shape', (data) => createOrUpdateShape(data));
    socket.on('delete_shape', (shapeId) => {
        const el = document.getElementById('shape-' + shapeId);
        if (el) el.remove();
    });
    socket.on('clear_shapes', () => {
        document.querySelectorAll('.shape-overlay').forEach(el => el.remove());
    });

    // --- Fixed Comments Logic ---
    socket.on('update_fixed_comment', (data) => createOrUpdateFixedComment(data));
    socket.on('delete_fixed_comment', (id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
    socket.on('clear_fixed_comment', () => {
        document.querySelectorAll('.fixed-comment-item').forEach(el => el.remove());
    });

    // --- QR Logic ---
    const qrModal = document.getElementById('qr-overlay-modal');
    const qrImg = document.getElementById('qr-overlay-img');
    socket.on('show_qr', (dataUrl) => { qrImg.src = dataUrl; qrModal.style.display = 'flex'; });
    socket.on('hide_qr', () => { qrModal.style.display = 'none'; });
}

function createOrUpdateFixedComment(data) {
    let el = document.getElementById(data.id);
    if (!el) {
        el = document.createElement('div');
        el.id = data.id;
        el.className = 'comment fixed-comment-item';
        el.style.position = 'fixed';
        el.style.zIndex = '1000';
        el.style.backgroundColor = 'rgba(0,0,0,0.5)';
        el.style.padding = '10px 20px';
        el.style.borderRadius = '10px';
        container.appendChild(el);
    }
    
    el.textContent = data.text || el.textContent;

    // Font Family Reflect
    if (data.fontFamily) {
        if (data.fontFamily === 'serif') {
            el.style.fontFamily = '"Hiragino Mincho ProN", "YuMincho", "Times New Roman", serif';
        } else {
            el.style.fontFamily = '"Helvetica Neue", Arial, sans-serif';
        }
    }

    // Font Size Reflect
    if (data.size) {
        let baseSize = 48; 
        if (data.size === 'large') baseSize = 96;
        el.style.fontSize = baseSize + 'px';
    }

    // Color & Stroke Reflect
    if (data.color) {
        el.style.color = data.color;
        const c = data.color.toLowerCase();
        if (c === '#000000' || c === '#000' || c === 'black') {
            el.classList.add('dark-text');
        } else {
            el.classList.remove('dark-text');
        }
    }
    
    if (data.x !== undefined) el.style.left = data.x + '%';
    if (data.y !== undefined) el.style.top = data.y + '%';
    el.style.display = 'block';
    el.style.opacity = '1';
}

function createOrUpdateShape(data) {
    let shape = document.getElementById('shape-' + data.id);
    if (!shape) {
        shape = document.createElement('div');
        shape.id = 'shape-' + data.id;
        shape.className = 'shape-overlay';
        shape.style.position = 'absolute';
        shape.style.boxSizing = 'border-box';
        shape.style.pointerEvents = 'none'; 
        container.appendChild(shape);
    }
    if (data.x !== undefined) shape.style.left = data.x + '%';
    if (data.y !== undefined) shape.style.top = data.y + '%';
    if (data.width) shape.style.width = data.width + '%';
    if (data.height) shape.style.height = data.height + '%';
    if (data.type === 'line') {
        shape.style.backgroundColor = data.color || 'red';
        shape.style.border = 'none';
    } else {
        shape.style.border = `5px solid ${data.color || 'red'}`;
        shape.style.backgroundColor = 'transparent';
        if (data.type === 'circle') shape.style.borderRadius = '50%';
        else shape.style.borderRadius = '0';
    }
}

ipcRenderer.on('port-updated', (event, port) => setupSocket(port));
