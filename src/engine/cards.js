import * as THREE from 'three';

export const SUITS = {
  S: { id: 'S', name: 'Maça', symbol: '♠', color: '#1a1e24', secondary: '#2d3748', isRed: false },
  H: { id: 'H', name: 'Kupa', symbol: '♥', color: '#c53030', secondary: '#e53e3e', isRed: true },
  D: { id: 'D', name: 'Karo', symbol: '♦', color: '#d69e2e', secondary: '#dd6b20', isRed: true },
  C: { id: 'C', name: 'Sinek', symbol: '♣', color: '#276749', secondary: '#2f855a', isRed: false }
};

export const RANKS = [
  { rank: '2', value: 2, label: '2' },
  { rank: '3', value: 3, label: '3' },
  { rank: '4', value: 4, label: '4' },
  { rank: '5', value: 5, label: '5' },
  { rank: '6', value: 6, label: '6' },
  { rank: '7', value: 7, label: '7' },
  { rank: '8', value: 8, label: '8' },
  { rank: '9', value: 9, label: '9' },
  { rank: '10', value: 10, label: '10' },
  { rank: 'J', value: 11, label: 'J', court: 'Vale' },
  { rank: 'Q', value: 12, label: 'Q', court: 'Kız' },
  { rank: 'K', value: 13, label: 'K', court: 'Papaz' },
  { rank: 'A', value: 14, label: 'A', court: 'As' }
];

