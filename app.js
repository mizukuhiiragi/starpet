// 🌟 StarPet (星の子) — レトロたまごっち × Stellar Soroban
// © 2026 Mizuku Hiiragi & Chibi Stella

// --- サウンド合成エンジン (Web Audio API) ---
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playBeep(freq = 880, type = 'square', duration = 0.08) {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Audio context may be restricted before interaction
  }
}

function playMelody(notes) {
  if (!soundEnabled) return;
  notes.forEach(([freq, delay, dur]) => {
    setTimeout(() => playBeep(freq, 'square', dur), delay);
  });
}

// サウンドエフェクトプリセット
const SFX = {
  click: () => playBeep(600, 'square', 0.05),
  eat: () => playMelody([[523, 0, 0.06], [659, 80, 0.06], [784, 160, 0.1]]),
  tea: () => playMelody([[440, 0, 0.08], [554, 100, 0.08], [659, 200, 0.12]]),
  ascend: () => playMelody([
    [523, 0, 0.1], [659, 120, 0.1], [784, 240, 0.1], 
    [1046, 360, 0.15], [1318, 500, 0.25]
  ]),
  stamp: () => playBeep(987, 'triangle', 0.1),
};

// --- ゲーム状態管理 ---
const state = {
  generation: 1,
  starsCount: 12,
  hunger: 60,
  growth: 20,
  isEating: false,
  isTeaParty: false,
  isAscended: false,
  currentForm: 'baby', // baby, child, adult
  currentView: 'pet', // pet, ascend, gallery
  gallery: [],
};

// --- ドット絵パターンデータ (16x16) ---
// 0: 透明, 1: 濃い緑(目/輪郭), 2: 明るい緑(ハイライト)
const SPRITES = {
  baby: [
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,2,2,2,2,2,2,1,1,0,0,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,1,2,2,1,2,2,2,2,1,2,2,2,2,1,0],
    [0,1,2,2,1,2,2,2,2,1,2,2,2,2,1,0],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,2,2,2,1,1,1,1,2,2,2,2,2,2,1],
    [1,2,2,2,1,2,2,2,2,1,2,2,2,2,2,1],
    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
    [0,0,1,2,2,2,2,2,2,2,2,2,2,1,0,0],
    [0,0,0,1,1,1,2,2,2,2,1,1,1,0,0,0],
    [0,0,0,0,0,1,2,1,1,2,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ],
  star_form: [
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,1,2,2,2,2,1,0,0,0,0,0],
    [1,1,1,1,1,1,2,2,2,2,1,1,1,1,1,1],
    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
    [0,0,1,2,1,2,2,2,2,2,2,1,2,1,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,1,2,2,2,1,1,1,1,2,2,2,1,0,0],
    [0,1,2,2,2,1,2,2,2,2,1,2,2,2,1,0],
    [0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0],
    [1,2,2,1,1,2,2,2,2,2,2,1,1,2,2,1],
    [1,2,1,0,0,1,2,2,2,2,1,0,0,1,2,1],
    [1,1,0,0,0,0,1,2,2,1,0,0,0,0,1,1],
    [0,0,0,0,0,0,1,2,2,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
  ]
};

// --- DOM 要素 ---
const petCanvas = document.getElementById('pet-canvas');
const petCtx = petCanvas.getContext('2d');
const gaugeHunger = document.getElementById('gauge-hunger');
const gaugeGrowth = document.getElementById('gauge-growth');
const txtGen = document.getElementById('txt-generation');
const txtStars = document.getElementById('txt-stars');
const speechBubble = document.getElementById('speech-bubble');
const fallingFood = document.getElementById('falling-food');
const guestPet = document.getElementById('guest-pet');

const viewPet = document.getElementById('view-pet');
const viewAscend = document.getElementById('view-ascend');
const viewGallery = document.getElementById('view-gallery');

const btnA = document.getElementById('btn-a');
const btnB = document.getElementById('btn-b');
const btnC = document.getElementById('btn-c');
const btnSound = document.getElementById('btn-sound');

