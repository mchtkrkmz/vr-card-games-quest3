import * as THREE from 'three';

// Gerçekçi Klasik İskambil Kartı Renkleri (Yakut Kırmızı Kupa/Karo, Karbon Siyah Maça/Sinek)
export const SUITS = {
  S: { id: 'S', name: 'Maça', symbol: '♠', color: '#0f172a', secondary: '#1e293b', isRed: false },
  H: { id: 'H', name: 'Kupa', symbol: '♥', color: '#b91c1c', secondary: '#dc2626', isRed: true },
  D: { id: 'D', name: 'Karo', symbol: '♦', color: '#b91c1c', secondary: '#dc2626', isRed: true },
  C: { id: 'C', name: 'Sinek', symbol: '♣', color: '#0f172a', secondary: '#1e293b', isRed: false },
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
  { rank: 'A', value: 14, label: 'A', court: 'As' },
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
        court: r.court || null,
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

// High-Resolution Procedural Linen Playing Card Texture Generator (512x716)
class CardTextureGenerator {
  constructor() {
    this.cache = new Map();
    this.backTexture = null;
  }

  // Vector Bézier Suit Symbols (OS fontlarından bağımsız keskin ve gerçekçi semboller)
  drawSuitSymbol(ctx, suitId, cx, cy, size, fillStyle) {
    ctx.save();
    ctx.translate(cx, cy);
    if (fillStyle) ctx.fillStyle = fillStyle;
    const s = size * 0.5;

    ctx.beginPath();
    if (suitId === 'H') {
      // Kupa (Heart)
      ctx.moveTo(0, s * 0.88);
      ctx.bezierCurveTo(-s * 1.15, s * 0.15, -s * 1.05, -s * 0.92, -s * 0.48, -s * 0.92);
      ctx.bezierCurveTo(-s * 0.16, -s * 0.92, 0, -s * 0.56, 0, -s * 0.36);
      ctx.bezierCurveTo(0, -s * 0.56, s * 0.16, -s * 0.92, s * 0.48, -s * 0.92);
      ctx.bezierCurveTo(s * 1.05, -s * 0.92, s * 1.15, s * 0.15, 0, s * 0.88);
      ctx.closePath();
      ctx.fill();
    } else if (suitId === 'D') {
      // Karo (Diamond - subtly concave luxury casino diamond)
      ctx.moveTo(0, -s * 1.0);
      ctx.quadraticCurveTo(s * 0.32, -s * 0.32, s * 0.82, 0);
      ctx.quadraticCurveTo(s * 0.32, s * 0.32, 0, s * 1.0);
      ctx.quadraticCurveTo(-s * 0.32, s * 0.32, -s * 0.82, 0);
      ctx.quadraticCurveTo(-s * 0.32, -s * 0.32, 0, -s * 1.0);
      ctx.closePath();
      ctx.fill();
    } else if (suitId === 'S') {
      // Maça (Spade)
      ctx.moveTo(0, -s * 1.0);
      ctx.bezierCurveTo(s * 0.22, -s * 0.58, s * 1.04, -s * 0.08, s * 0.92, s * 0.42);
      ctx.bezierCurveTo(s * 0.84, s * 0.72, s * 0.38, s * 0.76, s * 0.14, s * 0.42);
      ctx.quadraticCurveTo(s * 0.14, s * 0.76, s * 0.34, s * 0.98);
      ctx.lineTo(-s * 0.34, s * 0.98);
      ctx.quadraticCurveTo(-s * 0.14, s * 0.76, -s * 0.14, s * 0.42);
      ctx.bezierCurveTo(-s * 0.38, s * 0.76, -s * 0.84, s * 0.72, -s * 0.92, s * 0.42);
      ctx.bezierCurveTo(-s * 1.04, -s * 0.08, -s * 0.22, -s * 0.58, 0, -s * 1.0);
      ctx.closePath();
      ctx.fill();
    } else if (suitId === 'C') {
      // Sinek (Club)
      const rTop = s * 0.40;
      const rSide = s * 0.38;
      ctx.arc(0, -s * 0.44, rTop, 0, Math.PI * 2);
      ctx.moveTo(-s * 0.42 + rSide, s * 0.12);
      ctx.arc(-s * 0.42, s * 0.12, rSide, 0, Math.PI * 2);
      ctx.moveTo(s * 0.42 + rSide, s * 0.12);
      ctx.arc(s * 0.42, s * 0.12, rSide, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-s * 0.12, s * 0.05);
      ctx.lineTo(s * 0.12, s * 0.05);
      ctx.quadraticCurveTo(s * 0.14, s * 0.68, s * 0.34, s * 0.96);
      ctx.lineTo(-s * 0.34, s * 0.96);
      ctx.quadraticCurveTo(-s * 0.14, s * 0.68, -s * 0.12, s * 0.05);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  getBackTexture() {
    if (this.backTexture) return this.backTexture;

    const width = 512;
    const height = 716;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Warm ivory outer margin
    ctx.fillStyle = '#faf7f0';
    ctx.fillRect(0, 0, width, height);

    const m = 22;
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.roundRect(m, m, width - m * 2, height - m * 2, 22);
    ctx.fill();

    // Gold Kem/Bicycle outer & inner frame rings
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#e2b842';
    ctx.beginPath();
    ctx.roundRect(m + 8, m + 8, width - (m + 8) * 2, height - (m + 8) * 2, 16);
    ctx.stroke();

    const cx = width / 2;
    const cy = height / 2;

    const radGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, 270);
    radGrad.addColorStop(0, '#991b1b');
    radGrad.addColorStop(0.6, '#7f1d1d');
    radGrad.addColorStop(1, '#450a0a');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.roundRect(m + 16, m + 16, width - (m + 16) * 2, height - (m + 16) * 2, 12);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(m + 16, m + 16, width - (m + 16) * 2, height - (m + 16) * 2, 12);
    ctx.clip();

    // Fine Ottoman filigree diamond lattice
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.24)';
    ctx.lineWidth = 1.8;
    const step = 24;
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

    // Top & bottom rosette flourishes
    [130, height - 130].forEach((ry) => {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, ry, 42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, ry, 24, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Center golden medallion
    ctx.translate(cx, cy);
    ctx.fillStyle = '#450a0a';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 64, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 28px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KIRAATHANE', 0, -10);

    // 4 crisp vector mini-suits inside medallion
    const miniCols = [-36, -12, 12, 36];
    ['S', 'H', 'D', 'C'].forEach((sId, idx) => {
      this.drawSuitSymbol(ctx, sId, miniCols[idx], 22, 16, '#fbbf24');
    });

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

    // Warm realistic ivory linen card stock
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.5, '#fcfaf4');
    bgGrad.addColorStop(1, '#f4efe4');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle air-cushion linen crosshatch weave
    ctx.strokeStyle = 'rgba(170, 158, 138, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let x = 0; x < width; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Crisp outer hair-line card rim
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#dfd8ca';
    ctx.beginPath();
    ctx.roundRect(5, 5, width - 10, height - 10, 26);
    ctx.stroke();

    const suit = SUITS[card.suit];
    const suitColor = suit.isRed ? '#be123c' : '#0f172a';

    // Oversized razor-sharp corner rank + vector suit indices (always visible in fan)
    const drawCornerIndex = (x, y, angle) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.fillStyle = suitColor;
      ctx.font = '800 66px "Outfit", "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      if (card.rank === '10') {
        ctx.save();
        ctx.scale(0.82, 1.0);
        ctx.fillText('10', 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(card.rank, 0, 0);
      }

      this.drawSuitSymbol(ctx, suit.id, 0, 94, 42, suitColor);
      ctx.restore();
    };

    drawCornerIndex(48, 24, 0);
    drawCornerIndex(width - 48, height - 24, Math.PI);

    const cx = width / 2;
    const cy = height / 2;

    if (['J', 'Q', 'K'].includes(card.rank)) {
      this.drawDoubleHeadedCourtCard(ctx, card, cx, cy, suitColor, suit);
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
    if (suit.id === 'S') {
      // Ornate Classic Ace of Spades filigree ring
      ctx.save();
      ctx.translate(cx, cy - 8);
      ctx.strokeStyle = '#c59b27';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 128, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 118, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      this.drawSuitSymbol(ctx, 'S', cx, cy - 10, 178, color);
    } else {
      this.drawSuitSymbol(ctx, suit.id, cx, cy - 12, 172, color);
    }

    ctx.font = 'bold 24px "Cinzel", Georgia, serif';
    ctx.fillStyle = suit.isRed ? '#9f1239' : '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(suit.name.toUpperCase(), cx, cy + 148);
  }

  drawDoubleHeadedCourtCard(ctx, card, cx, cy, suitColor, suit) {
    const boxW = 292;
    const boxH = 480;
    const left = cx - boxW / 2;
    const top = cy - boxH / 2;

    // Gold inner court frame
    ctx.fillStyle = '#faf6eb';
    ctx.fillRect(left, top, boxW, boxH);

    ctx.strokeStyle = '#c59b27';
    ctx.lineWidth = 4;
    ctx.strokeRect(left, top, boxW, boxH);
    ctx.strokeStyle = suitColor;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(left + 7, top + 7, boxW - 14, boxH - 14);

    // Subtle cream & royal tint halves
    const primaryCoat = suit.isRed ? '#b91c1c' : '#1e3a5f';
    const accentGold = '#eab308';
    const skinTone = '#f3ceb0';
    const hairColor = card.rank === 'Q' ? '#92400e' : (card.rank === 'K' ? '#78716c' : '#334155');

    const drawHalfBust = (isInverted) => {
      ctx.save();
      ctx.translate(cx, cy);
      if (isInverted) ctx.rotate(Math.PI);

      // Clip to top half of court box
      ctx.beginPath();
      ctx.rect(-boxW / 2 + 8, -boxH / 2 + 8, boxW - 16, boxH / 2 - 8);
      ctx.clip();

      // Royal cloak / robe base near divider line
      ctx.fillStyle = primaryCoat;
      ctx.beginPath();
      ctx.roundRect(-84, -84, 168, 96, [28, 28, 0, 0]);
      ctx.fill();

      // Gold geometric diagonal sash & collar
      ctx.fillStyle = accentGold;
      ctx.beginPath();
      ctx.moveTo(-84, -36);
      ctx.lineTo(0, 0);
      ctx.lineTo(84, -52);
      ctx.lineTo(84, -32);
      ctx.lineTo(0, 14);
      ctx.lineTo(-84, -18);
      ctx.closePath();
      ctx.fill();

      // White ermine collar
      ctx.fillStyle = '#fefce8';
      ctx.beginPath();
      ctx.roundRect(-36, -86, 72, 22, 10);
      ctx.fill();

      // Stylized royal portrait head
      ctx.fillStyle = skinTone;
      ctx.beginPath();
      ctx.ellipse(0, -124, 34, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#9a6b4c';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Hair & beard (King has beard, Jack crisp sideburns, Queen long locks)
      ctx.fillStyle = hairColor;
      if (card.rank === 'Q') {
        ctx.beginPath();
        ctx.arc(-28, -118, 16, 0, Math.PI * 2);
        ctx.arc(28, -118, 16, 0, Math.PI * 2);
        ctx.fill();
      } else if (card.rank === 'K') {
        ctx.beginPath();
        ctx.arc(0, -104, 24, 0, Math.PI);
        ctx.fill();
      }

      // Stylized eyes & brow
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-11, -126, 3.2, 0, Math.PI * 2);
      ctx.arc(11, -126, 3.2, 0, Math.PI * 2);
      ctx.fill();

      // Crown or Royal Beret
      ctx.fillStyle = accentGold;
      ctx.beginPath();
      if (card.rank === 'J') {
        // Jack's feathered cap
        ctx.fillStyle = primaryCoat;
        ctx.ellipse(0, -158, 38, 14, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accentGold;
        ctx.fillRect(-34, -155, 68, 8);
      } else {
        ctx.moveTo(-36, -152);
        ctx.lineTo(-26, -184);
        ctx.lineTo(-12, -162);
        ctx.lineTo(0, -192);
        ctx.lineTo(12, -162);
        ctx.lineTo(26, -184);
        ctx.lineTo(36, -152);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#a16207';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Corner inner suit crest inside box
      this.drawSuitSymbol(ctx, suit.id, -104, -188, 38, suitColor);
      ctx.restore();
    };

    drawHalfBust(false);
    drawHalfBust(true);

    // Classic diagonal gold court divider bar
    ctx.save();
    ctx.strokeStyle = '#c59b27';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left + 8, cy);
    ctx.lineTo(left + boxW - 8, cy);
    ctx.stroke();
    ctx.restore();
  }

  drawNumberPips(ctx, card, cx, cy, color, suit) {
    const count = parseInt(card.rank, 10);
    const pipSize = count >= 9 ? 54 : 62;
    const wSpan = 128;
    const hSpan = 266;

    const positions = {
      2: [[0, -hSpan / 2], [0, hSpan / 2]],
      3: [[0, -hSpan / 2], [0, 0], [0, hSpan / 2]],
      4: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      5: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [0, 0], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      6: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [-wSpan / 2, 0], [wSpan / 2, 0], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      7: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [0, -hSpan / 4], [-wSpan / 2, 0], [wSpan / 2, 0], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      8: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [0, -hSpan / 4], [-wSpan / 2, 0], [wSpan / 2, 0], [0, hSpan / 4], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      9: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [-wSpan / 2, -hSpan / 6], [wSpan / 2, -hSpan / 6], [0, 0], [-wSpan / 2, hSpan / 6], [wSpan / 2, hSpan / 6], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
      10: [[-wSpan / 2, -hSpan / 2], [wSpan / 2, -hSpan / 2], [0, -hSpan / 3], [-wSpan / 2, -hSpan / 6], [wSpan / 2, -hSpan / 6], [-wSpan / 2, hSpan / 6], [wSpan / 2, hSpan / 6], [0, hSpan / 3], [-wSpan / 2, hSpan / 2], [wSpan / 2, hSpan / 2]],
    };

    const pts = positions[count] || [[0, 0]];
    pts.forEach(([px, py]) => {
      ctx.save();
      ctx.translate(cx + px, cy + py);
      if (py > 0) ctx.rotate(Math.PI);
      this.drawSuitSymbol(ctx, suit.id, 0, 0, pipSize, color);
      ctx.restore();
    });
  }
}

export const cardTexGen = new CardTextureGenerator();

// Genuine Rounded-Corner 3D Playing Card Geometry (3 Material Groups: Front, Back, Paper Edge)
let SHARED_CARD_GEO = null;
export function getSharedCardGeometry() {
  if (SHARED_CARD_GEO) return SHARED_CARD_GEO;

  const w = 0.092;
  const h = 0.132;
  const r = 0.0072;
  const thickness = 0.0014;
  const hw = w / 2;
  const hh = h / 2;

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const rawGeo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 8,
  });
  rawGeo.translate(0, 0, -thickness / 2);

  const nonIndexed = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo;
  const posAttr = nonIndexed.getAttribute('position');
  const vertCount = posAttr.count;

  const frontPos = [];
  const frontUv = [];
  const backPos = [];
  const backUv = [];
  const edgePos = [];
  const edgeUv = [];

  for (let i = 0; i < vertCount; i += 3) {
    const x0 = posAttr.getX(i), y0 = posAttr.getY(i), z0 = posAttr.getZ(i);
    const x1 = posAttr.getX(i + 1), y1 = posAttr.getY(i + 1), z1 = posAttr.getZ(i + 1);
    const x2 = posAttr.getX(i + 2), y2 = posAttr.getY(i + 2), z2 = posAttr.getZ(i + 2);

    const ax = x1 - x0, ay = y1 - y0, az = z1 - z0;
    const bx = x2 - x0, by = y2 - y0, bz = z2 - z0;
    const fnz = ax * by - ay * bx;
    const fnx = ay * bz - az * by;
    const fny = az * bx - ax * bz;
    const len = Math.hypot(fnx, fny, fnz) || 1;
    const nz = fnz / len;

    if (nz > 0.5) {
      frontPos.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
      frontUv.push(
        (x0 + hw) / w, (y0 + hh) / h,
        (x1 + hw) / w, (y1 + hh) / h,
        (x2 + hw) / w, (y2 + hh) / h
      );
    } else if (nz < -0.5) {
      backPos.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
      backUv.push(
        1 - (x0 + hw) / w, (y0 + hh) / h,
        1 - (x1 + hw) / w, (y1 + hh) / h,
        1 - (x2 + hw) / w, (y2 + hh) / h
      );
    } else {
      edgePos.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
      edgeUv.push(0.5, 0.5, 0.5, 0.5, 0.5, 0.5);
    }
  }

  const allPos = new Float32Array([...frontPos, ...backPos, ...edgePos]);
  const allUv = new Float32Array([...frontUv, ...backUv, ...edgeUv]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(allPos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(allUv, 2));
  geo.computeVertexNormals();

  const frontCount = frontPos.length / 3;
  const backCount = backPos.length / 3;
  const edgeCount = edgePos.length / 3;

  geo.addGroup(0, frontCount, 0);
  geo.addGroup(frontCount, backCount, 1);
  geo.addGroup(frontCount + backCount, edgeCount, 2);

  rawGeo.dispose();
  if (nonIndexed !== rawGeo) nonIndexed.dispose();

  SHARED_CARD_GEO = geo;
  return SHARED_CARD_GEO;
}

const SHARED_EDGE_DEFAULT = new THREE.MeshStandardMaterial({ color: 0xe7e1d6, roughness: 0.72, metalness: 0.02 });
const SHARED_EDGE_REC = new THREE.MeshStandardMaterial({
  color: 0xfbbf24,
  emissive: 0xd97706,
  emissiveIntensity: 0.75,
  roughness: 0.42,
});
let SHARED_BACK_MAT = null;
const CARD_FRONT_MAT_CACHE = new Map();

function getCardMaterials(cardData, isRecommended = false, isDimmed = false) {
  if (!SHARED_BACK_MAT) {
    SHARED_BACK_MAT = new THREE.MeshStandardMaterial({
      map: cardTexGen.getBackTexture(),
      roughness: 0.34,
      metalness: 0.06,
    });
  }

  const key = `${cardData.rank}_${cardData.suit}_${isDimmed ? 'dim' : 'lit'}`;
  let frontMat = CARD_FRONT_MAT_CACHE.get(key);
  if (!frontMat) {
    frontMat = new THREE.MeshStandardMaterial({
      map: cardTexGen.getFrontTexture(cardData),
      color: isDimmed ? 0xbcc4d0 : 0xffffff,
      roughness: 0.34,
      metalness: 0.04,
    });
    CARD_FRONT_MAT_CACHE.set(key, frontMat);
  }

  const edgeMat = isRecommended ? SHARED_EDGE_REC : SHARED_EDGE_DEFAULT;
  return [frontMat, SHARED_BACK_MAT, edgeMat];
}

// 3D Physical Rounded Playing Card Mesh Generator
export function createCard3DMesh(cardData, isRecommended = false, isDimmed = false) {
  const materials = getCardMaterials(cardData, isRecommended, isDimmed);
  const mesh = new THREE.Mesh(getSharedCardGeometry(), materials);
  mesh.castShadow = false;
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
    faceUp: true,
  };

  return mesh;
}
