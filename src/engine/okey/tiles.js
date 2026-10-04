import * as THREE from 'three';

export const OKEY_COLORS = {
  RED: { id: 'RED', name: 'Kırmızı', hex: '#dc2626', darkHex: '#991b1b', shadow: 'rgba(153, 27, 27, 0.4)' },
  BLACK: { id: 'BLACK', name: 'Siyah', hex: '#111827', darkHex: '#030712', shadow: 'rgba(0, 0, 0, 0.45)' },
  BLUE: { id: 'BLUE', name: 'Mavi', hex: '#1d4ed8', darkHex: '#1e40af', shadow: 'rgba(30, 64, 175, 0.4)' },
  YELLOW: { id: 'YELLOW', name: 'Sarı', hex: '#d97706', darkHex: '#b45309', shadow: 'rgba(180, 83, 9, 0.4)' }
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
          isRealOkey: false
        });
      }
    }
  }

  deck.push({
    id: `tile_fake_1_${uid++}`,
    colorKey: 'FAKE',
    colorName: 'Sahte Okey',
    colorHex: '#d4af37',
    number: 0,
    isFakeOkey: true,
    isRealOkey: false
  });

  deck.push({
    id: `tile_fake_2_${uid++}`,
    colorKey: 'FAKE',
    colorName: 'Sahte Okey',
    colorHex: '#d4af37',
    number: 0,
    isFakeOkey: true,
    isRealOkey: false
  });

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

// Procedural Canvas Texture Generator for Heavy Melamine Tiles & Walnut Istaka
class OkeyTextureGenerator {
  constructor() {
    this.cache = new Map();
    this.walnutTexture = null;
    this.backTexture = null;
  }

  // Authentic Turkish Walnut Wood Grain Texture for Istakas
  getWalnutWoodTexture() {
    if (this.walnutTexture) return this.walnutTexture;

    const width = 512;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Rich warm walnut base
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#381e11');
    grad.addColorStop(0.5, '#2e180d');
    grad.addColorStop(1, '#241209');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Natural wavy wood grain lines
    ctx.strokeStyle = 'rgba(74, 40, 24, 0.45)';
    ctx.lineWidth = 3;
    for (let y = 0; y < height; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 32) {
        const ny = y + Math.sin(x * 0.03 + y * 0.02) * 6 + Math.cos(x * 0.08) * 3;
        ctx.lineTo(x, ny);
      }
      ctx.stroke();
    }

    // Dark walnut growth rings & pores
    ctx.strokeStyle = 'rgba(15, 8, 4, 0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 20; i++) {
      const rx = Math.random() * width;
      ctx.beginPath();
      ctx.ellipse(rx, height / 2, 20 + Math.random() * 40, 180 + Math.random() * 100, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    this.walnutTexture = texture;
    return texture;
  }

  // Realistic Melamine Bone Tile Front
  getTileFrontTexture(tile) {
    const key = tile.isFakeOkey ? 'FAKE_OKEY' : `${tile.colorKey}_${tile.number}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const width = 512;
    const height = 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Heavy Melamine Bone / Ivory Plastic Base with subtle radial highlight
    const cx = width / 2;
    const cy = height / 2;
    const radGrad = ctx.createRadialGradient(cx, cy - 60, 40, cx, cy, 380);
    radGrad.addColorStop(0, '#ffffff');
    radGrad.addColorStop(0.6, '#f8f4ec');
    radGrad.addColorStop(1, '#ede3d1');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Beveled Edge Highlight & Shadow (3D effect)
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#e4d6c0';
    ctx.strokeRect(10, 10, width - 20, height - 20);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(20, 20, width - 40, height - 40);

    if (tile.isFakeOkey) {
      // Golden Clover & Star Emblem for Sahte Okey
      const goldGrad = ctx.createLinearGradient(cx - 80, cy - 80, cx + 80, cy + 80);
      goldGrad.addColorStop(0, '#fef08a');
      goldGrad.addColorStop(0.5, '#d97706');
      goldGrad.addColorStop(1, '#92400e');

      ctx.fillStyle = goldGrad;
      ctx.beginPath();
      ctx.arc(cx, cy - 40, 85, 0, Math.PI * 2);
      ctx.fill();

      // Deep debossed inner star
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 95px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', cx, cy - 40);

      // Label
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 44px "Cinzel", "Segoe UI", sans-serif';
      ctx.fillText('SAHTE', cx, cy + 110);
      ctx.fillText('OKEY', cx, cy + 165);
    } else {
      const color = OKEY_COLORS[tile.colorKey] || OKEY_COLORS.BLACK;

      // 3. Deep Debossed Colored Enamel Number (Engraved 3D feel)
      ctx.save();
      // Drop Shadow (engraved inner shadow)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 6;
      ctx.shadowBlur = 6;

      ctx.fillStyle = color.hex;
      ctx.font = '900 240px "Outfit", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${tile.number}`, cx, cy - 35);
      ctx.restore();

      // Highlight bevel inside number
      ctx.strokeStyle = color.darkHex;
      ctx.lineWidth = 4;
      ctx.strokeText(`${tile.number}`, cx, cy - 35);

