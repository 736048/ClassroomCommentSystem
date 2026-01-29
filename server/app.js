const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

function startServer(port = 3000) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    // 生徒用Web画面（publicフォルダ）を配信
    app.use(express.static(path.join(__dirname, '../public')));

    let ngWords = [];

    io.on('connection', (socket) => {
        // コメント受信
        socket.on('send_comment', (data) => {
            // data: { text: string, color: string, isFixed: boolean }
            if (!data || !data.text) return;

            // NGワードチェック
            const hasNg = ngWords.some(word => data.text.includes(word));
            if (hasNg) {
                return; // NGワードが含まれていれば配信しない
            }
            
            // 全員（オーバーレイ含む）に配信
            io.emit('new_comment', data);
        });

        // NGワード更新（先生側から）
        socket.on('update_ng_words', (words) => {
            if (Array.isArray(words)) {
                ngWords = words;
                console.log('NG Words updated:', ngWords);
            }
        });

        // 固定コメント解除
        socket.on('clear_fixed_comment', () => {
            io.emit('clear_fixed_comment');
        });
    });

    server.listen(port, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${port}`);
    });
    
    return { server, io };
}

module.exports = { startServer };
