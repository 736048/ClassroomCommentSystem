const { networkInterfaces } = require('os');
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
document.getElementById('server-url').textContent = `http://${ip}:3000`;

// 先生コメント送信
const input = document.getElementById('teacher-input');
const sendBtn = document.getElementById('teacher-send');
const colorSelect = document.getElementById('teacher-color');
const fixedCheckbox = document.getElementById('teacher-fixed');
const clearFixedBtn = document.getElementById('clear-fixed');

function sendComment() {
    const text = input.value;
    if(!text) return;
    socket.emit('send_comment', {
        text: text,
        color: colorSelect.value,
        isFixed: fixedCheckbox.checked
    });
    input.value = '';
    // 固定チェックは外さない（連続投稿の利便性のため、あるいは外す運用も考えられるが一旦維持）
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
    div.style.borderBottom = '1px solid #eee';
    div.style.padding = '5px 0';
    div.style.fontSize = '0.9rem';
    
    const time = new Date().toLocaleTimeString();
    const type = data.isFixed ? '<span style="color:red">[固定]</span> ' : '';
    
    div.innerHTML = `${type}<span style="color:#888; font-size:0.8em;">${time}</span>: <span style="color:${data.color || 'black'}">■</span> ${data.text}`;
    
    historyContainer.prepend(div); // 新しいものを上に
});
