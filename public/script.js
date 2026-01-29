const socket = io();
const input = document.getElementById('comment-input');
const btn = document.getElementById('send-btn');
const statusDiv = document.getElementById('status');

function send() {
    const text = input.value.trim();
    if (!text) return;
    
    socket.emit('send_comment', {
        text: text
    });
    
    input.value = '';
    statusDiv.textContent = '送信しました！';
    setTimeout(() => { statusDiv.textContent = ''; }, 2000);
}

btn.addEventListener('click', send);
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') send();
});
