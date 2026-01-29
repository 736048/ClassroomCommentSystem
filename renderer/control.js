const { networkInterfaces } = require('os');
const QRCode = require('qrcode');
const socket = io('http://localhost:3000');

// ローカルIPアドレスを取得して表示
function getLocalIP() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // IPv4かつ内部IPでないものを探す
            if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

const ip = getLocalIP();
const url = `http://${ip}:3000`;
document.getElementById('server-url').textContent = url;

// QRコード生成
const qrImg = document.getElementById('qr-code');
QRCode.toDataURL(url, { errorCorrectionLevel: 'H' }, (err, data_url) => {
    if (err) {
        console.error('QR Code Error:', err);
        return;
    }
    qrImg.src = data_url;
    qrImg.style.display = 'inline-block';
});

// 先生コメント送信
const input = document.getElementById('teacher-input');
const sendBtn = document.getElementById('teacher-send');
const fixedCheckbox = document.getElementById('teacher-fixed');
const clearFixedBtn = document.getElementById('clear-fixed');
const colorBlocks = document.querySelectorAll('.color-block');

// 固定位置制御
const fixedPosContainer = document.getElementById('fixed-pos-container');
const fixedPosSlider = document.getElementById('fixed-pos');
const posVal = document.getElementById('pos-val');

let selectedColor = '#ffffff'; // Default

// Color selection logic
colorBlocks.forEach(block => {
    block.addEventListener('click', () => {
        colorBlocks.forEach(b => b.classList.remove('selected'));
        block.classList.add('selected');
        selectedColor = block.dataset.color;
    });
});

// Checkbox visibility toggle
fixedCheckbox.addEventListener('change', () => {
    if (fixedCheckbox.checked) {
        fixedPosContainer.style.display = 'block';
    } else {
        fixedPosContainer.style.display = 'none';
    }
});

// Slider value update & emit
fixedPosSlider.addEventListener('input', () => {
    const val = fixedPosSlider.value;
    posVal.textContent = val + '%';
    socket.emit('update_fixed_position', val);
});

function sendComment() {
    const text = input.value;
    if(!text) return;
    
    socket.emit('send_comment', {
        text: text,
        color: selectedColor,
        isFixed: fixedCheckbox.checked,
        position: fixedPosSlider.value // Send current slider position
    });
    input.value = '';
}

sendBtn.addEventListener('click', sendComment);
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendComment();
});

clearFixedBtn.addEventListener('click', () => {
    socket.emit('clear_fixed_comment');
});

// NGワード更新
const ngInput = document.getElementById('ng-words');
const ngBtn = document.getElementById('update-ng');
const ngStatus = document.getElementById('ng-status');

ngBtn.addEventListener('click', () => {
    const words = ngInput.value.split(',').map(w => w.trim()).filter(w => w);
    socket.emit('update_ng_words', words);
    
    ngStatus.textContent = 'NGワードを更新しました！';
    setTimeout(() => {
        ngStatus.textContent = '';
    }, 3000);
});

// コメント履歴表示
const historyContainer = document.getElementById('comment-history');

socket.on('new_comment', (data) => {
    const div = document.createElement('div');
    div.className = 'history-item'; 
    div.style.borderBottom = '1px solid #ccc';
    div.style.padding = '5px 0';
    div.style.fontSize = '0.9rem';
    
    const time = new Date().toLocaleTimeString();
    const type = data.isFixed ? '<span style="color:red">[固定]</span> ' : '';
    
    div.innerHTML = `${type}<span style="color:#888; font-size:0.8em;">${time}</span>: <span style="color:${data.color || 'black'}; text-shadow: 0 0 1px #000;">■</span> ${data.text}`;
    
    historyContainer.prepend(div);
});
