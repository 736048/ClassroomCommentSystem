const socket = io('http://localhost:3000');
const container = document.getElementById('comment-container');

socket.on('new_comment', (data) => {
    const div = document.createElement('div');
    div.className = 'comment';
    div.textContent = data.text;
    
    // Color handling
    if (data.color) {
        div.style.color = data.color;
        // Check if color is strictly black to apply white stroke
        const c = data.color.toLowerCase();
        if (c === '#000000' || c === '#000' || c === 'black') {
            div.classList.add('dark-text');
        }
    }
    
    // 一時的に配置して幅・高さを取得（画面外には出さないがvisibilityで隠す）
    div.style.opacity = '0';
    container.appendChild(div);
    
    // 固定コメントの場合
    if (data.isFixed) {
        // 既存の固定コメントがあれば削除
        const existingFixed = document.getElementById('fixed-comment');
        if (existingFixed) existingFixed.remove();

        div.id = 'fixed-comment';
        div.style.position = 'fixed';
        // Use provided position or default to 10%
        div.style.top = (data.position ? data.position : 10) + '%'; 
        div.style.left = '50%';
        div.style.transform = 'translateX(-50%)';
        div.style.zIndex = '1000'; // 最前面
        div.style.backgroundColor = 'rgba(0,0,0,0.5)'; // 背景色
        div.style.padding = '10px 20px';
        div.style.borderRadius = '10px';
        div.style.opacity = '1'; // 固定は即表示
        
        // 固定コメント出現アニメーション（少しだけふわっと）
        div.animate([
            { opacity: 0, transform: 'translateX(-50%) scale(0.9)' },
            { opacity: 1, transform: 'translateX(-50%) scale(1)' }
        ], {
            duration: 500,
            easing: 'ease-out'
        });
        return;
    }
    
    // --- 蛍方式（Firefly Style） ---
    const width = div.offsetWidth;
    const height = div.offsetHeight;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // ランダム位置計算 (画面端マージン 50px)
    // テキストが画面からはみ出さないように計算
    const maxX = windowWidth - width - 50;
    const maxY = windowHeight - height - 50;
    
    // 最小値チェック（画面が狭すぎる場合など）
    const x = Math.max(50, Math.random() * maxX);
    const y = Math.max(50, Math.random() * maxY);

    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    
    // 重なり順を制御（新しいものを手前に、でもランダム要素も少し入れる？）
    // 基本はDOM順序で手前に来るのでそのままでOK
    
    // アニメーション設定
    // ふわっと現れて(fadeIn)、しばらく留まり(Stay)、ふわっと消える(fadeOut)
    const duration = 4000 + Math.random() * 3000; // 4〜7秒の間でランダム
    
    const animation = div.animate([
        { opacity: 0, transform: 'scale(0.8)', offset: 0 },
        { opacity: 1, transform: 'scale(1)', offset: 0.1 },   // 10%時点で完全表示
        { opacity: 1, transform: 'scale(1)', offset: 0.8 },   // 80%時点まで維持
        { opacity: 0, transform: 'scale(1.1)', offset: 1 }    // 最後は消える
    ], {
        duration: duration,
        easing: 'ease-in-out',
        fill: 'forwards'
    });

    animation.onfinish = () => {
        div.remove();
    };
});

socket.on('clear_fixed_comment', () => {
    const existingFixed = document.getElementById('fixed-comment');
    if (existingFixed) existingFixed.remove();
});

// Update position of existing fixed comment
socket.on('update_fixed_position', (pos) => {
    const existingFixed = document.getElementById('fixed-comment');
    if (existingFixed) {
        existingFixed.style.top = pos + '%';
    }
});