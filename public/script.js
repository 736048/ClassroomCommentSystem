const socket = io();
const input = document.getElementById('comment-input');
const btn = document.getElementById('send-btn');
const statusDiv = document.getElementById('status');
const historyList = document.getElementById('history-list');

let currentStudentColor = '#FFFFFF';

// Listen for color updates from server
socket.on('update_student_color', (color) => {
    currentStudentColor = color;
});

function send() {
    const text = input.value.trim();
    if (!text) return;
    
    // Send to server (Color is fixed to the one chosen by the teacher)
    socket.emit('send_comment', {
        text: text,
        color: currentStudentColor
    });
    
    input.value = '';
    statusDiv.textContent = '送信しました';
    
    setTimeout(() => { statusDiv.textContent = ''; }, 2000);
}

// Listen for incoming comments
socket.on('new_comment', (data) => {
    addCommentToHistory(data);
});

// Force disconnect handling
socket.on('force_disconnect', () => {
    socket.disconnect(); // Manually disconnect
    alert('サーバー設定が変更されました。新しいQRコードを読み取ってください。');
    statusDiv.textContent = '接続が切れました。再読み込みしてください。';
    statusDiv.style.color = 'red';
    input.disabled = true;
    btn.disabled = true;
});

function addCommentToHistory(data) {
    if (!data || !data.text) return;

    const item = document.createElement('div');
    item.className = 'history-item';
    
    const textSpan = document.createElement('span');
    textSpan.textContent = data.text;
    // History text always black
    textSpan.style.color = '#000'; 

    item.appendChild(textSpan);
    
    historyList.prepend(item);
}

btn.addEventListener('click', send);
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send();
});