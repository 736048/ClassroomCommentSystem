const socket = io('http://localhost:3000');
const container = document.getElementById('comment-container');

// レーン管理（簡易版）
const FONT_SIZE = 48; // CSSと合わせる
const LANE_HEIGHT = FONT_SIZE * 1.5;
let lanes = []; // 各レーンの「最後にコメントが通過する時刻」を保持

function initLanes() {
    const usableHeight = window.innerHeight * 0.8; // 上下10%を空ける
    const maxLanes = Math.floor(usableHeight / LANE_HEIGHT);
    lanes = new Array(maxLanes).fill(0);
}

window.addEventListener('resize', initLanes);
initLanes();

function getAvailableLane(now) {
    // 空いているレーンを探す
    for (let i = 0; i < lanes.length; i++) {
        if (lanes[i] < now) {
            return i;
        }
    }
    // 空いてなければランダム（あるいは一番早く空くところ）
    return Math.floor(Math.random() * lanes.length);
}

socket.on('new_comment', (data) => {
    const div = document.createElement('div');
    div.className = 'comment';
    div.textContent = data.text;
    if (data.color) div.style.color = data.color;
    
    // 一時的に配置して幅を取得
    div.style.visibility = 'hidden';
    container.appendChild(div);
    const width = div.offsetWidth;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // レーン決定
    const now = Date.now();
    const laneIndex = getAvailableLane(now);
    
    // 固定コメントの場合
    if (data.isFixed) {
        // 既存の固定コメントがあれば削除（あるいは上書き）
        const existingFixed = document.getElementById('fixed-comment');
        if (existingFixed) existingFixed.remove();

        div.id = 'fixed-comment';
        div.style.position = 'fixed';
        div.style.top = '10%'; // 上部10%の位置
        div.style.left = '50%';
        div.style.transform = 'translateX(-50%)';
        div.style.zIndex = '1000'; // 最前面
        div.style.backgroundColor = 'rgba(0,0,0,0.5)'; // 背景色をつけて読みやすく
        div.style.padding = '10px 20px';
        div.style.borderRadius = '10px';
        div.style.visibility = 'visible';
        // アニメーションなし
        return;
    }
    
    // 配置 (上下10%の余白を考慮)
    const topOffset = windowHeight * 0.1;
    div.style.top = `${topOffset + (laneIndex * LANE_HEIGHT)}px`;
    div.style.left = `${windowWidth}px`; // 右端スタート
    div.style.visibility = 'visible';

    // アニメーション設定
    const duration = 5000; // 5秒で横断
    
    // 次にこのレーンが使えるようになる時間を計算
    // (画面幅 / (画面幅 + コメント幅)) * duration 分だけ待てば、次のコメントが追い越さない
    // 簡易的に「半分くらい進んだら次OK」とするか、厳密にやるか。
    // ここでは「直前のコメントの右端が画面右端から出現しきったらOK」とする。
    // 速度 v = (windowWidth + width) / duration
    // コメントが完全に出現するまでの距離 = width
    // 必要時間 t = width / v
    const speed = (windowWidth + width) / duration;
    const appearTime = width / speed;
    lanes[laneIndex] = now + appearTime + 200; // マージン200ms

    // Web Animations API
    const animation = div.animate([
        { transform: 'translateX(0)' },
        { transform: `translateX(-${windowWidth + width}px)` }
    ], {
        duration: duration,
        easing: 'linear'
    });

    animation.onfinish = () => {
        div.remove();
    };
});

socket.on('clear_fixed_comment', () => {
    const existingFixed = document.getElementById('fixed-comment');
    if (existingFixed) existingFixed.remove();
});