export function createStandardDeck() {
  const deck = [];
  const suitKeys = ['S', 'H', 'D', 'C'];
  for (const sKey of suitKeys) {
    const suit = SUITS[sKey];
    for (const r of RANKS) {
      deck.push({
        id: `${r.rank}_${sKey}`,
        suit: suit.id,
        suitName: suit.name,
        symbol: suit.symbol,
        color: suit.color,
        isRed: suit.isRed,
        rank: r.rank,
        value: r.value,
        label: r.label,
        court: r.court || null
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Procedural Card Canvas Texture Generator with High-DPI crisp rendering
class CardTextureGenerator {
  constructor() {
    this.cache = new Map();
    this.backTexture = null;
  }

  getBackTexture() {
    if (this.backTexture) return this.backTexture;

    const width = 512;
    const height = 716;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Royal Navy & Gold ornamental casino card back
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Outer gold border
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#d4af37';
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Inner thin border
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fef08a';
    ctx.strokeRect(28, 28, width - 56, height - 56);

    // Intricate geometric mandala pattern
    const cx = width / 2;
    const cy = height / 2;
    
    // Gradient center
    const radGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
    radGrad.addColorStop(0, '#1e3a8a');
    radGrad.addColorStop(0.7, '#172554');
    radGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = radGrad;
    ctx.fillRect(32, 32, width - 64, height - 64);

    // Repeated diamond lattice
    ctx.save();
    ctx.beginPath();
    ctx.rect(32, 32, width - 64, height - 64);
    ctx.clip();

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.25)';
    ctx.lineWidth = 2;
    const step = 28;
    for (let x = -width; x < width * 2; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x + height, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Center Emblem
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#d4af37';
    ctx.fillStyle = '#1e293b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 36px "Cinzel", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VR 52', 0, -10);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#d4af37';
    ctx.fillText('★ QUEST 3 ★', 0, 24);

    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    this.backTexture = texture;
    return texture;
  }

  getFrontTexture(card) {
    const key = `${card.rank}_${card.suit}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const width = 512;
    const height = 716;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Ivory Paper background with subtle texture
    ctx.fillStyle = '#fcfbfa';
    ctx.fillRect(0, 0, width, height);

    // Subtle edge highlight
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(6, 6, width - 12, height - 12);

    const suit = SUITS[card.suit];
    const isRed = suit.isRed;
    const suitColor = isRed ? '#dc2626' : '#111827';

    // Draw Corner Indices (Top-Left & Bottom-Right)
    const drawIndex = (x, y, angle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      ctx.fillStyle = suitColor;
      ctx.font = 'bold 48px "Cinzel", "Georgia", "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(card.rank, 0, 0);

      ctx.font = '38px sans-serif';
      ctx.fillText(suit.symbol, 0, 52);

      ctx.restore();
    };

    drawIndex(44, 28, 0);
    drawIndex(width - 44, height - 28, Math.PI);

    // Center Illustration or Pips
    const cx = width / 2;
    const cy = height / 2;

    if (['J', 'Q', 'K'].includes(card.rank)) {
      this.drawCourtCard(ctx, card, cx, cy, suitColor, suit);
    } else if (card.rank === 'A') {
      this.drawAceCard(ctx, suit, cx, cy, suitColor);
    } else {
      this.drawNumberPips(ctx, card, cx, cy, suitColor, suit);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    this.cache.set(key, texture);
    return texture;
  }

  drawAceCard(ctx, suit, cx, cy, color) {
    // Large ornamental Ace
    ctx.fillStyle = color;
    ctx.font = '180px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 12;
    ctx.fillText(suit.symbol, cx, cy - 10);
    ctx.shadowBlur = 0;

    // Center label
    ctx.font = 'bold 22px "Cinzel", "Georgia", serif';
    ctx.fillStyle = suit.isRed ? '#991b1b' : '#374151';
    ctx.fillText(suit.name.toUpperCase(), cx, cy + 120);
  }

  drawCourtCard(ctx, card, cx, cy, color, suit) {
    const boxW = 280;
    const boxH = 430;
    
    // Outer court border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

    // Decorative inner background
    const courtGrad = ctx.createLinearGradient(0, cy - boxH / 2, 0, cy + boxH / 2);
    courtGrad.addColorStop(0, suit.isRed ? '#fef2f2' : '#f0fdf4');
    courtGrad.addColorStop(1, '#f8fafc');
    ctx.fillStyle = courtGrad;
    ctx.fillRect(cx - boxW / 2 + 4, cy - boxH / 2 + 4, boxW - 8, boxH - 8);

    // Traditional Court Character silhouette & emblems
    ctx.save();
    ctx.translate(cx, cy);

    // Crown / Royal Hat
    ctx.fillStyle = '#d4af37';
    ctx.beginPath();
    ctx.moveTo(-45, -110);
    ctx.lineTo(45, -110);
    ctx.lineTo(35, -70);
    ctx.lineTo(-35, -70);
    ctx.closePath();
    ctx.fill();

    // Crown points
    ctx.beginPath();
    ctx.moveTo(-45, -110);
    ctx.lineTo(-30, -135);
    ctx.lineTo(-15, -110);
    ctx.lineTo(0, -145);
    ctx.lineTo(15, -110);
    ctx.lineTo(30, -135);
    ctx.lineTo(45, -110);
    ctx.fill();

    // Royal Robe
    ctx.fillStyle = suit.isRed ? '#b91c1c' : '#1e3a8a';
    ctx.beginPath();
    ctx.roundRect(-65, -60, 130, 170, [20, 20, 10, 10]);
    ctx.fill();

    // Collar / Gold sash
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(-65, -50);
    ctx.lineTo(0, 30);
    ctx.lineTo(65, -50);
    ctx.lineTo(45, -50);
    ctx.lineTo(0, 10);
    ctx.lineTo(-45, -50);
    ctx.closePath();
    ctx.fill();

    // Suit emblem in center chest
    ctx.fillStyle = color;
    ctx.font = '55px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suit.symbol, 0, -10);

    // Court Title (VALE, KIZ, PAPAZ)
    ctx.font = 'bold 26px "Cinzel", "Georgia", serif';
    ctx.fillStyle = '#d4af37';
    ctx.fillText(card.court.toUpperCase(), 0, 75);

    ctx.restore();
  }

  drawNumberPips(ctx, card, cx, cy, color, suit) {
    const count = parseInt(card.rank, 10);
    const pipSize = count > 8 ? 54 : 64;
    ctx.fillStyle = color;
    ctx.font = `${pipSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Pip layouts for 2 to 10
    const wSpan = 110;
    const hSpan = 240;

    const positions = {
      2: [[0, -hSpan / 2], [0, hSpan / 2]],
      3: [[0, -hSpan / 2], [0, 0], [0, hSpan / 2]],
      4: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      5: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [0, 0], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      6: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [-wSpan / 2, 0], [wSpan / 2, 0], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      7: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [0, -hSpan / 4], [-wSpan / 2, 0], [wSpan / 2, 0], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      8: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [0, -hSpan / 4], [-wSpan / 2, 0], [wSpan / 2, 0], [0, hSpan / 4], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      9: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [-wSpan / 2, -hSpan / 6], [wSpan / 2, -hSpan / 6], [0, 0], [-wSpan / 2, hSpan / 6], [wSpan / 2, hSpan / 6], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      10: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [0, -hSpan / 3], [-wSpan / 2, -hSpan / 6], [wSpan / 2, -hSpan / 6], [-wSpan / 2, hSpan / 6], [wSpan / 2, hSpan / 6], [0, hSpan / 3], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]]
    };

    const pts = positions[count] || [[0, 0]];
    pts.forEach(([px, py]) => {
      ctx.fillText(suit.symbol, cx + px, cy + py);
    });
  }
}

export const cardTexGen = new CardTextureGenerator();

// 3D Physical Card Mesh Generator
export function createCard3DMesh(cardData, isRecommended = false) {
  // Realistic playing card dimensions: ~6.3cm x ~8.8cm (Three.js units: 0.082m x 0.118m x 0.001m)
  const width = 0.082;
  const height = 0.118;
  const depth = 0.0012;

  // Box geometry for card with bevel thickness
  const geometry = new THREE.BoxGeometry(width, height, depth);

  const frontTexture = cardTexGen.getFrontTexture(cardData);
  const backTexture = cardTexGen.getBackTexture();

  let edgeColor = 0xf1f5f9;
  let emissiveColor = 0x000000;
  let emissiveIntensity = 0;

  if (isRecommended) {
    edgeColor = 0xfbbf24;
    emissiveColor = 0xd97706;
    emissiveIntensity = 0.8;
  }

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: edgeColor,
    emissive: emissiveColor,
    emissiveIntensity: emissiveIntensity,
    roughness: 0.7,
    metalness: 0.05
  });

  const frontMaterial = new THREE.MeshStandardMaterial({
    map: frontTexture,
    roughness: 0.35,
    metalness: 0.08,
    bumpScale: 0.0002
  });

  const backMaterial = new THREE.MeshStandardMaterial({
    map: backTexture,
    roughness: 0.35,
    metalness: 0.15
  });

  // Box faces: [right, left, top, bottom, front (+Z), back (-Z)]
  const materials = [
    edgeMaterial,
    edgeMaterial,
    edgeMaterial,
    edgeMaterial,
    frontMaterial,
    backMaterial
  ];

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    card: cardData,
    isCard: true,
    isRecommended,
    originalPosition: new THREE.Vector3(),
    originalRotation: new THREE.Euler(),
    targetPosition: new THREE.Vector3(),
    targetRotation: new THREE.Euler(),
    targetScale: new THREE.Vector3(1, 1, 1),
    isHovered: false,
    isSelected: false,
    faceUp: true
  };

  return mesh;
}