// 手書きCanvas要素
const nftCanvas = document.getElementById('nft-canvas');
const nftCtx = nftCanvas.getContext('2d');
const btnMintNft = document.getElementById('btn-mint-nft');
const btnStampStar = document.getElementById('btn-stamp-star');
const btnClearCanvas = document.getElementById('btn-clear-canvas');
const btnBackFromGallery = document.getElementById('btn-back-from-gallery');
const galleryGrid = document.getElementById('gallery-grid');

// --- アニメーションループ ---
let animFrame = 0;
let petPosY = 0;
let isBlinking = false;

function renderPet() {
  petCtx.clearRect(0, 0, petCanvas.width, petCanvas.height);
  
  const sprite = (state.growth >= 50) ? SPRITES.star_form : SPRITES.baby;
  const pixelSize = 4;
  
  // 呼吸・バウンス
  const bounce = (animFrame % 40 < 20) ? 0 : 2;
  
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      const val = sprite[r][c];
      if (val === 1) {
        // まばたき判定
        if (isBlinking && (r === 5 || r === 4) && (c === 4 || c === 9)) {
          continue;
        }
        petCtx.fillStyle = '#1b2e1b'; // ドット暗部
        petCtx.fillRect(c * pixelSize, (r * pixelSize) + bounce, pixelSize, pixelSize);
      } else if (val === 2) {
        petCtx.fillStyle = '#7a9777'; // ドット明部
        petCtx.fillRect(c * pixelSize, (r * pixelSize) + bounce, pixelSize, pixelSize);
      }
    }
  }

  // まばたきトリガー
  if (Math.random() < 0.02 && !isBlinking) {
    isBlinking = true;
    setTimeout(() => { isBlinking = false; }, 180);
  }

  animFrame++;
  requestAnimationFrame(renderPet);
}

// 吹き出し表示
function showSpeech(text, duration = 1800) {
  speechBubble.innerText = text;
  speechBubble.classList.add('show');
  setTimeout(() => {
    speechBubble.classList.remove('show');
  }, duration);
}

// --- ユーザーアクション (A, B, C ボタン) ---

// Aボタン: エサ (星) をあげる
function actionFeed() {
  if (state.currentView !== 'pet') return;
  SFX.click();

  if (state.hunger >= 100) {
    showSpeech('おなかいっぱい！⭐');
    return;
  }

  state.isEating = true;
  fallingFood.innerText = '⭐';
  fallingFood.classList.remove('fall');
  void fallingFood.offsetWidth; // リフロー
  fallingFood.classList.add('fall');

  setTimeout(() => {
    SFX.eat();
    state.hunger = Math.min(100, state.hunger + 25);
    state.growth = Math.min(100, state.growth + 15);
    state.starsCount += 1;
    updateUI();
    showSpeech('もぐもぐ！おいしい⭐');
    state.isEating = false;

    // 成長度 100% で寿命・星座昇華式へ！
    if (state.growth >= 100) {
      setTimeout(startAscensionCeremony, 1200);
    }
  }, 750);
}

// Bボタン: 喫茶トケイソウのお茶会 ☕
function actionTeaParty() {
  if (state.currentView !== 'pet') return;
  SFX.tea();

  guestPet.innerText = '☕ ⭐';
  guestPet.classList.add('visiting');
  showSpeech('お茶会中… なかよし！☕');

  state.growth = Math.min(100, state.growth + 12);
  state.hunger = Math.max(0, state.hunger - 5);
  updateUI();

  setTimeout(() => {
    guestPet.classList.remove('visiting');
    showSpeech('また遊ぼうね！✨');
    if (state.growth >= 100) {
      setTimeout(startAscensionCeremony, 1200);
    }
  }, 2200);
}

// Cボタン: 星座ギャラリー開閉
function actionToggleGallery() {
  SFX.click();
  if (state.currentView === 'pet') {
    state.currentView = 'gallery';
    viewPet.classList.add('hidden');
    viewGallery.classList.remove('hidden');
    renderGallery();
  } else if (state.currentView === 'gallery') {
    state.currentView = 'pet';
    viewGallery.classList.add('hidden');
    viewPet.classList.remove('hidden');
  }
}

