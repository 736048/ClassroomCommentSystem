const socket = io();
const input = document.getElementById('comment-input');
const btn = document.getElementById('send-btn');
const statusDiv = document.getElementById('status');
const historyList = document.getElementById('history-list');

function send() {
    const text = input.value.trim();
    if (!text) return;
    
    // Send to server (Color is fixed to White)
    socket.emit('send_comment', {
        text: text,
        color: '#FFFFFF'
    });
    
    input.value = '';
    statusDiv.textContent = '送信しました';
    
    setTimeout(() => { statusDiv.textContent = ''; }, 2000);
}

// Listen for incoming comments
socket.on('new_comment', (data) => {
    addCommentToHistory(data);
});

function addCommentToHistory(data) {
    if (!data || !data.text) return;

    const item = document.createElement('div');
    item.className = 'history-item';
    
    // We don't show color indicator anymore since everyone is white (or teacher is special but we can ignore for now or show distinctively if needed)
    
    const textSpan = document.createElement('span');
    textSpan.textContent = data.text;
    // History text always black for readability on white background
    textSpan.style.color = '#000'; 

    item.appendChild(textSpan);
    
    historyList.prepend(item);
}

btn.addEventListener('click', send);
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send();
});
