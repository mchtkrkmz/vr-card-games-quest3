import * as THREE from 'three';

export const AVAILABLE_AVATARS = [
  {
    id: 'dayi',
    name: 'Recep Dayı',
    image: './assets/avatar_dayi.png',
    icon: '🧔‍♂️',
    role: 'Bordo Tişörtlü & Posbıyıklı Anadolu Duayeni',
    desc: 'Güneş yanığı teni, gür siyah posbıyığı, bordo tişörtü, siyah montu ve elinde ince belli çayıyla masanın duayeni.',
  },
  {
    id: 'hayrettin',
    name: 'Hayrettin',
    image: './assets/avatar_hayrettin.png',
    icon: '🎙️',
    role: 'Kaos Show Sunucusu & Kahve Tiryakisi',
    desc: 'Çizgili lacivert ceketi, açık beyaz gömleği, dalgalı saçları ve köpüklü Türk kahvesiyle masanın enerjisi.',
  },
  {
    id: 'serdar',
    name: 'Serdar Ortaç',
    image: './assets/avatar_kaos_show.png',
    icon: '🎵',
    role: 'Güler Yüzlü Pop Efsanesi & Kaos Konuğu',
    desc: 'Açık gri ceketi, sempatik gülüşü ve efsane şarkı mırıldanmalarıyla masanın neşesi.',
  },
  {
    id: 'kahkaha_dayi',
    name: 'Kahkaha Dayı',
    image: './assets/avatar_kaos_show.png',
    icon: '😂',
    role: 'Kasketli, Sarı Şallı & Nargileli Fenomen',
    desc: 'Gri kasketi, açık mavi gömleği, sarı omzundaki şalı, meşhur kahkahası ve otantik nargilesiyle ortalığı yıkan fenomen.',
  },
  {
    id: 'gozluklu_abi',
    name: 'Mehmet Abi',
    image: './assets/avatar_kaos_show.png',
    icon: '🕶️',
    role: 'Gözlüklü & Karizmatik Taktikçi',
    desc: 'Koyu gözlükleri, kirli sakalı ve soğukkanlı taş takibiyle masanın taktik ustası.',
  },
  {
    id: 'ayse',
    name: 'Ayşe Hanım',
    icon: '👩',
    role: 'İnci Küpeli & Keskin Hafızalı Stratejist',
    desc: 'Zümrüt yeşili elbisesi, inci küpeleri ve kusursuz taş sayma yeteneğiyle yenilmez taktikçi.',
  },
];

// Procedural Photorealistic Canvas Texture Generators for Kıraathane Characters & Props
class KıraathaneTextureGenerator {
  constructor() {
    this.cache = new Map();
  }

  getSkinTexture(skinHex = 0xc27848, isFemale = false) {
    const key = `skin_${skinHex}_${isFemale ? 'f' : 'm'}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const base = new THREE.Color(skinHex);
    const r = Math.round(base.r * 255);
    const g = Math.round(base.g * 255);
    const b = Math.round(base.b * 255);

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, 256, 256);

    // Warm forehead & cheek blush subsurface scattering simulation
    const cheekGrad = ctx.createRadialGradient(128, 128, 10, 128, 128, 110);
    cheekGrad.addColorStop(0, `rgba(${Math.min(255, r + 26)},${Math.max(0, g - 6)},${Math.max(0, b - 10)},0.32)`);
    cheekGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = cheekGrad;
    ctx.fillRect(0, 0, 256, 256);

    // Micro skin pores & natural tonal variation
    for (let i = 0; i < 650; i++) {
      const px = (i * 59) % 256;
      const py = (i * 101) % 256;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,235,215,0.05)' : 'rgba(60,30,15,0.05)';
      ctx.fillRect(px, py, 2, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, tex);
    return tex;
  }

  getSkinBumpTexture() {
    if (this.cache.has('skin_bump')) return this.cache.get('skin_bump');
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const x = (i * 47) % 128;
      const y = (i * 83) % 128;
      ctx.fillStyle = i % 2 === 0 ? '#8c8c8c' : '#747474';
      ctx.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this.cache.set('skin_bump', tex);
    return tex;
  }

  getIrisTexture(irisHex = 0x3d2314) {
    const key = `iris_${irisHex}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const c = new THREE.Color(irisHex);
    const r = Math.round(c.r * 255);
    const g = Math.round(c.g * 255);
    const b = Math.round(c.b * 255);

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();

    // Radial iris fibers
    ctx.save();
    ctx.translate(64, 64);
    for (let i = 0; i < 42; i++) {
      const ang = (i / 42) * Math.PI * 2;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,215,150,0.28)' : 'rgba(20,10,5,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 18, Math.sin(ang) * 18);
      ctx.lineTo(Math.cos(ang) * 58, Math.sin(ang) * 58);
      ctx.stroke();
    }
    // Dark limbus ring
    ctx.strokeStyle = 'rgba(10,10,15,0.75)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.stroke();

    // Pupil
    ctx.fillStyle = '#050507';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();

    // Natural studio catchlight
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(14, -14, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(key, tex);
    return tex;
  }