function updateUI() {
  gaugeHunger.style.width = `${state.hunger}%`;
  gaugeGrowth.style.width = `${state.growth}%`;
  txtStars.innerText = `⭐ × ${state.starsCount}`;
  txtGen.innerText = `GEN: ${state.generation}st`;
}

// --- 旅立ちの星座式 ＆ 手書きNFTミント ---
let isDrawing = false;
let currentColor = '#ffd166';
let hasDrawn = false;

function startAscensionCeremony() {
  SFX.ascend();
  state.currentView = 'ascend';
  viewPet.classList.add('hidden');
  viewAscend.classList.remove('hidden');

  // 美麗な星座背景カードをCanvasに下絵として生成
  drawConstellationBase();
}

function drawConstellationBase() {
  const w = nftCanvas.width;
  const h = nftCanvas.height;

  // 宇宙グラデーション背景
  const grad = nftCtx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#020617');
  grad.addColorStop(0.5, '#0f172a');
  grad.addColorStop(1, '#1e1b4b');
  nftCtx.fillStyle = grad;
  nftCtx.fillRect(0, 0, w, h);

  // 金の華麗な額縁枠
  nftCtx.strokeStyle = '#ffd166';
  nftCtx.lineWidth = 4;
  nftCtx.strokeRect(8, 8, w - 16, h - 16);
  nftCtx.strokeStyle = 'rgba(255, 209, 102, 0.4)';
  nftCtx.lineWidth = 1;
  nftCtx.strokeRect(12, 12, w - 24, h - 24);

  // 四隅の飾り星
  drawStar(nftCtx, 18, 18, 6, '#ffd166');
  drawStar(nftCtx, w - 18, 18, 6, '#ffd166');
  drawStar(nftCtx, 18, h - 18, 6, '#ffd166');
  drawStar(nftCtx, w - 18, h - 18, 6, '#ffd166');

  // 星座の幾何学ライン
  nftCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  nftCtx.lineWidth = 1.5;
  nftCtx.beginPath();
  nftCtx.moveTo(w / 2, 60);
  nftCtx.lineTo(w / 2 - 60, 140);
  nftCtx.lineTo(w / 2 + 60, 140);
  nftCtx.closePath();
  nftCtx.stroke();

  nftCtx.beginPath();
  nftCtx.moveTo(w / 2 - 60, 140);
  nftCtx.lineTo(w / 2, 210);
  nftCtx.lineTo(w / 2 + 60, 140);
  nftCtx.stroke();

  // 中央の神聖な星の子シルエット (覚醒の姿)
  drawDivineStar(nftCtx, w / 2, 135, 42, '#ffd166');

  // 称号・メタデータ
  nftCtx.font = 'bold 13px "DotGothic16", monospace';
  nftCtx.fillStyle = '#38bdf8';
  nftCtx.textAlign = 'center';
  nftCtx.fillText(`★ 星座証書: 第 ${state.generation} 代星の子 ★`, w / 2, 255);

  nftCtx.font = '10px "DotGothic16", monospace';
  nftCtx.fillStyle = '#94a3b8';
  nftCtx.fillText('生涯で集めた星: ' + state.starsCount + ' XLM', w / 2, 275);
  nftCtx.fillText('喫茶トケイソウ 永世星座登録', w / 2, 292);

  // 手書き署名スペースのガイド線
  nftCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  nftCtx.setLineDash([4, 4]);
  nftCtx.strokeRect(30, 310, w - 60, 48);
  nftCtx.setLineDash([]);

  nftCtx.font = '9px "DotGothic16", monospace';
  nftCtx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  nftCtx.fillText('▼ 指やペンで名前や言葉を書いてね ▼', w / 2, 326);
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    ctx.lineTo(
      cx + r * Math.cos(((18 + i * 72) * Math.PI) / 180),
      cy - r * Math.sin(((18 + i * 72) * Math.PI) / 180)
    );
    ctx.lineTo(
      cx + (r / 2) * Math.cos(((54 + i * 72) * Math.PI) / 180),
      cy - (r / 2) * Math.sin(((54 + i * 72) * Math.PI) / 180)
    );
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDivineStar(ctx, x, y, r, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  drawStar(ctx, x, y, r, color);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 手書き描画イベント
function getCanvasCoords(e) {
  const rect = nftCanvas.getBoundingClientRect();
  const scaleX = nftCanvas.width / rect.width;
  const scaleY = nftCanvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function startDrawing(e) {
  isDrawing = true;
  const { x, y } = getCanvasCoords(e);
  nftCtx.beginPath();
  nftCtx.moveTo(x, y);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const { x, y } = getCanvasCoords(e);
  nftCtx.strokeStyle = currentColor;
  nftCtx.lineWidth = 3;
  nftCtx.lineCap = 'round';
  nftCtx.lineJoin = 'round';
  nftCtx.lineTo(x, y);
  nftCtx.stroke();
  hasDrawn = true;
}

function stopDrawing() {
  isDrawing = false;
}

nftCanvas.addEventListener('mousedown', startDrawing);
nftCanvas.addEventListener('mousemove', draw);
window.addEventListener('mouseup', stopDrawing);

nftCanvas.addEventListener('touchstart', startDrawing, { passive: false });
nftCanvas.addEventListener('touchmove', draw, { passive: false });
window.addEventListener('touchend', stopDrawing);

// カラー選択
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentColor = btn.dataset.color;
    SFX.click();
  });
});

