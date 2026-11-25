import * as THREE from 'three';

// Referans görsele uygun canlı ve gerçekçi Okey Taşı Renkleri
export const OKEY_COLORS = {
  RED: { id: 'RED', name: 'Kırmızı', hex: '#b91c1c', darkHex: '#7f1d1d' },
  BLACK: { id: 'BLACK', name: 'Siyah', hex: '#0b0b0d', darkHex: '#000000' },
  BLUE: { id: 'BLUE', name: 'Mavi', hex: '#2185e8', darkHex: '#155fa8' },
  YELLOW: { id: 'YELLOW', name: 'Sarı', hex: '#eab308', darkHex: '#a16207' },
};

export const ISTAKA_SLOTS_PER_TIER = 15;
export const ISTAKA_TOTAL_TIERS = 2;
export const ISTAKA_SLOT_SPACING = 0.0425;
export const ISTAKA_TIER_COORDS = {
  0: { y: 0.100, z: 0.0065 }, // Üst raf (taş z ∈ [0.0009, 0.0121])
  1: { y: 0.035, z: 0.0085 }, // Alt raf (taş z ∈ [0.0029, 0.0141])
};

export function createOkeyDeck() {
  const deck = [];
  const colorKeys = ['RED', 'BLACK', 'BLUE', 'YELLOW'];

  let uid = 0;
  for (let set = 1; set <= 2; set++) {
    for (const cKey of colorKeys) {
      const color = OKEY_COLORS[cKey];
      for (let num = 1; num <= 13; num++) {
        deck.push({
          id: `tile_${cKey}_${num}_set${set}_${uid++}`,
          colorKey: cKey,
          colorName: color.name,
          colorHex: color.hex,
          number: num,
          isFakeOkey: false,
          isRealOkey: false,
        });
      }
    }
  }

  for (let f = 1; f <= 2; f++) {
    deck.push({
      id: `tile_fake_${f}_${uid++}`,
      colorKey: 'FAKE',
      colorName: 'Sahte Okey',
      colorHex: '#b45309',
      number: 0,
      isFakeOkey: true,
      isRealOkey: false,
    });
  }

  return deck;
}

export function shuffleOkeyDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Procedural Canvas Texture Generator — Polished White Melamine Tiles, Dimple Bump Map & Honey Oak Istaka
class OkeyTextureGenerator {
  constructor() {
    this.cache = new Map();
    this.walnutTexture = null;
    this.honeyOakTexture = null;
    this.backTexture = null;
    this.bumpTexture = null;
  }

