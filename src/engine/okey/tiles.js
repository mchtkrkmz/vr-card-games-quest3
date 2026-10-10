import * as THREE from 'three';

export const OKEY_COLORS = {
  RED: { id: 'RED', name: 'Kırmızı', hex: '#dc2626', darkHex: '#991b1b', shadow: 'rgba(220, 38, 38, 0.45)' },
  BLACK: { id: 'BLACK', name: 'Siyah', hex: '#18181b', darkHex: '#09090b', shadow: 'rgba(24, 24, 27, 0.5)' },
  BLUE: { id: 'BLUE', name: 'Mavi', hex: '#0284c7', darkHex: '#0369a1', shadow: 'rgba(2, 132, 199, 0.45)' },
  YELLOW: { id: 'YELLOW', name: 'Sarı/Turuncu', hex: '#ea580c', darkHex: '#c2410c', shadow: 'rgba(234, 88, 12, 0.45)' }
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

  // Authentic Turkish Warm Walnut Wood Grain Texture for Istakas
  getWalnutWoodTexture() {
    if (this.walnutTexture) return this.walnutTexture;

    const width = 512;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Rich warm honey walnut base (matching reference photograph)
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#78350f');
    grad.addColorStop(0.35, '#92400e');
    grad.addColorStop(0.7, '#6b2d0c');
    grad.addColorStop(1, '#451a03');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Natural wavy horizontal wood grain lines
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.55)';
    ctx.lineWidth = 3;
    for (let y = 0; y < height; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 24) {
        const ny = y + Math.sin(x * 0.04 + y * 0.015) * 4 + Math.cos(x * 0.07) * 2;
        ctx.lineTo(x, ny);
      }
      ctx.stroke();
    }

    // Fine wood pores & grain highlights
    ctx.strokeStyle = 'rgba(254, 215, 170, 0.18)';
    ctx.lineWidth = 1.2;
    for (let y = 3; y < height; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 32) {
        const ny = y + Math.sin(x * 0.03) * 3;
        ctx.lineTo(x, ny);
      }
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    this.walnutTexture = texture;
    return texture;
  }

  // Realistic Melamine Bone Tile Front (100% matched to attached reference photograph)
  getTileFrontTexture(tile) {
    const key = tile.isFakeOkey ? 'FAKE_OKEY' : `${tile.colorKey}_${tile.number}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const width = 512;
    const height = 720;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // 1. Heavy Melamine Bone / Ivory Base with soft radial highlight
    const cx = width / 2;
    const cy = height / 2;
    const radGrad = ctx.createRadialGradient(cx, cy - 80, 50, cx, cy, 390);
    radGrad.addColorStop(0, '#ffffff');
    radGrad.addColorStop(0.55, '#faf6ee');
    radGrad.addColorStop(1, '#ede2cf');
    ctx.fillStyle = radGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Beveled Edge Highlight & Shadow (matching ivory tile bevel in photo)
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#e2d4bc';
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(18, 18, width - 36, height - 36);

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
      ctx.font = 'bold 44px "Segoe UI", sans-serif';
      ctx.fillText('SAHTE', cx, cy + 110);
      ctx.fillText('OKEY', cx, cy + 165);
    } else {
      const color = OKEY_COLORS[tile.colorKey] || OKEY_COLORS.BLACK;

      // 3. Bold Rounded Numerical Typography (Centered in upper-mid section as in photo)
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 5;
      ctx.shadowBlur = 6;

      ctx.fillStyle = color.hex;
      // Bold rounded sans font matching the reference photo
      ctx.font = '900 240px "Outfit", "Arial Rounded MT Bold", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${tile.number}`, cx, cy - 45);
      ctx.restore();

      // Crisp subtle outline for enhanced VR readability
      ctx.strokeStyle = color.darkHex;
      ctx.lineWidth = 4;
      ctx.strokeText(`${tile.number}`, cx, cy - 45);

      // 4. AUTHENTIC HEART EMBLEM MEDALLION DIRECTLY UNDER NUMBER (As seen on all tiles in photo)
      // Recessed circular well
      const emblemY = cy + 145;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, emblemY, 44, 0, Math.PI * 2);
      ctx.fillStyle = '#ede3d1';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#ded0ba';
      ctx.stroke();

      // Colored Heart (Kalp) Suit Symbol inside medallion
      ctx.fillStyle = color.hex;
      ctx.font = 'bold 62px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♥', cx, emblemY + 2);

      // Delicate ivory center dot on heart (matching photo's heart detailing)
      ctx.fillStyle = '#faf6ee';
      ctx.beginPath();
      ctx.arc(cx, emblemY + 11, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
  // Tile dimensions in VR: ~4.0cm width x ~5.6cm height x ~1.2cm depth
  const width = 0.040;
  const height = 0.056;
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
    emissiveIntensity = 0.65;
  } else if (tileData.isRealOkey) {
    // Real Okey tile glows with prestige gold outline
    sideColor = 0xfef08a;
    emissiveColor = 0xd97706;
    emissiveIntensity = 0.55;
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

  const width = 0.58;
  const height = 0.082;
  const depth = 0.115;

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
    const capGeo = new THREE.BoxGeometry(0.016, height + 0.010, depth + 0.010);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(x, height / 2, 0);
    istakaGroup.add(cap);
  });

  // 3. Upper Tier Shelf Ridge (Raised higher to ensure zero visual overlap)
  const upperRailGeo = new THREE.BoxGeometry(width - 0.01, 0.014, 0.014);
  const upperRail = new THREE.Mesh(upperRailGeo, woodMaterial);
  upperRail.position.set(0, height + 0.006, -0.024);
  istakaGroup.add(upperRail);

  // 4. Lower Tier Shelf Ridge
  const lowerRailGeo = new THREE.BoxGeometry(width - 0.01, 0.014, 0.014);
  const lowerRail = new THREE.Mesh(lowerRailGeo, woodMaterial);
  lowerRail.position.set(0, height / 2 + 0.002, 0.038);
  istakaGroup.add(lowerRail);

  // 5. Brass Center Nameplate ("KIRAATHANE VIP")
  const plateGeo = new THREE.BoxGeometry(0.14, 0.018, 0.002);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.95, roughness: 0.15 });
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(0, 0.015, depth / 2 + 0.002);
  istakaGroup.add(plate);

  return istakaGroup;
}