// スタンプボタン
btnStampStar.addEventListener('click', () => {
  SFX.stamp();
  const randX = 40 + Math.random() * (nftCanvas.width - 80);
  const randY = 160 + Math.random() * 140;
  drawStar(nftCtx, randX, randY, 10, currentColor);
});

// リセットボタン
btnClearCanvas.addEventListener('click', () => {
  SFX.click();
  drawConstellationBase();
});

// 集めた星で空に還す（ミントボタン）
btnMintNft.addEventListener('click', () => {
  SFX.ascend();
  
  // PNG画像として出力
  const dataUrl = nftCanvas.toDataURL('image/png');
  
  // ギャラリーに追加
  state.gallery.push({
    gen: state.generation,
    image: dataUrl,
    date: new Date().toLocaleDateString('ja-JP'),
    stars: state.starsCount
  });

  // ダウンロードリンク発火（ユーザーの手元に本物保存）
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `StarPet_Gen${state.generation}_Constellation.png`;
  a.click();

  alert(`✨ 【旅立ち完了】\n星の子は夜空の星座（オンチェーンNFT）になりました！\n集めた星（0.00001 XLM）を使って天へ還されました。額縁カードが保存されました。`);

  // 次の世代（卵）の誕生へ！
  state.generation += 1;
  state.growth = 0;
  state.hunger = 50;
  state.starsCount = 5; // 初回ボーナス星
  state.currentView = 'pet';

  viewAscend.classList.add('hidden');
  viewPet.classList.remove('hidden');
  updateUI();
  showSpeech('新しい星の卵が生まれたよ！🐣', 2500);
});

// ギャラリー描画
function renderGallery() {
  if (state.gallery.length === 0) {
    galleryGrid.innerHTML = '<div class="empty-gallery">まだ夜空に還った星の子はいません。<br>Aボタンで星をあげて育ててね！</div>';
    return;
  }
  galleryGrid.innerHTML = state.gallery.map(item => `
    <div class="gallery-card">
      <img src="${item.image}" alt="Gen ${item.gen}">
      <div class="gallery-card-name">第 ${item.gen} 代 星座証書</div>
      <div style="font-size:8px; color:#94a3b8;">${item.date} (${item.stars} ⭐)</div>
    </div>
  `).join('');
}

btnBackFromGallery.addEventListener('click', actionToggleGallery);

// ボタンイベントリスナー (スマホでも即時反応するように pointerdown 併用)
function bindButton(btn, handler) {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    handler();
  });
}

bindButton(btnA, actionFeed);
bindButton(btnB, actionTeaParty);
bindButton(btnC, actionToggleGallery);

// 音声トグル
btnSound.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  btnSound.innerText = soundEnabled ? '🔊 SOUND ON' : '🔇 SOUND OFF';
  if (soundEnabled) playBeep(880, 'square', 0.08);
});

// 初回起動
updateUI();
requestAnimationFrame(renderPet);
