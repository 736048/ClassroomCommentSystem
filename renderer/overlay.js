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
        let baseSize = 48; // Standard
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
        
        // 固定コメント
        if (data.isFixed) {
            const existingFixed = document.getElementById('fixed-comment');
            if (existingFixed) existingFixed.remove();

            div.id = 'fixed-comment';
            div.style.position = 'fixed';
            div.style.top = (data.position ? data.position : 10) + '%'; 
            div.style.left = '50%';
            div.style.transform = 'translateX(-50%)';
            div.style.zIndex = '1000';
            div.style.backgroundColor = 'rgba(0,0,0,0.5)';
            div.style.padding = '10px 20px';
            div.style.borderRadius = '10px';
            div.style.opacity = '1'; 
            
            div.animate([
                { opacity: 0, transform: 'translateX(-50%) scale(0.9)' },
                { opacity: 1, transform: 'translateX(-50%) scale(1)' }
            ], {
                duration: 500,
                easing: 'ease-out'
            });
            return;
        }
        
        // 蛍方式
        const width = div.offsetWidth;
        const height = div.offsetHeight;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        const maxX = windowWidth - width - 50;
        const maxY = windowHeight - height - 50;
        
        const x = Math.max(50, Math.random() * maxX);
        const y = Math.max(50, Math.random() * maxY);

        div.style.left = `${x}px`;
        div.style.top = `${y}px`;
        
        const duration = 4000 + Math.random() * 3000;
        
        const animation = div.animate([
            { opacity: 0, transform: 'scale(0.8)', offset: 0 },
            { opacity: 1, transform: 'scale(1)', offset: 0.1 },
            { opacity: 1, transform: 'scale(1)', offset: 0.8 },
            { opacity: 0, transform: 'scale(1.1)', offset: 1 } 
        ], {
            duration: duration,
            easing: 'ease-in-out',
            fill: 'forwards'
        });

        animation.onfinish = () => {
            div.remove();
        };
    });

    // --- Shapes Logic ---
    
    // Create new shape
    socket.on('new_shape', (data) => {
        createOrUpdateShape(data);
    });
    
    // Update existing shape
    socket.on('update_shape', (data) => {
        createOrUpdateShape(data);
    });

    socket.on('clear_shapes', () => {
        const shapes = document.querySelectorAll('.shape-overlay');
        shapes.forEach(el => el.remove());
    });

    socket.on('clear_fixed_comment', () => {
        const existingFixed = document.getElementById('fixed-comment');
        if (existingFixed) existingFixed.remove();
    });

    socket.on('update_fixed_position', (pos) => {
        const existingFixed = document.getElementById('fixed-comment');
        if (existingFixed) {
            existingFixed.style.top = pos + '%';
        }
    });
}

function createOrUpdateShape(data) {
    let shape = document.getElementById('shape-' + data.id);
    
    if (!shape) {
        shape = document.createElement('div');
        shape.id = 'shape-' + data.id;
        shape.className = 'shape-overlay';
        shape.style.position = 'absolute';
        shape.style.boxSizing = 'border-box';
        // Non-interactive on overlay, just display
        shape.style.pointerEvents = 'none'; 
        
        container.appendChild(shape);
    }
    
    // Apply updates
    // data.width/height are in %
    if (data.width) shape.style.width = data.width + '%';
    if (data.height) shape.style.height = data.height + '%';
    if (data.color) shape.style.border = `5px solid ${data.color}`;
    
    // Position
    // data.x, data.y are Left/Top %
    if (data.x !== undefined) shape.style.left = data.x + '%';
    if (data.y !== undefined) shape.style.top = data.y + '%';
    
    // Remove Translate logic used previously
    shape.style.transform = 'none';
    
    // Type
    if (data.type === 'circle') {
        shape.style.borderRadius = '50%';
    } else {
        shape.style.borderRadius = '0';
    }
}

ipcRenderer.on('port-updated', (event, port) => {
    setupSocket(port);
});