// Generates the exact 15-tile demonstration hand shown in the user's reference photograph
export function createPhotoDemoHand() {
  const demoTiles = [
    // Bottom Row: Run of 5 Red (1, 2, 3, 4, 5)
    { id: 'demo_r_1', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#dc2626', number: 1, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 0 },
    { id: 'demo_r_2', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#dc2626', number: 2, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 1 },
    { id: 'demo_r_3', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#dc2626', number: 3, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 2 },
    { id: 'demo_r_4', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#dc2626', number: 4, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 3 },
    { id: 'demo_r_5', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#dc2626', number: 5, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 4 },

    // Bottom Row (After gap): Set of 10s (Orange, Red, Blue)
    { id: 'demo_y_10', colorKey: 'YELLOW', colorName: 'Sarı/Turuncu', colorHex: '#ea580c', number: 10, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 6 },
    { id: 'demo_r_10', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#dc2626', number: 10, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 7 },
    { id: 'demo_b_10', colorKey: 'BLUE', colorName: 'Mavi', colorHex: '#0284c7', number: 10, isFakeOkey: false, isRealOkey: false, _istakaTier: 1, _istakaSlot: 8 },

    // Top Row: Set of 5s (Black, Orange, Blue)
    { id: 'demo_k_5', colorKey: 'BLACK', colorName: 'Siyah', colorHex: '#18181b', number: 5, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 1 },
    { id: 'demo_y_5', colorKey: 'YELLOW', colorName: 'Sarı/Turuncu', colorHex: '#ea580c', number: 5, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 2 },
    { id: 'demo_b_5', colorKey: 'BLUE', colorName: 'Mavi', colorHex: '#0284c7', number: 5, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 3 },

    // Top Row (After gap): Pair of 7s (Red, Black)
    { id: 'demo_r_7', colorKey: 'RED', colorName: 'Kırmızı', colorHex: '#dc2626', number: 7, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 5 },
    { id: 'demo_k_7', colorKey: 'BLACK', colorName: 'Siyah', colorHex: '#18181b', number: 7, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 6 },

    // Top Row (After gap): Pair of 8s (Orange, Blue)
    { id: 'demo_y_8', colorKey: 'YELLOW', colorName: 'Sarı/Turuncu', colorHex: '#ea580c', number: 8, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 8 },
    { id: 'demo_b_8', colorKey: 'BLUE', colorName: 'Mavi', colorHex: '#0284c7', number: 8, isFakeOkey: false, isRealOkey: false, _istakaTier: 0, _istakaSlot: 9 }
  ];

  return demoTiles;
}

// Intelligent dual-tier Istaka slot layout algorithm with visible gaps between groups
// Matches the visual organization shown in the user's reference photograph
export function arrangeHandTilesOnIstaka(handTiles, forceSort = false) {
  if (!handTiles || handTiles.length === 0) return handTiles;

  // If tiles already have explicit slots and no re-sort is requested, preserve them
  const hasExistingSlots = handTiles.every(t => typeof t._istakaSlot === 'number' && typeof t._istakaTier === 'number');
  if (hasExistingSlots && !forceSort) {
    return handTiles;
  }

  const okeys = handTiles.filter(t => t.isRealOkey);
  const regularTiles = handTiles.filter(t => !t.isRealOkey);

  const runs = [];
  const sets = [];
  const pairs = [];
  const usedIds = new Set();

  // 1. Detect Same-Color Consecutive Runs (e.g. 1-2-3-4-5 Red)
  const colorMap = { RED: [], BLACK: [], BLUE: [], YELLOW: [] };
  regularTiles.forEach(t => {
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
        } else if (tile.number === last.number) {
          // duplicate number in same suit, ignore for this run
        } else {
          if (curRun.length >= 3) {
            runs.push([...curRun]);
            curRun.forEach(t => usedIds.add(t.id));
          }
          curRun = [tile];
        }
      }
    }
    if (curRun.length >= 3) {
      runs.push([...curRun]);
      curRun.forEach(t => usedIds.add(t.id));
    }
  }

  // Sort runs longest first
  runs.sort((a, b) => b.length - a.length);

  // 2. Detect Same-Number Different-Color Sets (e.g. 10-10-10 or 5-5-5)
  const numMap = {};
  regularTiles.forEach(t => {
    if (!usedIds.has(t.id)) {
      if (!numMap[t.number]) numMap[t.number] = [];
      // avoid duplicates of same color in the set
      if (!numMap[t.number].some(existing => existing.colorKey === t.colorKey)) {
        numMap[t.number].push(t);
      }
    }
  });

  for (const num in numMap) {
    if (numMap[num].length >= 3) {
      sets.push([...numMap[num]]);
      numMap[num].forEach(t => usedIds.add(t.id));
    }
  }

  // 3. Detect Pairs (e.g. 7-7 or 8-8)
  const pairMap = {};
  regularTiles.forEach(t => {
    if (!usedIds.has(t.id)) {
      if (!pairMap[t.number]) pairMap[t.number] = [];
      pairMap[t.number].push(t);
    }
  });

  for (const num in pairMap) {
    if (pairMap[num].length >= 2) {
      const pairGroup = pairMap[num].slice(0, 2);
      pairs.push(pairGroup);
      pairGroup.forEach(t => usedIds.add(t.id));
    }
  }

  // 4. Remaining Orphan / Dead Tiles
  const orphans = regularTiles.filter(t => !usedIds.has(t.id));

  // --- DUAL-SHELF SLOT DISTRIBUTION ---
  // Lower shelf (Tier 1): Slots 0..12 (Takes longest runs and primary sets with gaps)
  // Upper shelf (Tier 0): Slots 0..12 (Takes secondary sets, pairs, okeys, and loose tiles with gaps)
  const maxSlots = 12;

  let tier1Groups = [];
  let tier0Groups = [];

  // Bottom row gets longest runs first
  if (runs.length > 0) {
    tier1Groups.push(runs[0]);
    if (sets.length > 0) {
      tier1Groups.push(sets[0]);
    }
  } else if (sets.length > 0) {
    tier1Groups.push(sets[0]);
  }

  // Remaining runs and sets go to top row
  for (let i = 1; i < runs.length; i++) tier0Groups.push(runs[i]);
  for (let i = (runs.length > 0 ? 1 : 1); i < sets.length; i++) tier0Groups.push(sets[i]);

  // Pairs and orphans go to top row
  pairs.forEach(p => tier0Groups.push(p));
  if (okeys.length > 0) tier0Groups.unshift(okeys);
  if (orphans.length > 0) {
    // If bottom row has plenty of room, place some orphans or pairs there
    if (tier1Groups.reduce((acc, g) => acc + g.length, 0) <= 6) {
      tier1Groups.push(orphans);
    } else {
      tier0Groups.push(orphans);
    }
  }

  // Function to assign slots along a tier with clean 1-slot gaps between groups
  function assignTierSlots(groups, tier) {
    const totalTiles = groups.reduce((acc, g) => acc + g.length, 0);
    const totalGaps = Math.max(0, groups.length - 1);
    const needed = totalTiles + totalGaps;
    let startSlot = Math.max(0, Math.floor((maxSlots - needed) / 2));

    let curSlot = startSlot;
    groups.forEach((grp, gIdx) => {
      grp.forEach(t => {
        t._istakaTier = tier;
        t._istakaSlot = Math.min(maxSlots - 1, curSlot);
        curSlot++;
      });
      // 1-slot gap after each group
      if (gIdx < groups.length - 1) {
        curSlot++;
      }
    });
  }

  assignTierSlots(tier1Groups, 1); // Bottom shelf
  assignTierSlots(tier0Groups, 0); // Top shelf

  return handTiles;
}
