const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const NG_WORDS_PATH = path.join(__dirname, 'ng_words.json');

function startServer(port = 3000) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);

    // 生徒用Web画面（publicフォルダ）を配信
    app.use(express.static(path.join(__dirname, '../public')));

    // NGワードの読み込み
    let ngWords = [];
    try {
        if (fs.existsSync(NG_WORDS_PATH)) {
            const data = fs.readFileSync(NG_WORDS_PATH, 'utf8');
            ngWords = JSON.parse(data);
            console.log('NG words loaded from file');
        }
    } catch (err) {
        console.error('Error loading NG words:', err);
    }

    io.on('connection', (socket) => {
        // 接続時に現在のNGワードを送信（先生用）
        socket.emit('init_ng_words', ngWords);

        // コメント受信
        socket.on('send_comment', (data) => {
            if (!data || !data.text) return;

            // 文字数制限 (20文字)
            if (data.text.length > 20) {
                data.text = data.text.substring(0, 20);
            }

            // NGワードチェック
            const hasNg = ngWords.some(word => data.text.includes(word));
            if (hasNg) {
                return;
            }
            
            // 全員に配信
            io.emit('new_comment', data);
        });

        // NGワード更新（先生側から）
        socket.on('update_ng_words', (words) => {
            if (Array.isArray(words)) {
                ngWords = words;
                console.log('NG Words updated:', ngWords);
                // ファイルに保存
                try {
                    fs.writeFileSync(NG_WORDS_PATH, JSON.stringify(ngWords, null, 2), 'utf8');
                } catch (err) {
                    console.error('Error saving NG words:', err);
                }
                // 全員に最新のNGワード設定を通知（他で開いている先生画面などがあれば同期）
                io.emit('init_ng_words', ngWords);
            }
        });

        // 固定コメント位置更新 (個別)
        socket.on('update_fixed_comment', (data) => {
            io.emit('update_fixed_comment', data);
        });

        // 固定コメント削除 (個別)
        socket.on('delete_fixed_comment', (commentId) => {
            io.emit('delete_fixed_comment', commentId);
        });

        // 固定コメント解除 (一括)
        socket.on('clear_fixed_comment', () => {
            io.emit('clear_fixed_comment');
        });

        // 図形送信 (新規作成)
        socket.on('send_shape', (shapeData) => {
            io.emit('new_shape', shapeData);
        });

        // 図形更新 (移動・リサイズ・色変更)
        socket.on('update_shape', (shapeData) => {
            io.emit('update_shape', shapeData);
        });

        // 図形削除 (単体)
        socket.on('delete_shape', (shapeId) => {
            io.emit('delete_shape', shapeId);
        });

        // QR表示同期
        socket.on('show_qr', (dataUrl) => {
            io.emit('show_qr', dataUrl);
        });
        socket.on('hide_qr', () => {
            io.emit('hide_qr');
        });

        // 図形クリア (全消去)
        socket.on('clear_shapes', () => {
            io.emit('clear_shapes');
        });
    });

    server.listen(port, '0.0.0.0', () => {
        console.log(`Server running on http://0.0.0.0:${port}`);
    });
    
    return { server, io };
}

module.exports = { startServer };