  // Bal Meşe / Kayın ahşap damar dokusu (Referans ıstaka görünümü)
  getHoneyOakWoodTexture() {
    if (this.honeyOakTexture) return this.honeyOakTexture;

    const width = 512;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#dea34a');
    grad.addColorStop(0.28, '#cc8930');
    grad.addColorStop(0.62, '#b97522');
    grad.addColorStop(1, '#9c5d16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle horizontal oak fibers
    ctx.strokeStyle = 'rgba(110, 56, 10, 0.32)';
    ctx.lineWidth = 2.0;
    for (let y = 0; y < height; y += 5) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 24) {
        const ny = y + Math.sin(x * 0.03 + y * 0.015) * 2.5 + Math.cos(x * 0.08) * 1.1;
        ctx.lineTo(x, ny);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 232, 185, 0.22)';
    ctx.lineWidth = 1.0;
    for (let y = 2; y < height; y += 9) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 32) {
        const ny = y + Math.sin(x * 0.025 + y * 0.01) * 2.0;
        ctx.lineTo(x, ny);
      }
      ctx.stroke();
    }

    // Subtle engraved center emblem visible between tiles when upper shelf has a gap
    ctx.save();
    ctx.translate(width / 2, height * 0.34);
    ctx.strokeStyle = 'rgba(92, 46, 8, 0.42)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(92, 46, 8, 0.45)';
    ctx.font = 'bold 20px "Outfit", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OKEY', 0, -4);
    ctx.font = 'bold 14px "Outfit", sans-serif';
    ctx.fillText('101 VIP', 0, 16);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    this.honeyOakTexture = texture;
    return texture;
  }

  // Backward-compatible walnut wood texture for card tables
  getWalnutWoodTexture() {
    if (this.walnutTexture) return this.walnutTexture;

    const width = 512;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#6a2e0e');
    grad.addColorStop(0.35, '#853c12');
    grad.addColorStop(0.7, '#5c260a');
    grad.addColorStop(1, '#3e1805');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(40, 14, 2, 0.55)';
    ctx.lineWidth = 2.8;
    for (let y = 0; y < height; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 24) {
        const ny = y + Math.sin(x * 0.04 + y * 0.015) * 4 + Math.cos(x * 0.07) * 2;
        ctx.lineTo(x, ny);
      }
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    this.walnutTexture = texture;
    return texture;
  }

  // 3D Concave Dimple Height/Bump Map for realistic light reflection on every tile
  getTileBumpTexture() {
    if (this.bumpTexture) return this.bumpTexture;

    const width = 256;
    const height = 360;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Neutral flat surface height
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, width, height);

    // Subtle outer bevel slope
    ctx.strokeStyle = '#9a9a9a';
    ctx.lineWidth = 10;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // Concave finger dimple in the lower half (cy = 266)
    const cx = width / 2;
    const cy = Math.round(height * 0.74);
    const dimpleR = 38;
    const rad = ctx.createRadialGradient(cx, cy, 4, cx, cy, dimpleR);
    rad.addColorStop(0, '#3a3a3a');    // Deepest center
    rad.addColorStop(0.55, '#686868');
    rad.addColorStop(0.88, '#bababa');
    rad.addColorStop(1, '#d8d8d8');    // Flush with surface
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(cx, cy, dimpleR, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    this.bumpTexture = tex;
    return tex;
  }

  // Crisp glossy white melamine front face matching reference photo
  getTileFrontTexture(tile) {
    const okeyTag = tile.isRealOkey ? '_OKEY' : '';
    const key = tile.isFakeOkey ? `FAKE_OKEY${okeyTag}` : `${tile.colorKey}_${tile.number}${okeyTag}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const width = 384;
    const height = 540;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const cx = width / 2;
    const numY = Math.round(height * 0.34);
    const dimpleY = Math.round(height * 0.74);

    // 1. Glossy white melamine stone base with subtle cool studio sheen
    const bgGrad = ctx.createLinearGradient(0, 0, width * 0.7, height);
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(0.52, '#f9fafb');
    bgGrad.addColorStop(1, '#eceef2');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Soft bevel shading frame around perimeter
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.55)';
    ctx.strokeRect(4, 4, width - 8, height - 8);

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeRect(12, 12, width - 24, height - 24);

    // Subtle diagonal light sheen on stone face
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.52);
    ctx.lineTo(width, height * 0.36);
    ctx.lineTo(width, height * 0.54);
    ctx.lineTo(0, height * 0.70);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (tile.isFakeOkey) {
      const goldGrad = ctx.createLinearGradient(cx - 56, numY - 56, cx + 56, numY + 56);
      goldGrad.addColorStop(0, '#fde047');
      goldGrad.addColorStop(0.5, '#d97706');
      goldGrad.addColorStop(1, '#92400e');

      ctx.fillStyle = goldGrad;
      ctx.beginPath();
      ctx.arc(cx, numY + 12, 62, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', cx, numY + 14);

      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 28px "Outfit", "Segoe UI", sans-serif';
      ctx.fillText('SAHTE OKEY', cx, numY + 98);
    } else {
      const color = OKEY_COLORS[tile.colorKey] || OKEY_COLORS.BLACK;
      const numStr = `${tile.number}`;
      const isTwoDigit = tile.number >= 10;

      // 2. Bold clean numeral in upper half (sized neatly so 10-13 never clip edges)
      ctx.save();
      ctx.font = `900 ${isTwoDigit ? 168 : 190}px "Outfit", "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.shadowColor = 'rgba(0, 0, 0, 0.16)';
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;
      ctx.shadowBlur = 4;

      ctx.fillStyle = color.hex;
      ctx.fillText(numStr, cx, numY);
      ctx.restore();

      // Subtle outline for yellow/bright ink contrast on white melamine
      if (tile.colorKey === 'YELLOW' || tile.colorKey === 'BLUE') {
        ctx.save();
        ctx.font = `900 ${isTwoDigit ? 168 : 190}px "Outfit", "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = color.darkHex;
        ctx.lineWidth = tile.colorKey === 'YELLOW' ? 3 : 1.5;
        ctx.strokeText(numStr, cx, numY);
        ctx.restore();
      }
    }

    // Active Real Okey corner prestige star (unobtrusive, clear in VR)
    if (tile.isRealOkey) {
      ctx.save();
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', width - 48, 46);
      ctx.restore();
    }

    // 3. Authentic Molded Circular Dimple (3D oyuk) in lower half — matching reference photo!
    const dimpleR = 46;
    ctx.save();
    // Recessed concave shade (darker at top-left where overhead light casts shadow into well, lighter at bottom-right lip)
    const dimpleGrad = ctx.createRadialGradient(cx + 6, dimpleY + 8, 4, cx, dimpleY, dimpleR);
    dimpleGrad.addColorStop(0, '#f3f4f6');
    dimpleGrad.addColorStop(0.55, '#e2e5ea');
    dimpleGrad.addColorStop(0.88, '#c5cbd4');
    dimpleGrad.addColorStop(1, '#d9dde3');

    ctx.fillStyle = dimpleGrad;
    ctx.beginPath();
    ctx.arc(cx, dimpleY, dimpleR, 0, Math.PI * 2);
    ctx.fill();

    // Top inner shadow crescent
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, dimpleY, dimpleR - 1, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // Bottom catchlight crescent
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx, dimpleY, dimpleR - 1, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    this.cache.set(key, texture);
    return texture;
  }

  getTileBackTexture() {
    if (this.backTexture) return this.backTexture;

    const width = 256;
    const height = 360;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#f3f4f6');
    grad.addColorStop(1, '#e5e7eb');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 8;
    ctx.strokeStyle = '#d1d5db';
    ctx.strokeRect(6, 6, width - 12, height - 12);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.backTexture = texture;
    return texture;
  }
}

export const okeyTexGen = new OkeyTextureGenerator();

// Shared 3D Rounded Beveled Extrude Geometry for Realistic Okey Tiles (3 material groups: front, bevel/sides, back)
let SHARED_TILE_GEO = null;

export function createRoundedBeveledTileGeometry() {
  const innerW = 0.0374;
  const innerH = 0.0544;
  const r = 0.0040;
  const hw = innerW / 2;
  const hh = innerH / 2;

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

  const bevelSize = 0.0018;
  const bevelThickness = 0.0018;
  const extrudeGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0076,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize,
    bevelThickness,
    curveSegments: 6,
  });

  extrudeGeo.center();
  const geo = extrudeGeo.index ? extrudeGeo.toNonIndexed() : extrudeGeo;

  const posAttr = geo.attributes.position;
  const normAttr = geo.attributes.normal;
  const uvAttr = geo.attributes.uv;

  const totalW = innerW + bevelSize * 2;
  const totalH = innerH + bevelSize * 2;

  const frontPos = [];
  const frontNorm = [];
  const frontUv = [];
  const sidePos = [];
  const sideNorm = [];
  const sideUv = [];
  const backPos = [];
  const backNorm = [];
  const backUv = [];

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const faceN = new THREE.Vector3();

  for (let i = 0; i < posAttr.count; i += 3) {
    a.fromBufferAttribute(posAttr, i);
    b.fromBufferAttribute(posAttr, i + 1);
    c.fromBufferAttribute(posAttr, i + 2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    faceN.crossVectors(ab, ac).normalize();

    let bucketPos = sidePos;
    let bucketNorm = sideNorm;
    let bucketUv = sideUv;
    let faceMode = 1; // 0 = front, 1 = side/bevel, 2 = back

    if (faceN.z > 0.92) {
      bucketPos = frontPos;
      bucketNorm = frontNorm;
      bucketUv = frontUv;
      faceMode = 0;
    } else if (faceN.z < -0.92) {
      bucketPos = backPos;
      bucketNorm = backNorm;
      bucketUv = backUv;
      faceMode = 2;
    }

    for (let k = 0; k < 3; k++) {
      const idx = i + k;
      const vx = posAttr.getX(idx);
      const vy = posAttr.getY(idx);
      const vz = posAttr.getZ(idx);
      bucketPos.push(vx, vy, vz);
      bucketNorm.push(normAttr.getX(idx), normAttr.getY(idx), normAttr.getZ(idx));

      if (faceMode === 0) {
        const u = THREE.MathUtils.clamp((vx + totalW / 2) / totalW, 0, 1);
        const v = THREE.MathUtils.clamp((vy + totalH / 2) / totalH, 0, 1);
        bucketUv.push(u, v);
      } else if (faceMode === 2) {
        const u = 1 - THREE.MathUtils.clamp((vx + totalW / 2) / totalW, 0, 1);
        const v = THREE.MathUtils.clamp((vy + totalH / 2) / totalH, 0, 1);
        bucketUv.push(u, v);
      } else {
        bucketUv.push(uvAttr.getX(idx), uvAttr.getY(idx));
      }
    }
  }

  const mergedPos = new Float32Array(frontPos.length + sidePos.length + backPos.length);
  mergedPos.set(frontPos, 0);
  mergedPos.set(sidePos, frontPos.length);
  mergedPos.set(backPos, frontPos.length + sidePos.length);

  const mergedNorm = new Float32Array(frontNorm.length + sideNorm.length + backNorm.length);
  mergedNorm.set(frontNorm, 0);
  mergedNorm.set(sideNorm, frontNorm.length);
  mergedNorm.set(backNorm, frontNorm.length + sideNorm.length);

  const mergedUv = new Float32Array(frontUv.length + sideUv.length + backUv.length);
  mergedUv.set(frontUv, 0);
  mergedUv.set(sideUv, frontUv.length);
  mergedUv.set(backUv, frontUv.length + sideUv.length);

  const finalGeo = new THREE.BufferGeometry();
  finalGeo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
  finalGeo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
  finalGeo.setAttribute('uv', new THREE.BufferAttribute(mergedUv, 2));

  const frontVertCount = frontPos.length / 3;
  const sideVertCount = sidePos.length / 3;
  const backVertCount = backPos.length / 3;

  finalGeo.clearGroups();
  finalGeo.addGroup(0, frontVertCount, 0);
  finalGeo.addGroup(frontVertCount, sideVertCount, 1);
  finalGeo.addGroup(frontVertCount + sideVertCount, backVertCount, 2);

  if (extrudeGeo !== finalGeo) extrudeGeo.dispose();
  return finalGeo;
}

export function getSharedTileGeometry() {
  if (!SHARED_TILE_GEO) {
    SHARED_TILE_GEO = createRoundedBeveledTileGeometry();
  }
  return SHARED_TILE_GEO;
}

// Material Cache for Okey Tiles (Zero GPU Leaks + Glossy Melamine Finish)
const SHARED_TILE_SIDE_DEFAULT = new THREE.MeshStandardMaterial({
  color: 0xf4f4f6,
  roughness: 0.18,
  metalness: 0.04,
  envMapIntensity: 1.2,
});
const SHARED_TILE_SIDE_SELECTED = new THREE.MeshStandardMaterial({
  color: 0x22c55e,
  emissive: 0x15803d,
  emissiveIntensity: 0.7,
  roughness: 0.22,
});
const SHARED_TILE_SIDE_OKEY = new THREE.MeshStandardMaterial({
  color: 0xfde047,
  emissive: 0xd97706,
  emissiveIntensity: 0.55,
  roughness: 0.2,
});
const SHARED_TILE_SIDE_REC = new THREE.MeshStandardMaterial({
  color: 0xfbbf24,
  emissive: 0xd97706,
  emissiveIntensity: 0.65,
  roughness: 0.22,
});

let SHARED_TILE_BACK_MAT = null;
const TILE_FRONT_MAT_CACHE = new Map();

function getTileMaterials(tileData, isSelected, isRecommended) {
  if (!SHARED_TILE_BACK_MAT) {
    SHARED_TILE_BACK_MAT = new THREE.MeshStandardMaterial({
      map: okeyTexGen.getTileBackTexture(),
      roughness: 0.22,
      metalness: 0.03,
      envMapIntensity: 1.15,
    });
  }

  const okeyTag = tileData.isRealOkey ? '_OKEY' : '';
  const key = tileData.isFakeOkey ? `FAKE_OKEY${okeyTag}` : `${tileData.colorKey}_${tileData.number}${okeyTag}`;
  let frontMat = TILE_FRONT_MAT_CACHE.get(key);
  if (!frontMat) {
    frontMat = new THREE.MeshStandardMaterial({
      map: okeyTexGen.getTileFrontTexture(tileData),
      bumpMap: okeyTexGen.getTileBumpTexture(),
      bumpScale: 0.0024,
      roughness: 0.16,
      metalness: 0.04,
      envMapIntensity: 1.25,
    });
    TILE_FRONT_MAT_CACHE.set(key, frontMat);
  }

  let sideMat = SHARED_TILE_SIDE_DEFAULT;
  if (isSelected) sideMat = SHARED_TILE_SIDE_SELECTED;
  else if (tileData.isRealOkey) sideMat = SHARED_TILE_SIDE_OKEY;
  else if (isRecommended) sideMat = SHARED_TILE_SIDE_REC;

  // Material groups: [0 = Front Face, 1 = Rounded Bevel Sides, 2 = Back Face]
  return [frontMat, sideMat, SHARED_TILE_BACK_MAT];
}

// 3D Realistic Beveled Melamine Tile Mesh
export function createOkeyTile3DMesh(tileData, isSelected = false, isRecommended = false) {
  const materials = getTileMaterials(tileData, isSelected, isRecommended);
  const mesh = new THREE.Mesh(getSharedTileGeometry(), materials);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData = {
    tile: tileData,
    isOkeyTile: true,
    isSelected,
    isRecommended,
    originalY: 0,
    rackSlot: null,
    tier: 0,
    slotIndex: 0,
  };

  return mesh;
}

// 3D Realistic Honey Oak Wood + Brushed Metal End-Cap Istaka (15 slots × 2 tiers, 100% open face)
export function createIstaka3DMesh() {
  const istakaGroup = new THREE.Group();

  const width = 0.675;
  const oakTex = okeyTexGen.getHoneyOakWoodTexture();
  const woodMaterial = new THREE.MeshStandardMaterial({
    map: oakTex,
    roughness: 0.36,
    metalness: 0.08,
    envMapIntensity: 1.15,
  });
  const shelfShadeMat = new THREE.MeshStandardMaterial({
    color: 0x6b370b,
    roughness: 0.55,
    metalness: 0.05,
  });
  const brushedMetalMat = new THREE.MeshStandardMaterial({
    color: 0xdce2e8,
    metalness: 0.85,
    roughness: 0.24,
    envMapIntensity: 1.4,
  });

  // 1. Single Slim Honey-Oak Backboard (Stones sit completely in front of z = 0!)
  const backboard = new THREE.Mesh(new THREE.BoxGeometry(width, 0.136, 0.014), woodMaterial);
  backboard.position.set(0, 0.068, -0.007);
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  istakaGroup.add(backboard);

  // 2. Top Trim Rail
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.006, 0.022), woodMaterial);
  topRail.position.set(0, 0.133, 0.001);
  istakaGroup.add(topRail);

  // 3. Middle Shelf Divider + Crisp Shadow Groove
  const midLedge = new THREE.Mesh(new THREE.BoxGeometry(width, 0.006, 0.026), woodMaterial);
  midLedge.position.set(0, 0.067, 0.002);
  midLedge.receiveShadow = true;
  istakaGroup.add(midLedge);

  const midGroove = new THREE.Mesh(new THREE.BoxGeometry(width - 0.004, 0.0025, 0.006), shelfShadeMat);
  midGroove.position.set(0, 0.0635, 0.008);
  istakaGroup.add(midGroove);

  // 4. Bottom Shelf Base + Ultra-Low 3mm Retaining Lip (never hides tile faces!)
  const bottomShelf = new THREE.Mesh(new THREE.BoxGeometry(width, 0.006, 0.030), woodMaterial);
  bottomShelf.position.set(0, 0.003, 0.003);
  bottomShelf.castShadow = true;
  bottomShelf.receiveShadow = true;
  istakaGroup.add(bottomShelf);

  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(width - 0.004, 0.003, 0.004), woodMaterial);
  frontLip.position.set(0, 0.0075, 0.016);
  istakaGroup.add(frontLip);

  // 5. Rear Desk Support Props so tilted Istaka rests authentically on table
  const propGeo = new THREE.BoxGeometry(0.026, 0.018, 0.036);
  [-0.22, 0.22].forEach((px) => {
    const prop = new THREE.Mesh(propGeo, shelfShadeMat);
    prop.position.set(px, 0.012, -0.028);
    istakaGroup.add(prop);
  });

  // 6. Brushed Stainless/Aluminum End Caps on Left & Right ends
  const endCapGeo = new THREE.BoxGeometry(0.012, 0.138, 0.034);
  const endBoltGeo = new THREE.CylinderGeometry(0.0026, 0.0026, 0.003, 10);
  [-width / 2 - 0.006, width / 2 + 0.006].forEach((x) => {
    const cap = new THREE.Mesh(endCapGeo, brushedMetalMat);
    cap.position.set(x, 0.068, 0.002);
    cap.castShadow = true;
    istakaGroup.add(cap);

    const rivetTop = new THREE.Mesh(endBoltGeo, brushedMetalMat);
    rivetTop.rotation.x = Math.PI / 2;
    rivetTop.position.set(x, 0.122, 0.019);
    istakaGroup.add(rivetTop);
  });

  return istakaGroup;
}

// Referans fotoğraftaki birebir taş dizilimi:
// Üst sıra: Kırmızı 11-12-13 | boş | Kırmızı 9-10-11 | boş | Sarı 6-7-8 | boş | Sarı 3, Siyah 3, Kırmızı 3
// Alt sıra: Sarı 11-12, Siyah 6-8, Mavi 6-9-10, Kırmızı 5-7
export function createPhotoDemoHand() {
  return [
    // Üst Sıra (Tier 0)
    { id: 'demo_r_11', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#b91c1c', number: 11, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 0 },
    { id: 'demo_r_12', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#b91c1c', number: 12, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 1 },
    { id: 'demo_r_13', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#b91c1c', number: 13, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 2 },

    { id: 'demo_r_9', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#b91c1c', number: 9, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 4 },
    { id: 'demo_r_10', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#b91c1c', number: 10, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 5 },
    { id: 'demo_r_11b', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#b91c1c', number: 11, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 6 },

    { id: 'demo_y_6', colorKey: 'YELLOW', colorName: 'Sarı', colorHex: '#eab308', number: 6, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 8 },
    { id: 'demo_y_7', colorKey: 'YELLOW', colorName: 'Sarı', colorHex: '#eab308', number: 7, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 9 },
    { id: 'demo_y_8', colorKey: 'YELLOW', colorName: 'Sarı', colorHex: '#eab308', number: 8, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 10 },

    { id: 'demo_y_3', colorKey: 'YELLOW', colorName: 'Sarı', colorHex: '#eab308', number: 3, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 12 },
    { id: 'demo_k_3', colorKey: 'BLACK', colorName: 'Siyah', colorHex: '#0b0b0d', number: 3, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 13 },
    { id: 'demo_r_3', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#b91c1c', number: 3, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 14 },

    // Alt Sıra (Tier 1)
    { id: 'demo_y_11', colorKey: 'YELLOW', colorName: 'Sarı', colorHex: '#eab308', number: 11, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 0 },
    { id: 'demo_y_12', colorKey: 'YELLOW', colorName: 'Sarı', colorHex: '#eab308', number: 12, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 1 },
    { id: 'demo_k_6', colorKey: 'BLACK', colorName: 'Siyah', colorHex: '#0b0b0d', number: 6, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 2 },
    { id: 'demo_k_8', colorKey: 'BLACK', colorName: 'Siyah', colorHex: '#0b0b0d', number: 8, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 3 },
    { id: 'demo_b_6', colorKey: 'BLUE', colorName: 'Mavi', colorHex: '#2185e8', number: 6, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 4 },
    { id: 'demo_b_9', colorKey: 'BLUE', colorName: 'Mavi', colorHex: '#2185e8', number: 9, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 5 },
    { id: 'demo_b_10', colorKey: 'BLUE', colorName: 'Mavi', colorHex: '#2185e8', number: 10, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 6 },
    { id: 'demo_r_5', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#b91c1c', number: 5, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 7 },
    { id: 'demo_r_7', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#b91c1c', number: 7, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 8 },
  ];
}

export function findFirstFreeIstakaSlot(handTiles) {
  const occupied = new Set();
  for (const t of handTiles) {
    if (typeof t._istakaTier === 'number' && typeof t._istakaSlot === 'number') {
      occupied.add(`${t._istakaTier}_${t._istakaSlot}`);
    }
  }
  for (const tier of [0, 1]) {
    for (let slot = 0; slot < ISTAKA_SLOTS_PER_TIER; slot++) {
      if (!occupied.has(`${tier}_${slot}`)) {
        return { tier, slot };
      }
    }
  }
  return { tier: 1, slot: ISTAKA_SLOTS_PER_TIER - 1 };
}

export function moveTileToIstakaSlot(handTiles, tileId, targetTier, targetSlot) {
  const tile = handTiles.find((t) => t.id === tileId);
  if (!tile) return false;

  const clampedTier = targetTier === 0 ? 0 : 1;
  const clampedSlot = Math.max(0, Math.min(ISTAKA_SLOTS_PER_TIER - 1, targetSlot));

  const occupant = handTiles.find(
    (t) => t.id !== tileId && t._istakaTier === clampedTier && t._istakaSlot === clampedSlot
  );

  if (!occupant) {
    tile._istakaTier = clampedTier;
    tile._istakaSlot = clampedSlot;
    return true;
  }

  const rowTiles = handTiles.filter((t) => t.id !== tileId && t._istakaTier === clampedTier);
  const occupiedInRow = new Set(rowTiles.map((t) => t._istakaSlot));

  let emptyRight = -1;
  for (let s = clampedSlot + 1; s < ISTAKA_SLOTS_PER_TIER; s++) {
    if (!occupiedInRow.has(s)) {
      emptyRight = s;
      break;
    }
  }
  if (emptyRight !== -1) {
    for (const rt of rowTiles) {
      if (rt._istakaSlot >= clampedSlot && rt._istakaSlot < emptyRight) {
        rt._istakaSlot += 1;
      }
    }
    tile._istakaTier = clampedTier;
    tile._istakaSlot = clampedSlot;
    return true;
  }

  let emptyLeft = -1;
  for (let s = clampedSlot - 1; s >= 0; s--) {
    if (!occupiedInRow.has(s)) {
      emptyLeft = s;
      break;
    }
  }
  if (emptyLeft !== -1) {
    for (const rt of rowTiles) {
      if (rt._istakaSlot <= clampedSlot && rt._istakaSlot > emptyLeft) {
        rt._istakaSlot -= 1;
      }
    }
    tile._istakaTier = clampedTier;
    tile._istakaSlot = clampedSlot;
    return true;
  }

  const prevTier = tile._istakaTier;
  const prevSlot = tile._istakaSlot;
  tile._istakaTier = clampedTier;
  tile._istakaSlot = clampedSlot;
  occupant._istakaTier = typeof prevTier === 'number' ? prevTier : clampedTier === 0 ? 1 : 0;
  occupant._istakaSlot = typeof prevSlot === 'number' ? prevSlot : findFirstFreeIstakaSlot(handTiles).slot;
  return true;
}

export function syncHandIstakaSlots(handTiles, previousHand = []) {
  const prevMap = new Map();
  for (const pt of previousHand) {
    if (pt?.id && typeof pt._istakaTier === 'number' && typeof pt._istakaSlot === 'number') {
      prevMap.set(pt.id, { tier: pt._istakaTier, slot: pt._istakaSlot });
    }
  }

  const needsAssign = [];
  for (const t of handTiles) {
    if (typeof t._istakaTier === 'number' && typeof t._istakaSlot === 'number') continue;
    const saved = prevMap.get(t.id);
    if (saved) {
      t._istakaTier = saved.tier;
      t._istakaSlot = Math.min(ISTAKA_SLOTS_PER_TIER - 1, saved.slot);
    } else {
      needsAssign.push(t);
    }
  }

  for (const t of needsAssign) {
    const free = findFirstFreeIstakaSlot(handTiles);
    t._istakaTier = free.tier;
    t._istakaSlot = free.slot;
  }

  return handTiles;
}

// Places complete pers/runs on upper tier with clear 1-slot gaps (like reference photo) and remaining tiles on lower tier
export function arrangeHandTilesOnIstaka(handTiles, forceSort = false) {
  if (!handTiles || handTiles.length === 0) return handTiles;

  const hasExistingSlots = handTiles.every(
    (t) => typeof t._istakaSlot === 'number' && typeof t._istakaTier === 'number'
  );
  if (hasExistingSlots && !forceSort) {
    return handTiles;
  }

  const okeys = handTiles.filter((t) => t.isRealOkey);
  const regularTiles = handTiles.filter((t) => !t.isRealOkey);

  const runs = [];
  const sets = [];
  const pairs = [];
  const usedIds = new Set();

  const colorMap = { RED: [], BLACK: [], BLUE: [], YELLOW: [] };
  regularTiles.forEach((t) => {
    if (colorMap[t.colorKey]) colorMap[t.colorKey].push(t);
  });

  for (const cKey in colorMap) {
    const sorted = [...colorMap[cKey]].sort((a, b) => a.number - b.number);
    let curRun = [];
    for (let i = 0; i < sorted.length; i++) {
      const tile = sorted[i];
      if (curRun.length === 0) {
        curRun.push(tile);
      } else {
        const last = curRun[curRun.length - 1];
        if (tile.number === last.number + 1) {
          curRun.push(tile);
        } else if (tile.number !== last.number) {
          if (curRun.length >= 3) {
            runs.push([...curRun]);
            curRun.forEach((t) => usedIds.add(t.id));
          }
          curRun = [tile];
        }
      }
    }
    if (curRun.length >= 3) {
      runs.push([...curRun]);
      curRun.forEach((t) => usedIds.add(t.id));
    }
  }

  runs.sort((a, b) => b.length - a.length);

  const numMap = {};
  regularTiles.forEach((t) => {
    if (!usedIds.has(t.id)) {
      if (!numMap[t.number]) numMap[t.number] = [];
      if (!numMap[t.number].some((existing) => existing.colorKey === t.colorKey)) {
        numMap[t.number].push(t);
      }
    }
  });

  for (const num in numMap) {
    if (numMap[num].length >= 3) {
      sets.push([...numMap[num]]);
      numMap[num].forEach((t) => usedIds.add(t.id));
    }
  }

  const pairMap = {};
  regularTiles.forEach((t) => {
    if (!usedIds.has(t.id)) {
      if (!pairMap[t.number]) pairMap[t.number] = [];
      pairMap[t.number].push(t);
    }
  });

  for (const num in pairMap) {
    if (pairMap[num].length >= 2) {
      const pairGroup = pairMap[num].slice(0, 2);
      pairs.push(pairGroup);
      pairGroup.forEach((t) => usedIds.add(t.id));
    }
  }

  const orphans = regularTiles.filter((t) => !usedIds.has(t.id));

  // Distribute complete pers cleanly to Top Tier (Tier 0, 15 slots) and waiting/orphans to Bottom Tier (Tier 1, 15 slots)
  const completedGroups = [...runs, ...sets];
  const waitingGroups = [...pairs];
  if (okeys.length > 0) waitingGroups.unshift(okeys);

  const tier0Groups = [];
  const tier1Groups = [];
  let t0Len = 0;
  let t1Len = 0;

  for (const grp of completedGroups) {
    const gap0 = tier0Groups.length > 0 ? 1 : 0;
    if (t0Len + gap0 + grp.length <= ISTAKA_SLOTS_PER_TIER) {
      tier0Groups.push(grp);
      t0Len += gap0 + grp.length;
    } else {
      tier1Groups.push(grp);
      t1Len += (tier1Groups.length > 1 ? 1 : 0) + grp.length;
    }
  }

  for (const grp of waitingGroups) {
    const gap1 = tier1Groups.length > 0 ? 1 : 0;
    if (t1Len + gap1 + grp.length <= ISTAKA_SLOTS_PER_TIER) {
      tier1Groups.push(grp);
      t1Len += gap1 + grp.length;
    } else {
      tier0Groups.push(grp);
      t0Len += (tier0Groups.length > 1 ? 1 : 0) + grp.length;
    }
  }

  for (const orphan of orphans) {
    if (t1Len < ISTAKA_SLOTS_PER_TIER) {
      if (!tier1Groups._hasOrphanBucket) {
        tier1Groups.push([orphan]);
        tier1Groups._hasOrphanBucket = true;
        t1Len += 1;
      } else {
        tier1Groups[tier1Groups.length - 1].push(orphan);
        t1Len += 1;
      }
    } else {
      if (!tier0Groups._hasOrphanBucket) {
        tier0Groups.push([orphan]);
        tier0Groups._hasOrphanBucket = true;
        t0Len += 1;
      } else {
        tier0Groups[tier0Groups.length - 1].push(orphan);
        t0Len += 1;
      }
    }
  }

  const occupied = new Set();
  function assignTier(groups, tier) {
    let cur = 0;
    const totalNeeded = groups.reduce((s, g) => s + g.length, 0) + Math.max(0, groups.length - 1);
    const useGaps = totalNeeded <= ISTAKA_SLOTS_PER_TIER;

    groups.forEach((grp, gIdx) => {
      grp.forEach((t) => {
        if (cur < ISTAKA_SLOTS_PER_TIER) {
          t._istakaTier = tier;
          t._istakaSlot = cur;
          occupied.add(`${tier}_${cur}`);
          cur++;
        } else {
          for (const altTier of [tier === 0 ? 1 : 0, tier]) {
            let placed = false;
            for (let s = 0; s < ISTAKA_SLOTS_PER_TIER; s++) {
              if (!occupied.has(`${altTier}_${s}`)) {
                t._istakaTier = altTier;
                t._istakaSlot = s;
                occupied.add(`${altTier}_${s}`);
                placed = true;
                break;
              }
            }
            if (placed) break;
          }
        }
      });
      if (useGaps && gIdx < groups.length - 1 && cur < ISTAKA_SLOTS_PER_TIER) {
        cur++;
      }
    });
  }

  assignTier(tier0Groups, 0);
  assignTier(tier1Groups, 1);

  return handTiles;
}

// Assign sequential Istaka slots without sorting/grouping (for non-member guests)
export function assignRawIstakaSlots(handTiles) {
  if (!handTiles || handTiles.length === 0) return handTiles;

  const occupied = new Set();
  for (const t of handTiles) {
    if (
      typeof t._istakaTier === 'number' &&
      typeof t._istakaSlot === 'number' &&
      t._istakaTier >= 0 &&
      t._istakaTier < ISTAKA_TOTAL_TIERS &&
      t._istakaSlot >= 0 &&
      t._istakaSlot < ISTAKA_SLOTS_PER_TIER
    ) {
      occupied.add(`${t._istakaTier}_${t._istakaSlot}`);
    }
  }

  for (const t of handTiles) {
    if (
      typeof t._istakaTier === 'number' &&
      typeof t._istakaSlot === 'number' &&
      t._istakaTier >= 0 &&
      t._istakaTier < ISTAKA_TOTAL_TIERS &&
      t._istakaSlot >= 0 &&
      t._istakaSlot < ISTAKA_SLOTS_PER_TIER
    ) {
      continue;
    }

    let placed = false;
    for (let tier = 0; tier < ISTAKA_TOTAL_TIERS && !placed; tier++) {
      for (let slot = 0; slot < ISTAKA_SLOTS_PER_TIER; slot++) {
        if (!occupied.has(`${tier}_${slot}`)) {
          t._istakaTier = tier;
          t._istakaSlot = slot;
          occupied.add(`${tier}_${slot}`);
          placed = true;
          break;
        }
      }
    }
  }

  return handTiles;
}