  getFabricWeaveTexture(baseHex = '#1e293b') {
    const key = `fabric_${baseHex}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 128, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let x = 0; x < 128; x += 4) ctx.fillRect(x, 0, 1, 128);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    this.cache.set(key, tex);
    return tex;
  }

  // 1. Hayrettin: Navy Blue with crisp White Pinstripes
  getNavyPinstripeTexture() {
    if (this.cache.has('navy_pinstripe')) return this.cache.get('navy_pinstripe');
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#101d36';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#ffffff';
    const stripeGap = 36;
    for (let x = 0; x < 512; x += stripeGap) {
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, 0, 2.5, 512);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(x - 1, 0, 4.5, 512);
    }
    ctx.globalAlpha = 1.0;

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    this.cache.set('navy_pinstripe', tex);
    return tex;
  }

  // 2. Recep Dayı: Textured Burgundy / Dark Maroon T-shirt Weave
  getBurgundyShirtTexture() {
    if (this.cache.has('burgundy_knit')) return this.cache.get('burgundy_knit');
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#831828';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#5f0f1c';
    for (let y = 0; y < 256; y += 4) {
      ctx.fillRect(0, y, 256, 1.5);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    this.cache.set('burgundy_knit', tex);
    return tex;
  }

  // 3. Tweed flat cap (Sekiz Köşe Kasket)
  getTweedCapTexture() {
    if (this.cache.has('tweed_cap')) return this.cache.get('tweed_cap');
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#475569';
    for (let x = 0; x < 256; x += 8) {
      for (let y = 0; y < 256; y += 8) {
        if ((x + y) % 16 === 0) {
          ctx.fillRect(x, y, 4, 4);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    this.cache.set('tweed_cap', tex);
    return tex;
  }

  // Striped Traditional Kıraathane Waiter Apron
  getApronTexture() {
    if (this.cache.has('cayci_apron')) return this.cache.get('cayci_apron');
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.25)';
    for (let x = 0; x < 256; x += 18) ctx.fillRect(x, 0, 3, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set('cayci_apron', tex);
    return tex;
  }

  // 4. Traditional Turkish Red-White Tea Saucer
  getTeaSaucerTexture() {
    if (this.cache.has('tea_saucer')) return this.cache.get('tea_saucer');
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#faf8f5';
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, Math.PI * 2);
    ctx.fill();

    const petals = 6;
    const centerRadius = 80;
    const outerRadius = 230;

    for (let i = 0; i < petals; i++) {
      const angle = (i / petals) * Math.PI * 2;
      const nextAngle = angle + (Math.PI / petals) * 0.72;

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(256, 256, outerRadius, angle, nextAngle, false);
      ctx.arc(256, 256, centerRadius, nextAngle, angle, true);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(256, 256, outerRadius + 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 256, centerRadius - 2, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set('tea_saucer', tex);
    return tex;
  }

  // 5. Rich Turkish Coffee Crema & Foam
  getCoffeeFoamTexture() {
    if (this.cache.has('coffee_foam')) return this.cache.get('coffee_foam');
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2b1408';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#783f1d';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 8 + Math.random() * 24;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#a16207';
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 1.5 + Math.random() * 3.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set('coffee_foam', tex);
    return tex;
  }
}

export const textureGen = new KıraathaneTextureGenerator();

// =========================================================================
// REALISTIC TURKISH BEVERAGES & PROPS BUILDERS (ÇAY, TÜRK KAHVESİ, NARGİLE, ASKILI TEPSİ)
// =========================================================================

// 1. Iconic Authentic Turkish "İnce Belli" Tea Glass & Saucer & Sugar Cubes
export function createAuthenticTeaGlass(scale = 1.0) {
  const teaGroup = new THREE.Group();
  teaGroup.scale.set(scale, scale, scale);

  const saucerTex = textureGen.getTeaSaucerTexture();
  const saucerGeo = new THREE.CylinderGeometry(0.065, 0.048, 0.01, 24);
  const saucerMat = new THREE.MeshStandardMaterial({
    map: saucerTex,
    roughness: 0.25,
    metalness: 0.05,
  });
  const saucer = new THREE.Mesh(saucerGeo, saucerMat);
  saucer.position.y = 0.005;
  teaGroup.add(saucer);

  const glassPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.018, 0.002),
    new THREE.Vector2(0.019, 0.008),
    new THREE.Vector2(0.021, 0.022),
    new THREE.Vector2(0.014, 0.040),
    new THREE.Vector2(0.019, 0.056),
    new THREE.Vector2(0.024, 0.072),
    new THREE.Vector2(0.022, 0.072),
    new THREE.Vector2(0.017, 0.056),
    new THREE.Vector2(0.012, 0.040),
    new THREE.Vector2(0.019, 0.022),
    new THREE.Vector2(0.016, 0.008),
    new THREE.Vector2(0, 0.006),
  ];
  const glassGeo = new THREE.LatheGeometry(glassPoints, 20);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xeaf6ff,
    opacity: 0.28,
    transparent: true,
    roughness: 0.08,
    metalness: 0.18,
    envMapIntensity: 1.4,
    depthWrite: false,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.y = 0.008;
  teaGroup.add(glass);

  const teaPoints = [
    new THREE.Vector2(0, 0.008),
    new THREE.Vector2(0.015, 0.010),
    new THREE.Vector2(0.018, 0.022),
    new THREE.Vector2(0.011, 0.040),
    new THREE.Vector2(0.016, 0.058),
    new THREE.Vector2(0, 0.058),
  ];
  const teaGeo = new THREE.LatheGeometry(teaPoints, 18);
  const teaMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.08,
    transparent: true,
    opacity: 0.88,
  });
  const teaLiquid = new THREE.Mesh(teaGeo, teaMat);
  teaLiquid.position.y = 0.008;
  teaGroup.add(teaLiquid);

  const spoonGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 0.076, 8);
  const spoonMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
  const spoon = new THREE.Mesh(spoonGeo, spoonMat);
  spoon.position.set(0.008, 0.046, 0);
  spoon.rotation.z = 0.28;
  teaGroup.add(spoon);

  const sugarMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  const sugar1 = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.009, 0.009), sugarMat);
  sugar1.position.set(0.038, 0.015, 0.015);
  sugar1.rotation.y = 0.3;
  teaGroup.add(sugar1);

  const sugar2 = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.009, 0.009), sugarMat);
  sugar2.position.set(0.042, 0.015, -0.012);
  sugar2.rotation.y = -0.4;
  teaGroup.add(sugar2);

  return teaGroup;
}

// Traditional Hanging Turkish Chrome/Steel Tea Tray (Askılı Kahvehane Çay Tepsisi)
export function createHangingTeaTray() {
  const trayGroup = new THREE.Group();

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.16,
    envMapIntensity: 1.5,
  });

  // 1. Round Mirror-Finish Tray Plate (origin at top handle -> tray hangs down -0.34m)
  const trayY = -0.34;
  const plateGeo = new THREE.CylinderGeometry(0.185, 0.178, 0.01, 28);
  const plate = new THREE.Mesh(plateGeo, chromeMat);
  plate.position.y = trayY;
  plate.castShadow = true;
  trayGroup.add(plate);

  // Raised Tray Rim
  const rimGeo = new THREE.TorusGeometry(0.184, 0.006, 8, 28);
  const rim = new THREE.Mesh(rimGeo, chromeMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = trayY + 0.005;
  trayGroup.add(rim);

  // 2. Three Curved Metal Hanging Struts Converging to Top Handle Grip
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const rx = Math.cos(ang) * 0.175;
    const rz = Math.sin(ang) * 0.175;

    const strutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(rx, trayY + 0.005, rz),
      new THREE.Vector3(rx * 0.92, trayY + 0.16, rz * 0.92),
      new THREE.Vector3(0, -0.02, 0),
    ]);
    const strutGeo = new THREE.TubeGeometry(strutCurve, 12, 0.0038, 6, false);
    const strut = new THREE.Mesh(strutGeo, chromeMat);
    trayGroup.add(strut);
  }

  // Ergonomic Handle Ring at top
  const handleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.3 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 12), handleMat);
  handle.rotation.z = Math.PI / 2;
  trayGroup.add(handle);

  // 3. Four Authentic Hot "İnce Belli" Tea Glasses Arranged on the Tray
  const teaOffsets = [
    [-0.075, -0.065],
    [0.075, -0.065],
    [-0.075, 0.065],
    [0.075, 0.065],
  ];
  for (const [tx, tz] of teaOffsets) {
    const tea = createAuthenticTeaGlass(0.85);
    tea.position.set(tx, trayY + 0.005, tz);
    trayGroup.add(tea);
  }

  return trayGroup;
}

// 2. Authentic Turkish Coffee Cup
export function createTurkishCoffeeCup(scale = 1.0) {
  const coffeeGroup = new THREE.Group();
  coffeeGroup.scale.set(scale, scale, scale);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
  const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.15 });

  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.048, 0.008, 24), porcelainMat);
  saucer.position.y = 0.004;
  coffeeGroup.add(saucer);

  const saucerGoldRim = new THREE.Mesh(new THREE.TorusGeometry(0.060, 0.0025, 8, 24), goldMat);
  saucerGoldRim.rotation.x = Math.PI / 2;
  saucerGoldRim.position.y = 0.008;
  coffeeGroup.add(saucerGoldRim);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.046, 20), porcelainMat);
  cup.position.y = 0.03;
  coffeeGroup.add(cup);

  const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.002, 8, 20), goldMat);
  cupRim.rotation.x = Math.PI / 2;
  cupRim.position.y = 0.053;
  coffeeGroup.add(cupRim);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 8, 14, Math.PI * 1.2), goldMat);
  handle.position.set(0.034, 0.03, 0);
  handle.rotation.y = Math.PI / 2;
  coffeeGroup.add(handle);

  const foamMat = new THREE.MeshStandardMaterial({ map: textureGen.getCoffeeFoamTexture(), roughness: 0.4 });
  const foam = new THREE.Mesh(new THREE.CircleGeometry(0.026, 20), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.051;
  coffeeGroup.add(foam);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xeaf6ff,
    transparent: true,
    opacity: 0.30,
    roughness: 0.08,
    metalness: 0.15,
    envMapIntensity: 1.3,
    depthWrite: false,
  });
  const waterGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.038, 14), glassMat);
  waterGlass.position.set(-0.042, 0.023, 0.025);
  coffeeGroup.add(waterGlass);

  const waterLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.010, 0.030, 14),
    new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.65 })
  );
  waterLiquid.position.set(-0.042, 0.019, 0.025);
  coffeeGroup.add(waterLiquid);

  const miniPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.004, 14), goldMat);
  miniPlate.position.set(-0.038, 0.006, -0.032);
  coffeeGroup.add(miniPlate);

  const lokumMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.7 });
  const lokum = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), lokumMat);
  lokum.position.set(-0.038, 0.014, -0.032);
  lokum.rotation.y = 0.4;
  coffeeGroup.add(lokum);

  return coffeeGroup;
}

// 3. Authentic Traditional Ottoman Shisha / Nargile
export function createOttomanNargile(scale = 1.0) {
  const nargileGroup = new THREE.Group();
  nargileGroup.scale.set(scale, scale, scale);

  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.88, roughness: 0.25 });
  const goldOrnamentMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.92, roughness: 0.2 });

  const vasePoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0.02),
    new THREE.Vector2(0.14, 0.12),
    new THREE.Vector2(0.09, 0.24),
    new THREE.Vector2(0.045, 0.32),
    new THREE.Vector2(0.052, 0.36),
    new THREE.Vector2(0, 0.36),
  ];
  const vaseGeo = new THREE.LatheGeometry(vasePoints, 20);
  const vaseMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.42,
    roughness: 0.12,
    metalness: 0.2,
    envMapIntensity: 1.4,
    depthWrite: false,
  });
  const vase = new THREE.Mesh(vaseGeo, vaseMat);
  nargileGroup.add(vase);

  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.09, 0.16, 16),
    new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 })
  );
  water.position.y = 0.10;
  nargileGroup.add(water);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.44, 14), brassMat);
  stem.position.y = 0.54;
  nargileGroup.add(stem);

  const bulb1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 14), goldOrnamentMat);
  bulb1.scale.set(1, 0.7, 1);
  bulb1.position.y = 0.48;
  nargileGroup.add(bulb1);

  const bulb2 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 14), goldOrnamentMat);
  bulb2.scale.set(1, 0.7, 1);
  bulb2.position.y = 0.62;
  nargileGroup.add(bulb2);

  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.018, 20), brassMat);
  tray.position.y = 0.76;
  nargileGroup.add(tray);

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.024, 0.065, 14),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 })
  );
  bowl.position.y = 0.80;
  nargileGroup.add(bowl);

  const coalMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    emissive: 0xea580c,
    emissiveIntensity: 1.8,
    roughness: 0.9,
  });
  for (let c = 0; c < 3; c++) {
    const coal = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.022), coalMat);
    coal.position.set((c - 1) * 0.018, 0.84, c % 2 === 0 ? 0.006 : -0.006);
    coal.rotation.set(0.2, c * 0.5, 0.1);
    nargileGroup.add(coal);
  }

  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.035, 0.38, 0),
    new THREE.Vector3(0.18, 0.36, 0.08),
    new THREE.Vector3(0.26, 0.44, 0.22),
    new THREE.Vector3(0.24, 0.58, 0.34),
  ]);
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(hoseCurve, 16, 0.012, 8, false),
    new THREE.MeshStandardMaterial({ color: 0x831843, roughness: 0.6 })
  );
  nargileGroup.add(hose);

  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.012, 0.08, 8),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 })
  );
  tip.position.set(0.24, 0.61, 0.38);
  tip.rotation.x = 0.35;
  nargileGroup.add(tip);

  return nargileGroup;
}

// =========================================================================
// ANATOMICAL REALISTIC AVATAR BUILDER CLASS
// =========================================================================
export class AvatarBuilder {
  createAvatarById(avatarId = 'dayi') {
    switch (avatarId) {
      case 'dayi':
      case 'kasketli':
        return this.createRecepDayi();
      case 'hayrettin':
      case 'ekoseli':
        return this.createHayrettin();
      case 'serdar':
      case 'murat':
        return this.createSerdarOrtac();
      case 'kahkaha_dayi':
      case 'hasan':
        return this.createKahkahaDayi();
      case 'gozluklu_abi':
      case 'ali':
        return this.createGozlukluAbi();
      case 'ayse':
        return this.createAyseHanim();
      default:
        return this.createRecepDayi();
    }
  }

  makeSkinMat(skinHex, isFemale = false) {
    return new THREE.MeshStandardMaterial({
      map: textureGen.getSkinTexture(skinHex, isFemale),
      bumpMap: textureGen.getSkinBumpTexture(),
      bumpScale: 0.0006,
      roughness: isFemale ? 0.48 : 0.56,
      metalness: 0.02,
      envMapIntensity: 0.75,
    });
  }

  // Sculpted Lathe Head with Eye Sockets, Textured Iris, Animated Eyelids & Articulated Mouth
  buildRealisticHead(config) {
    const {
      skinHex = 0xc27848,
      hairHex = 0x18181b,
      eyeIrisHex = 0x3d2314,
      isFemale = false,
      stacheType = 'none',
      hairStyle = 'dayi_hair',
      sunglasses = false,
      hasEarrings = false,
      hasWrinkles = false,
      isSmiling = false,
    } = config;

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.13, 0);

    const skinMat = this.makeSkinMat(skinHex, isFemale);

    // 1. Contoured Anatomical Head Profile (natural jawline + temple curve)
    const jawRatio = isFemale ? 0.78 : 0.94;
    const headProfile = [
      new THREE.Vector2(0.0, -0.105),
      new THREE.Vector2(0.048 * jawRatio, -0.098),
      new THREE.Vector2(0.076 * jawRatio, -0.070),
      new THREE.Vector2(0.095, -0.032),
      new THREE.Vector2(0.106, 0.015),
      new THREE.Vector2(0.108, 0.060),
      new THREE.Vector2(0.095, 0.102),
      new THREE.Vector2(0.058, 0.130),
      new THREE.Vector2(0.0, 0.138),
    ];
    const headGeo = new THREE.LatheGeometry(headProfile, 26);
    headGeo.scale(0.96, 1.0, 1.06);
    const skull = new THREE.Mesh(headGeo, skinMat);
    skull.castShadow = true;
    headGroup.add(skull);

    // Soft Chin & Cheekbone Volume
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.040 * jawRatio, 14, 12), skinMat);
    chin.scale.set(1.15, 0.75, 1.05);
    chin.position.set(0, -0.072, 0.068);
    headGroup.add(chin);

    [-0.064, 0.064].forEach((side) => {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), skinMat);
      cheek.scale.set(0.75, 0.85, 1.05);
      cheek.position.set(side, -0.004, 0.074);
      headGroup.add(cheek);
    });

    // 2. Realistic Recessed Eyes + Textured Iris + Animated Blinking Eyelids
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfefefe, roughness: 0.15 });
    const irisTex = textureGen.getIrisTexture(eyeIrisHex);
    const irisMat = new THREE.MeshStandardMaterial({ map: irisTex, roughness: 0.12, metalness: 0.05 });
    const eyelidMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.62 });
    const eyelids = [];

    [-0.036, 0.036].forEach((eyeX) => {
      const eyeSubGroup = new THREE.Group();
      eyeSubGroup.position.set(eyeX, 0.026, 0.092);

      // Subtle brow ridge shadow above socket
      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.017, 16, 16), eyeWhiteMat);
      eyeSubGroup.add(eyeball);

      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.0095, 18), irisMat);
      iris.position.set(0, 0, 0.0165);
      eyeSubGroup.add(iris);

      // Upper Blinking Eyelid Hemisphere
      const upperLidGeo = new THREE.SphereGeometry(0.0185, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
      const upperLid = new THREE.Mesh(upperLidGeo, eyelidMat);
      upperLid.rotation.x = -0.78; // Open eye position (~-45°); closes smoothly to 0.05 when blinking
      eyeSubGroup.add(upperLid);
      eyelids.push(upperLid);

      // Lower eyelid rim
      const lowerLidGeo = new THREE.SphereGeometry(0.0182, 12, 8, 0, Math.PI * 2, Math.PI * 0.65, Math.PI * 0.35);
      const lowerLid = new THREE.Mesh(lowerLidGeo, eyelidMat);
      eyeSubGroup.add(lowerLid);

      headGroup.add(eyeSubGroup);
    });

    // 3. Natural Eyebrows
    const browMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.92 });
    [-0.036, 0.036].forEach((browX, i) => {
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(isFemale ? 0.003 : 0.005, 0.026, 4, 8), browMat);
      brow.position.set(browX, 0.054, 0.100);
      brow.rotation.z = Math.PI / 2 + (i === 0 ? -0.10 : 0.10);
      headGroup.add(brow);
    });

    if (hasWrinkles) {
      const wrinkleMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(skinHex).multiplyScalar(0.75),
        roughness: 0.95,
      });
      for (let w = 0; w < 2; w++) {
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.068, 8), wrinkleMat);
        line.rotation.z = Math.PI / 2;
        line.position.set(0, 0.075 + w * 0.014, 0.098);
        headGroup.add(line);
      }
    }

    // 4. Anatomical Nose
    const noseGroup = new THREE.Group();
    noseGroup.position.set(0, 0.008, 0.103);

    const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.032, 6, 10), skinMat);
    bridge.position.set(0, 0.005, 0.008);
    bridge.rotation.x = -0.32;
    noseGroup.add(bridge);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 12), skinMat);
    tip.position.set(0, -0.014, 0.018);
    noseGroup.add(tip);

    [-0.012, 0.012].forEach((nox) => {
      const flare = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 10), skinMat);
      flare.position.set(nox, -0.016, 0.011);
      noseGroup.add(flare);
    });
    headGroup.add(noseGroup);

    // 5. Ears
    [-0.102, 0.102].forEach((earX, i) => {
      const earGroup = new THREE.Group();
      earGroup.position.set(earX, 0.015, 0.004);
      earGroup.rotation.y = i === 0 ? -0.25 : 0.25;

      const earHelix = new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.0055, 8, 12, Math.PI * 1.3), skinMat);
      earHelix.rotation.z = i === 0 ? 0.3 : -0.3;
      earGroup.add(earHelix);

      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), skinMat);
      lobe.position.set(0, -0.020, 0);
      earGroup.add(lobe);

      if (hasEarrings) {
        const goldHook = new THREE.Mesh(
          new THREE.TorusGeometry(0.005, 0.0014, 6, 10),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 })
        );
        goldHook.position.set(0, -0.026, 0);
        earGroup.add(goldHook);

        const pearl = new THREE.Mesh(
          new THREE.SphereGeometry(0.0065, 10, 10),
          new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.16, metalness: 0.15 })
        );
        pearl.position.set(0, -0.034, 0);
        earGroup.add(pearl);
      }

      headGroup.add(earGroup);
    });

    // 6. Articulated Lips / Mouth (animates slightly when speaking!)
    const mouthGroup = new THREE.Group();
    mouthGroup.position.set(0, -0.048, 0.095);
    const lipMat = new THREE.MeshStandardMaterial({
      color: isFemale ? 0xb91c1c : new THREE.Color(skinHex).multiplyScalar(0.68),
      roughness: 0.55,
    });

    if (isSmiling) {
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.0045, 8, 14, Math.PI * 0.72), lipMat);
      smile.rotation.z = Math.PI * 0.14;
      mouthGroup.add(smile);
    } else {
      const topLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.032, 4, 8), lipMat);
      topLip.rotation.z = Math.PI / 2;
      topLip.position.y = 0.004;
      mouthGroup.add(topLip);

      const botLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0045, 0.028, 4, 8), lipMat);
      botLip.rotation.z = Math.PI / 2;
      botLip.position.y = -0.004;
      mouthGroup.add(botLip);
    }
    headGroup.add(mouthGroup);

    // 7. Facial Hair
    const hairMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.85 });

    if (stacheType === 'posbiyik_dayi' || stacheType === 'cayci_stache') {
      const stacheMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.95 });
      const leftStache = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.034, 6, 10), stacheMat);
      leftStache.rotation.z = 1.15;
      leftStache.rotation.y = 0.25;
      leftStache.position.set(-0.022, -0.032, 0.106);
      headGroup.add(leftStache);

      const rightStache = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.034, 6, 10), stacheMat);
      rightStache.rotation.z = -1.15;
      rightStache.rotation.y = -0.25;
      rightStache.position.set(0.022, -0.032, 0.106);
      headGroup.add(rightStache);
    } else if (stacheType === 'hayrettin_beard') {
      const beardMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.9 });
      const jawBeard = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), beardMat);
      jawBeard.scale.set(1.02, 0.9, 1.05);
      jawBeard.position.set(0, -0.030, 0.020);
      headGroup.add(jawBeard);

      const hStache = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.042, 6, 10), beardMat);
      hStache.rotation.z = Math.PI / 2;
      hStache.position.set(0, -0.032, 0.106);
      headGroup.add(hStache);
    } else if (stacheType === 'serdar_smile') {
      const sMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
      const sGoatee = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 10), sMat);
      sGoatee.scale.set(1.3, 0.9, 0.9);
      sGoatee.position.set(0, -0.068, 0.088);
      headGroup.add(sGoatee);
    } else if (stacheType === 'kahkaha_stache') {
      const kMat = new THREE.MeshStandardMaterial({ color: 0x2b221c, roughness: 0.95 });
      const kStache = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.044, 6, 10), kMat);
      kStache.rotation.z = Math.PI / 2;
      kStache.position.set(0, -0.032, 0.107);
      headGroup.add(kStache);
    } else if (stacheType === 'stubble') {
      const stubbleMat = new THREE.MeshStandardMaterial({
        color: hairHex,
        roughness: 0.95,
        opacity: 0.35,
        transparent: true,
      });
      const stubble = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.072, 0.068, 16), stubbleMat);
      stubble.position.set(0, -0.056, 0.028);
      headGroup.add(stubble);
    }

    // 8. Sunglasses
    if (sunglasses) {
      const darkGlassMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.1,
        metalness: 0.85,
        opacity: 0.86,
        transparent: true,
      });
      const fMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 });

      [-0.036, 0.036].forEach((gx) => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.028, 0.008), fMat);
        frame.position.set(gx, 0.028, 0.112);
        headGroup.add(frame);

        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.037, 0.024, 0.009), darkGlassMat);
        lens.position.set(gx, 0.028, 0.112);
        headGroup.add(lens);
      });

      const sBridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.006), fMat);
      sBridge.position.set(0, 0.030, 0.112);
      headGroup.add(sBridge);
    }

    // 9. Hair Styles
    if (hairStyle === 'dayi_hair' || hairStyle === 'cayci_hair') {
      const hairCrown = new THREE.Mesh(
        new THREE.SphereGeometry(0.112, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.75),
        hairMat
      );
      hairCrown.scale.set(0.98, 1.0, 1.05);
      hairCrown.position.set(0, 0.036, -0.010);
      headGroup.add(hairCrown);
    } else if (hairStyle === 'hayrettin_wavy') {
      const wavyCrown = new THREE.Mesh(
        new THREE.SphereGeometry(0.115, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.65),
        hairMat
      );
      wavyCrown.position.set(0, 0.038, -0.008);
      headGroup.add(wavyCrown);

      [-0.028, 0.015, 0.045].forEach((wx, i) => {
        const wave = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.035, 6, 8), hairMat);
        wave.position.set(wx, 0.088, 0.075);
        wave.rotation.z = i % 2 === 0 ? 0.35 : -0.35;
        wave.rotation.x = 0.45;
        headGroup.add(wave);
      });
    } else if (hairStyle === 'serdar_crop') {
      const sHair = new THREE.Mesh(
        new THREE.SphereGeometry(0.112, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.8),
        hairMat
      );
      sHair.position.set(0, 0.036, -0.008);
      headGroup.add(sHair);
    } else if (hairStyle === 'kasket_kahkaha') {
      const capTex = textureGen.getTweedCapTexture();
      const capMat = new THREE.MeshStandardMaterial({ map: capTex, roughness: 0.85 });

      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.138, 0.060, 18), capMat);
      crown.position.set(0, 0.098, -0.008);
      crown.rotation.x = 0.08;
      headGroup.add(crown);

      const capBtn = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), capMat);
      capBtn.position.set(0, 0.132, -0.008);
      headGroup.add(capBtn);

      const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.132, 0.132, 0.012, 20, 1, false, 0, Math.PI), capMat);
      visor.position.set(0, 0.078, 0.078);
      visor.rotation.y = -Math.PI / 2;
      visor.rotation.x = 0.28;
      headGroup.add(visor);
    } else if (hairStyle === 'long_brunette') {
      const hairCrown = new THREE.Mesh(
        new THREE.SphereGeometry(0.115, 20, 18, 0, Math.PI * 2, 0, Math.PI / 1.6),
        hairMat
      );
      hairCrown.position.set(0, 0.034, -0.008);
      headGroup.add(hairCrown);

      [-0.098, 0.098].forEach((hx) => {
        const curl = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.22, 6, 10), hairMat);
        curl.position.set(hx, -0.08, 0.022);
        headGroup.add(curl);
      });
    }

    // 10. Sculpted Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.060, 0.12, 16), skinMat);
    neck.position.set(0, -0.12, 0);
    headGroup.add(neck);

    headGroup.userData.eyelids = eyelids;
    headGroup.userData.mouth = mouthGroup;
    return headGroup;
  }

  // Smooth anatomical rounded torso + tailored shoulder/collar silhouette
  createAnatomicalTorso(group, outerMat, innerMat = null, hasJacket = false, isFemale = false) {
    const chestW = isFemale ? 0.165 : 0.195;
    const chestH = 0.44;
    const waistW = isFemale ? 0.135 : 0.170;

    // Rounded anatomical chest/ribcage
    const chestGeo = new THREE.CylinderGeometry(chestW, waistW, chestH, 20);
    chestGeo.scale(1.0, 1.0, 0.62);
    const chest = new THREE.Mesh(chestGeo, innerMat || outerMat);
    chest.position.set(0, 0.77, 0);
    chest.castShadow = true;
    group.add(chest);

    // Natural Shoulder Slope Cap (replaces blocky box top!)
    const shoulderGeo = new THREE.CapsuleGeometry(0.072, chestW * 1.48, 8, 14);
    const shoulders = new THREE.Mesh(shoulderGeo, outerMat);
    shoulders.rotation.z = Math.PI / 2;
    shoulders.scale.set(0.88, 1.0, 0.85);
    shoulders.position.set(0, 0.945, -0.005);
    shoulders.castShadow = true;
    group.add(shoulders);

    if (hasJacket) {
      [-0.105, 0.105].forEach((jx, idx) => {
        const panel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.082, 0.42, 14), outerMat);
        panel.scale.set(0.95, 1.0, 0.78);
        panel.position.set(jx, 0.76, 0.022);
        panel.castShadow = true;
        group.add(panel);

        // Tailored Lapel
        const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.18, 0.014), outerMat);
        lapel.position.set(idx === 0 ? -0.062 : 0.062, 0.87, 0.108);
        lapel.rotation.z = idx === 0 ? 0.22 : -0.22;
        group.add(lapel);
      });
    }

    // Shirt collar ring
    const collarMat = innerMat || outerMat;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.012, 8, 18), collarMat);
    collar.rotation.x = Math.PI / 2 + 0.14;
    collar.position.set(0, 0.985, 0.010);
    group.add(collar);
  }

  // --- 1. RECEP DAYI ---
  createRecepDayi() {
    const group = new THREE.Group();
    const skinHex = 0xc27848;
    const burgundyMat = new THREE.MeshStandardMaterial({
      map: textureGen.getBurgundyShirtTexture(),
      color: 0x881337,
      roughness: 0.82,
    });
    const jacketMat = new THREE.MeshStandardMaterial({
      map: textureGen.getFabricWeaveTexture('#1c1917'),
      roughness: 0.65,
    });

    this.createAnatomicalTorso(group, jacketMat, burgundyMat, true, false);

    const headGroup = this.buildRealisticHead({
      skinHex,
      hairHex: 0x141210,
      eyeIrisHex: 0x3d2314,
      stacheType: 'posbiyik_dayi',
      hairStyle: 'dayi_hair',
      hasWrinkles: true,
    });
    group.add(headGroup);

    const skinMat = this.makeSkinMat(skinHex);
    this.addArmsWithProp(group, jacketMat, skinMat, 'tea');
    this.addSeatedLegsAndChair(group);

    group.userData = {
      head: headGroup,
      eyelids: headGroup.userData.eyelids,
      mouth: headGroup.userData.mouth,
      baseRotY: 0,
      animOffset: Math.random() * 10,
    };
    return group;
  }

  // --- 2. HAYRETTİN ---
  createHayrettin() {
    const group = new THREE.Group();
    const skinHex = 0xd99b6c;
    const pinstripeMat = new THREE.MeshStandardMaterial({
      map: textureGen.getNavyPinstripeTexture(),
      roughness: 0.68,
    });
    const whiteShirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });

    this.createAnatomicalTorso(group, pinstripeMat, whiteShirtMat, true, false);

    const headGroup = this.buildRealisticHead({
      skinHex,
      hairHex: 0x221a14,
      eyeIrisHex: 0x4a2e18,
      stacheType: 'hayrettin_beard',
      hairStyle: 'hayrettin_wavy',
      isSmiling: true,
    });
    group.add(headGroup);

    const skinMat = this.makeSkinMat(skinHex);
    this.addArmsWithProp(group, pinstripeMat, skinMat, 'coffee');
    this.addSeatedLegsAndChair(group);

    group.userData = {
      head: headGroup,
      eyelids: headGroup.userData.eyelids,
      mouth: headGroup.userData.mouth,
      baseRotY: 0,
      animOffset: Math.random() * 10,
    };
    return group;
  }

  // --- 3. SERDAR ORTAÇ ---
  createSerdarOrtac() {
    const group = new THREE.Group();
    const skinHex = 0xdb9f70;
    const greyJacketMat = new THREE.MeshStandardMaterial({
      map: textureGen.getFabricWeaveTexture('#cbd5e1'),
      roughness: 0.72,
    });
    const blackInnerMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

    this.createAnatomicalTorso(group, greyJacketMat, blackInnerMat, true, false);

    const headGroup = this.buildRealisticHead({
      skinHex,
      hairHex: 0x18181b,
      eyeIrisHex: 0x3d2314,
      stacheType: 'serdar_smile',
      hairStyle: 'serdar_crop',
      isSmiling: true,
    });
    group.add(headGroup);

    const skinMat = this.makeSkinMat(skinHex);
    this.addArmsWithProp(group, greyJacketMat, skinMat, 'tea');
    this.addSeatedLegsAndChair(group);

    group.userData = {
      head: headGroup,
      eyelids: headGroup.userData.eyelids,
      mouth: headGroup.userData.mouth,
      baseRotY: 0,
      animOffset: Math.random() * 10,
    };
    return group;
  }

  // --- 4. KAHKAHA DAYI ---
  createKahkahaDayi() {
    const group = new THREE.Group();
    const skinHex = 0xd59560;
    const blueShirtMat = new THREE.MeshStandardMaterial({
      map: textureGen.getFabricWeaveTexture('#2563eb'),
      roughness: 0.75,
    });
    const yellowScarfMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.88 });

    this.createAnatomicalTorso(group, blueShirtMat, blueShirtMat, false, false);

    // Yellow scarf draped over left shoulder
    const scarf = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.34, 6, 10), yellowScarfMat);
    scarf.position.set(-0.11, 0.84, 0.08);
    scarf.rotation.z = 0.08;
    group.add(scarf);

    const headGroup = this.buildRealisticHead({
      skinHex,
      hairHex: 0x2b221c,
      eyeIrisHex: 0x3d2314,
      stacheType: 'kahkaha_stache',
      hairStyle: 'kasket_kahkaha',
      isSmiling: true,
    });
    group.add(headGroup);

    const skinMat = this.makeSkinMat(skinHex);
    this.addArmsWithProp(group, blueShirtMat, skinMat, 'nargile');
    this.addSeatedLegsAndChair(group);

    const nargile = createOttomanNargile(0.95);
    nargile.position.set(0.38, 0, 0.15);
    group.add(nargile);

    group.userData = {
      head: headGroup,
      eyelids: headGroup.userData.eyelids,
      mouth: headGroup.userData.mouth,
      baseRotY: 0,
      animOffset: Math.random() * 10,
    };
    return group;
  }

  // --- 5. GÖZLÜKLÜ ABİ ---
  createGozlukluAbi() {
    const group = new THREE.Group();
    const skinHex = 0xd9a066;
    const poloMat = new THREE.MeshStandardMaterial({
      map: textureGen.getFabricWeaveTexture('#1e293b'),
      roughness: 0.78,
    });

    this.createAnatomicalTorso(group, poloMat, poloMat, false, false);

    const headGroup = this.buildRealisticHead({
      skinHex,
      hairHex: 0x18181b,
      eyeIrisHex: 0x3d2314,
      stacheType: 'stubble',
      hairStyle: 'serdar_crop',
      sunglasses: true,
    });
    group.add(headGroup);

    const skinMat = this.makeSkinMat(skinHex);
    this.addArmsWithProp(group, poloMat, skinMat, 'coffee');
    this.addSeatedLegsAndChair(group);

    group.userData = {
      head: headGroup,
      eyelids: headGroup.userData.eyelids,
      mouth: headGroup.userData.mouth,
      baseRotY: 0,
      animOffset: Math.random() * 10,
    };
    return group;
  }

  // --- 6. AYŞE HANIM ---
  createAyseHanim() {
    const group = new THREE.Group();
    const skinHex = 0xf5d0b5;
    const dressMat = new THREE.MeshStandardMaterial({
      map: textureGen.getFabricWeaveTexture('#047857'),
      roughness: 0.62,
      metalness: 0.05,
    });

    this.createAnatomicalTorso(group, dressMat, dressMat, false, true);

    const headGroup = this.buildRealisticHead({
      skinHex,
      hairHex: 0x22130c,
      eyeIrisHex: 0x5a3319,
      isFemale: true,
      hairStyle: 'long_brunette',
      hasEarrings: true,
      isSmiling: true,
    });
    group.add(headGroup);

    const skinMat = this.makeSkinMat(skinHex, true);
    this.addArmsWithProp(group, dressMat, skinMat, 'tea');
    this.addSeatedLegsAndChair(group);

    group.userData = {
      head: headGroup,
      eyelids: headGroup.userData.eyelids,
      mouth: headGroup.userData.mouth,
      baseRotY: 0,
      animOffset: Math.random() * 10,
    };
    return group;
  }

  // --- 7. WALKING KIRAATHANE ÇAYCISI (Çaycı Hüseyin + Askılı Çay Tepsisi) ---
  createCayciAvatar() {
    const group = new THREE.Group();
    const skinHex = 0xd29262;
    const skinMat = this.makeSkinMat(skinHex);

    const whiteShirtMat = new THREE.MeshStandardMaterial({
      map: textureGen.getFabricWeaveTexture('#f8fafc'),
      roughness: 0.68,
    });
    const vestMat = new THREE.MeshStandardMaterial({
      map: textureGen.getFabricWeaveTexture('#450a0a'),
      roughness: 0.72,
    });
    const apronMat = new THREE.MeshStandardMaterial({
      map: textureGen.getApronTexture(),
      roughness: 0.85,
    });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.88 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.35, metalness: 0.15 });

    // Stand pose aligned so head sits naturally around ~1.58m standing waiter height!
    const bodyRoot = new THREE.Group();
    bodyRoot.position.y = 0.28; // Raise seated torso height (0.77..1.13) -> standing (1.05..1.41 + head 1.56)
    this.createAnatomicalTorso(bodyRoot, vestMat, whiteShirtMat, true, false);

    // Traditional White Kıraathane Waist Apron (Bel Önlüğü) & Shoulder Towel
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.185, 0.38, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9), apronMat);
    apron.position.set(0, 0.48, 0.02);
    bodyRoot.add(apron);

    const towel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.025), whiteShirtMat);
    towel.position.set(-0.14, 0.56, 0.06);
    towel.rotation.z = 0.08;
    bodyRoot.add(towel);

    const headGroup = this.buildRealisticHead({
      skinHex,
      hairHex: 0x1e1b18,
      eyeIrisHex: 0x3d2314,
      stacheType: 'cayci_stache',
      hairStyle: 'cayci_hair',
      isSmiling: true,
    });
    bodyRoot.add(headGroup);

    // Left Arm (Swings naturally while walking)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.20, 0.94, 0);
    const lUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.040, 0.16, 6, 10), whiteShirtMat);
    lUpper.position.y = -0.10;
    leftArm.add(lUpper);
    const lFore = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.18, 6, 10), skinMat);
    lFore.position.set(0.02, -0.27, 0.04);
    lFore.rotation.x = -0.25;
    leftArm.add(lFore);
    const lHand = this.createDetailedHand(skinMat, false, false);
    lHand.position.set(0.03, -0.39, 0.08);
    leftArm.add(lHand);
    bodyRoot.add(leftArm);

    // Right Arm (Extended slightly out & holding the Hanging Brass/Chrome Tea Tray!)
    const rightArm = new THREE.Group();
    rightArm.position.set(0.20, 0.94, 0);
    const rUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.040, 0.16, 6, 10), whiteShirtMat);
    rUpper.position.set(0.03, -0.09, 0.05);
    rUpper.rotation.x = -0.45;
    rUpper.rotation.z = 0.18;
    rightArm.add(rUpper);
    const rFore = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.18, 6, 10), skinMat);
    rFore.position.set(0.08, -0.15, 0.19);
    rFore.rotation.x = -1.25;
    rightArm.add(rFore);
    const rHand = this.createDetailedHand(skinMat, true, true);
    rHand.position.set(0.09, -0.16, 0.30);
    rightArm.add(rHand);

    const trayGroup = createHangingTeaTray();
    trayGroup.position.set(0.09, -0.16, 0.31);
    rightArm.add(trayGroup);
    bodyRoot.add(rightArm);

    group.add(bodyRoot);

    // Articulated Walking Legs (Pivot at hip height y = 0.84)
    const createLeg = (hipX) => {
      const legPivot = new THREE.Group();
      legPivot.position.set(hipX, 0.84, 0);

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.30, 6, 12), pantsMat);
      thigh.position.y = -0.20;
      thigh.castShadow = true;
      legPivot.add(thigh);

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.32, 6, 12), pantsMat);
      shin.position.y = -0.56;
      shin.castShadow = true;
      legPivot.add(shin);

      const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.10, 6, 10), shoeMat);
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1.0, 1.0, 0.65);
      shoe.position.set(0, -0.80, 0.04);
      legPivot.add(shoe);

      return legPivot;
    };

    const leftLeg = createLeg(-0.095);
    const rightLeg = createLeg(0.095);
    group.add(leftLeg, rightLeg);

    group.userData = {
      isCayci: true,
      head: headGroup,
      eyelids: headGroup.userData.eyelids,
      mouth: headGroup.userData.mouth,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      trayGroup,
      baseRotY: 0,
      animOffset: 0,
    };

    return group;
  }

  // --- ARMS WITH HELD PROPS ---
  addArmsWithProp(group, sleeveMat, skinMat, propType = 'none') {
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.20, 0.94, 0);

    const bicep1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.16, 6, 10), sleeveMat);
    bicep1.position.y = -0.10;
    leftArm.add(bicep1);

    const forearm1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.18, 6, 10), skinMat);
    forearm1.position.set(0.06, -0.21, 0.12);
    forearm1.rotation.x = -Math.PI / 3.2;
    forearm1.rotation.z = -0.25;
    leftArm.add(forearm1);

    const leftHand = this.createDetailedHand(skinMat, false);
    leftHand.position.set(0.11, -0.31, 0.23);
    leftHand.rotation.x = -Math.PI / 4;
    leftHand.rotation.y = 0.2;
    leftArm.add(leftHand);
    group.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.20, 0.94, 0);

    const bicep2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.16, 6, 10), sleeveMat);
    bicep2.position.y = -0.10;
    rightArm.add(bicep2);

    const forearm2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.18, 6, 10), skinMat);

    if (propType === 'tea' || propType === 'coffee') {
      forearm2.position.set(-0.06, -0.20, 0.14);
      forearm2.rotation.x = -Math.PI / 2.6;
      forearm2.rotation.z = 0.22;
      rightArm.add(forearm2);

      const rightHand = this.createDetailedHand(skinMat, true, true);
      rightHand.position.set(-0.09, -0.28, 0.25);
      rightHand.rotation.x = -Math.PI / 3.5;
      rightArm.add(rightHand);

      if (propType === 'tea') {
        const teaGlass = createAuthenticTeaGlass(0.88);
        teaGlass.position.set(-0.09, -0.29, 0.27);
        rightArm.add(teaGlass);
      } else {
        const coffeeCup = createTurkishCoffeeCup(0.88);
        coffeeCup.position.set(-0.09, -0.29, 0.27);
        rightArm.add(coffeeCup);
      }
    } else if (propType === 'nargile') {
      forearm2.position.set(-0.05, -0.18, 0.15);
      forearm2.rotation.x = -Math.PI / 2.3;
      forearm2.rotation.z = 0.15;
      rightArm.add(forearm2);

      const rightHand = this.createDetailedHand(skinMat, true, true);
      rightHand.position.set(-0.06, -0.24, 0.26);
      rightArm.add(rightHand);

      const marpucInHand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.012, 0.14, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 })
      );
      marpucInHand.position.set(-0.06, -0.24, 0.27);
      marpucInHand.rotation.x = 0.4;
      rightArm.add(marpucInHand);
    } else {
      forearm2.position.set(-0.06, -0.21, 0.12);
      forearm2.rotation.x = -Math.PI / 3.2;
      forearm2.rotation.z = 0.25;
      rightArm.add(forearm2);

      const rightHand = this.createDetailedHand(skinMat, true);
      rightHand.position.set(-0.11, -0.31, 0.23);
      rightHand.rotation.x = -Math.PI / 4;
      rightHand.rotation.y = -0.2;
      rightArm.add(rightHand);
    }

    group.add(rightArm);
  }

  createDetailedHand(skinMat, isRight = false, isGripping = false) {
    const handGroup = new THREE.Group();

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.014, 0.052), skinMat);
    handGroup.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0058, 0.022, 4, 8), skinMat);
    thumb.position.set(isRight ? -0.026 : 0.026, -0.004, 0.012);
    thumb.rotation.z = isRight ? -0.7 : 0.7;
    if (isGripping) thumb.rotation.x = 0.5;
    handGroup.add(thumb);

    const fingerLengths = [0.026, 0.032, 0.028, 0.022];
    const fingerPositions = [-0.017, -0.006, 0.006, 0.017];

    fingerPositions.forEach((fx, i) => {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.0048, fingerLengths[i], 4, 8), skinMat);
      finger.position.set(isRight ? -fx : fx, 0, 0.028 + fingerLengths[i] * 0.45);
      finger.rotation.x = isGripping ? Math.PI / 2 + 0.6 : Math.PI / 2 + 0.15;
      handGroup.add(finger);
    });

    return handGroup;
  }

  addSeatedLegsAndChair(group) {
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.88 });

    [-0.095, 0.095].forEach((lx) => {
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.24, 6, 10), pantsMat);
      thigh.rotation.x = Math.PI / 2;
      thigh.position.set(lx, 0.52, 0.14);
      group.add(thigh);

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.34, 6, 10), pantsMat);
      shin.position.set(lx, 0.27, 0.28);
      group.add(shin);
    });

    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.35, metalness: 0.2 });
    [-0.095, 0.095].forEach((sx) => {
      const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.10, 6, 10), shoeMat);
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1, 1, 0.62);
      shoe.position.set(sx, 0.03, 0.33);
      group.add(shoe);
    });

    const chairGroup = this.createCafeChair();
    group.add(chairGroup);
  }

  createCafeChair() {
    const chair = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x381e12, roughness: 0.42, metalness: 0.06 });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.036, 0.44), woodMat);
    seat.position.set(0, 0.48, 0);
    chair.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.032), woodMat);
    back.position.set(0, 0.72, -0.19);
    chair.add(back);

    const legGeo = new THREE.CylinderGeometry(0.02, 0.016, 0.48, 10);
    [
      [-0.18, 0.24, -0.18],
      [0.18, 0.24, -0.18],
      [-0.18, 0.24, 0.18],
      [0.18, 0.24, 0.18],
    ].forEach((p) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(...p);
      chair.add(leg);
    });

    return chair;
  }

  createCharacter(id = 'dayi') {
    return this.createAvatarById(id);
  }

  createCayci() {
    return this.createCayciAvatar();
  }
}

export const avatarBuilder = new AvatarBuilder();
export function createCayciAvatar() {
  return avatarBuilder.createCayciAvatar();
}