      // Traditional Crescent & Star emblem dot beneath number
      ctx.fillStyle = color.hex;
      ctx.beginPath();
      ctx.arc(cx, cy + 155, 32, 0, Math.PI * 2);
      ctx.fill();

      // White inner crescent
      ctx.fillStyle = '#f8f4ec';
      ctx.beginPath();
      ctx.arc(cx + 8, cy + 151, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    this.cache.set(key, texture);
    return texture;
  }

  // Realistic Bone Tile Back
  getTileBackTexture() {
    if (this.backTexture) return this.backTexture;

    const width = 512;
    const height = 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#faf6ee');
    grad.addColorStop(0.5, '#f3ece0');
    grad.addColorStop(1, '#e6d8c4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 14;
    ctx.strokeStyle = '#dfd0ba';
    ctx.strokeRect(10, 10, width - 20, height - 20);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.backTexture = texture;
    return texture;
  }
}

export const okeyTexGen = new OkeyTextureGenerator();

// 3D Realistic Melamine Tile Mesh
export function createOkeyTile3DMesh(tileData, isSelected = false, isRecommended = false) {
  // Tile dimensions in VR: ~3.8cm width x ~5.4cm height x ~1.2cm depth
  const width = 0.038;
  const height = 0.054;
  const depth = 0.012;

  const geometry = new THREE.BoxGeometry(width, height, depth);

  const frontTexture = okeyTexGen.getTileFrontTexture(tileData);
  const backTexture = okeyTexGen.getTileBackTexture();

  // Polished bone melamine material with realistic physical gloss & clearcoat
  let sideColor = 0xf5efe4;
  let emissiveColor = 0x000000;
  let emissiveIntensity = 0;

  if (isSelected) {
    sideColor = 0x22c55e;
    emissiveColor = 0x15803d;
    emissiveIntensity = 0.45;
  } else if (isRecommended) {
    sideColor = 0xfbbf24;
    emissiveColor = 0xd97706;
    emissiveIntensity = 0.65;
  }

  const sideMaterial = new THREE.MeshPhysicalMaterial({
    color: sideColor,
    emissive: emissiveColor,
    emissiveIntensity: emissiveIntensity,
    roughness: 0.25,
    metalness: 0.02,
    clearcoat: 0.4,
    clearcoatRoughness: 0.1
  });

  const frontMaterial = new THREE.MeshPhysicalMaterial({
    map: frontTexture,
    roughness: 0.18,
    metalness: 0.04,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1
  });

  const backMaterial = new THREE.MeshPhysicalMaterial({
    map: backTexture,
    roughness: 0.25,
    metalness: 0.02,
    clearcoat: 0.3
  });

  const materials = [
    sideMaterial,
    sideMaterial,
    sideMaterial,
    sideMaterial,
    frontMaterial,
    backMaterial
  ];

  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    tile: tileData,
    isOkeyTile: true,
    isSelected,
    isRecommended,
    originalY: 0,
    rackSlot: null,
    tier: 0,
    slotIndex: 0
  };

  return mesh;
}

// 3D Realistic Turkish Walnut Wooden Istaka (Okey Rack)
export function createIstaka3DMesh() {
  const istakaGroup = new THREE.Group();

  const width = 0.54;
  const height = 0.072;
  const depth = 0.095;

  const walnutTexture = okeyTexGen.getWalnutWoodTexture();
  const woodMaterial = new THREE.MeshStandardMaterial({
    map: walnutTexture,
    roughness: 0.45,
    metalness: 0.12
  });

  // 1. Base Walnut Wedge Body
  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const bodyMesh = new THREE.Mesh(bodyGeo, woodMaterial);
  bodyMesh.position.set(0, height / 2, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  istakaGroup.add(bodyMesh);

  // 2. Beveled Side End Caps
  const capMat = new THREE.MeshStandardMaterial({ color: 0x241108, roughness: 0.3, metalness: 0.2 });
  [-width / 2, width / 2].forEach(x => {
    const capGeo = new THREE.BoxGeometry(0.014, height + 0.008, depth + 0.008);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, height / 2, 0);
    istakaGroup.add(cap);
  });

  // 3. Upper Tier Shelf Ridge
  const upperRailGeo = new THREE.BoxGeometry(width - 0.01, 0.012, 0.012);
  const upperRail = new THREE.Mesh(upperRailGeo, woodMaterial);
  upperRail.position.set(0, height + 0.002, -0.012);
  istakaGroup.add(upperRail);

  // 4. Lower Tier Shelf Ridge
  const lowerRailGeo = new THREE.BoxGeometry(width - 0.01, 0.012, 0.012);
  const lowerRail = new THREE.Mesh(lowerRailGeo, woodMaterial);
  lowerRail.position.set(0, height / 2 + 0.004, 0.032);
  istakaGroup.add(lowerRail);

  // 5. Brass Center Nameplate ("KIRAATHANE VIP")
  const plateGeo = new THREE.BoxGeometry(0.14, 0.018, 0.002);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.95, roughness: 0.15 });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, 0.015, depth / 2 + 0.002);
  istakaGroup.add(plate);

  return istakaGroup;
}
