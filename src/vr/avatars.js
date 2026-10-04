import * as THREE from 'three';

export const AVAILABLE_AVATARS = [
  {
    id: 'dayi',
    name: 'Recep Dayı',
    image: './assets/avatar_dayi.png',
    icon: '🧔‍♂️',
    role: 'Bordo Tişörtlü & Posbıyıklı Anadolu Duayeni',
    desc: 'Güneş yanığı teni, gür siyah posbıyığı, bordo tişörtü, siyah montu ve elinde ince belli çayıyla masanın duayeni.'
  },
  {
    id: 'hayrettin',
    name: 'Hayrettin',
    image: './assets/avatar_hayrettin.png',
    icon: '🎙️',
    role: 'Kaos Show Sunucusu & Kahve Tiryakisi',
    desc: 'Çizgili lacivert ceketi, açık beyaz gömleği, dalgalı saçları ve köpüklü Türk kahvesiyle masanın enerjisi.'
  },
  {
    id: 'serdar',
    name: 'Serdar Ortaç',
    image: './assets/avatar_kaos_show.png',
    icon: '🎵',
    role: 'Güler Yüzlü Pop Efsanesi & Kaos Konuğu',
    desc: 'Açık gri ceketi, sempatik gülüşü ve efsane şarkı mırıldanmalarıyla masanın neşesi.'
  },
  {
    id: 'kahkaha_dayi',
    name: 'Kahkaha Dayı',
    image: './assets/avatar_kaos_show.png',
    icon: '😂',
    role: 'Kasketli, Sarı Şallı & Nargileli Fenomen',
    desc: 'Gri kasketi, açık mavi gömleği, sarı omzundaki şalı, meşhur kahkahası ve otantik nargilesiyle ortalığı yıkan fenomen.'
  },
  {
    id: 'gozluklu_abi',
    name: 'Mehmet Abi',
    image: './assets/avatar_kaos_show.png',
    icon: '🕶️',
    role: 'Gözlüklü & Karizmatik Taktikçi',
    desc: 'Koyu gözlükleri, kirli sakalı ve soğukkanlı taş takibiyle masanın taktik ustası.'
  },
  {
    id: 'ayse',
    name: 'Ayşe Hanım',
    icon: '👩',
    role: 'İnci Küpeli & Keskin Hafızalı Stratejist',
    desc: 'Zümrüt yeşili elbisesi, inci küpeleri ve kusursuz taş sayma yeteneğiyle yenilmez taktikçi.'
  }
];

// Procedural Photorealistic Canvas Texture Generators for Turkish kıraathane & Kaos Show characters
class KıraathaneTextureGenerator {
  constructor() {
    this.cache = new Map();
  }

  // 1. Hayrettin: Navy Blue with crisp White Pinstripes (Çizgili Lacivert Takım Ceketi)
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
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    this.cache.set('burgundy_knit', tex);
    return tex;
  }

  // 3. Kahkaha Dayı: Tweed flat cap (Sekiz Köşe Kasket)
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
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    this.cache.set('tweed_cap', tex);
    return tex;
  }

  // 4. Traditional Turkish Red-White Tea Saucer (Geleneksel Kırmızı-Beyaz Çay Tabağı)
  getTeaSaucerTexture() {
    if (this.cache.has('tea_saucer')) return this.cache.get('tea_saucer');
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Pure white porcelain base
    ctx.fillStyle = '#faf8f5';
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, Math.PI * 2);
    ctx.fill();

    // Red radial petals/trapezoids (Iconic Turkish tea saucer motif)
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

      // Gold rim line on petals
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // Outer and inner gold rings
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
    this.cache.set('tea_saucer', tex);
    return tex;
  }

  // 5. Rich Turkish Coffee Crema & Foam (Köpüklü Türk Kahvesi)
  getCoffeeFoamTexture() {
    if (this.cache.has('coffee_foam')) return this.cache.get('coffee_foam');
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Deep espresso brown base
    ctx.fillStyle = '#2b1408';
    ctx.fillRect(0, 0, 256, 256);

    // Warm golden brown crema froth
    ctx.fillStyle = '#783f1d';
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 8 + Math.random() * 24;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Micro foam bubbles
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
    this.cache.set('coffee_foam', tex);
    return tex;
  }
}

export const textureGen = new KıraathaneTextureGenerator();

// =========================================================================
// REALISTIC TURKISH BEVERAGES & PROPS BUILDERS (ÇAY, TÜRK KAHVESİ, NARGİLE)
// =========================================================================

// 1. Iconic Authentic Turkish "İnce Belli" Tea Glass & Saucer & Sugar Cubes
export function createAuthenticTeaGlass(scale = 1.0) {
  const teaGroup = new THREE.Group();
  teaGroup.scale.set(scale, scale, scale);

  // A. Traditional Red-White Ceramic Saucer
  const saucerTex = textureGen.getTeaSaucerTexture();
  const saucerGeo = new THREE.CylinderGeometry(0.065, 0.048, 0.01, 32);
  const saucerMat = new THREE.MeshStandardMaterial({
    map: saucerTex,
    roughness: 0.25,
    metalness: 0.05
  });
  const saucer = new THREE.Mesh(saucerGeo, saucerMat);
  saucer.position.y = 0.005;
  teaGroup.add(saucer);

  // B. Authentic Turkish "İnce Belli" Hourglass Glass Geometry (Lathe Curve)
  const glassPoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.018, 0.002), // bottom base edge
    new THREE.Vector2(0.019, 0.008), // lower base rim
    new THREE.Vector2(0.021, 0.022), // lower belly (tombul alt)
    new THREE.Vector2(0.014, 0.040), // İNCE BEL (pinched waist curve)
    new THREE.Vector2(0.019, 0.056), // upper flare (genişleyen üst)
    new THREE.Vector2(0.024, 0.072), // top lip rim (ağız kısmı)
    new THREE.Vector2(0.022, 0.072), // inner lip rim
    new THREE.Vector2(0.017, 0.056),
    new THREE.Vector2(0.012, 0.040), // inner waist
    new THREE.Vector2(0.019, 0.022),
    new THREE.Vector2(0.016, 0.008),
    new THREE.Vector2(0, 0.006)
  ];
  const glassGeo = new THREE.LatheGeometry(glassPoints, 28);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 0.94,
    opacity: 1,
    transparent: true,
    roughness: 0.04,
    ior: 1.52,
    reflectivity: 0.9
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.y = 0.008;
  teaGroup.add(glass);

  // C. Translucent Tavşan Kanı Brewed Turkish Tea Liquid
  const teaPoints = [
    new THREE.Vector2(0, 0.008),
    new THREE.Vector2(0.015, 0.010),
    new THREE.Vector2(0.018, 0.022),
    new THREE.Vector2(0.011, 0.040),
    new THREE.Vector2(0.016, 0.058), // Tea fill line
    new THREE.Vector2(0, 0.058)
  ];
  const teaGeo = new THREE.LatheGeometry(teaPoints, 24);
  const teaMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c, // Tavşan kanı deep red/amber
    roughness: 0.08,
    transparent: true,
    opacity: 0.88
  });
  const teaLiquid = new THREE.Mesh(teaGeo, teaMat);
  teaLiquid.position.y = 0.008;
  teaGroup.add(teaLiquid);

  // D. Silver Tea Spoon (Çay Kaşığı)
  const spoonGeo = new THREE.CylinderGeometry(0.0018, 0.0018, 0.076, 8);
  const spoonMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
  const spoon = new THREE.Mesh(spoonGeo, spoonMat);
  spoon.position.set(0.008, 0.046, 0);
  spoon.rotation.z = 0.28;
  teaGroup.add(spoon);

  // E. 2 White Sugar Cubes (Küp Şeker) resting on saucer
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

// 2. Authentic Turkish Coffee Cup with Crema Foam, Saucer, Water Glass & Lokum (Türk Kahvesi)
export function createTurkishCoffeeCup(scale = 1.0) {
  const coffeeGroup = new THREE.Group();
  coffeeGroup.scale.set(scale, scale, scale);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
  const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.15 });

  // A. Saucer with Gold Rim
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.048, 0.008, 32), porcelainMat);
  saucer.position.y = 0.004;
  coffeeGroup.add(saucer);

  const saucerGoldRim = new THREE.Mesh(new THREE.TorusGeometry(0.060, 0.0025, 8, 32), goldMat);
  saucerGoldRim.rotation.x = Math.PI / 2;
  saucerGoldRim.position.y = 0.008;
  coffeeGroup.add(saucerGoldRim);

  // B. Porcelain Coffee Cup
  const cupGeo = new THREE.CylinderGeometry(0.028, 0.022, 0.046, 24);
  const cup = new THREE.Mesh(cupGeo, porcelainMat);
  cup.position.y = 0.03;
  coffeeGroup.add(cup);

  const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.002, 8, 24), goldMat);
  cupRim.rotation.x = Math.PI / 2;
  cupRim.position.y = 0.053;
  coffeeGroup.add(cupRim);

  // C. Curved Gold Handle (Fincan Kulpu)
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 8, 16, Math.PI * 1.2), goldMat);
  handle.position.set(0.034, 0.03, 0);
  handle.rotation.y = Math.PI / 2;
  coffeeGroup.add(handle);

  // D. Rich Frothy Coffee Foam (Köpüklü Kahve)
  const foamTex = textureGen.getCoffeeFoamTexture();
  const foamMat = new THREE.MeshStandardMaterial({ map: foamTex, roughness: 0.4 });
  const foam = new THREE.Mesh(new THREE.CircleGeometry(0.026, 24), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = 0.051;
  coffeeGroup.add(foam);

  // E. Mini Water Glass (Kahve Yanı Su Bardağı)
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.92, transparent: true, opacity: 1, roughness: 0.05 });
  const waterGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.038, 16), glassMat);
  waterGlass.position.set(-0.042, 0.023, 0.025);
  coffeeGroup.add(waterGlass);

  const waterLiquid = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.010, 0.030, 16), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.7 }));
  waterLiquid.position.set(-0.042, 0.019, 0.025);
  coffeeGroup.add(waterLiquid);

  // F. Pink Turkish Delight (Güllü Türk Lokumu) on mini gold plate
  const miniPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.004, 16), goldMat);
  miniPlate.position.set(-0.038, 0.006, -0.032);
  coffeeGroup.add(miniPlate);

  const lokumMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.7 }); // Powdered pink rose lokum
  const lokum = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), lokumMat);
  lokum.position.set(-0.038, 0.014, -0.032);
  lokum.rotation.y = 0.4;
  coffeeGroup.add(lokum);

  return coffeeGroup;
}

// 3. Authentic Traditional Ottoman Shisha / Nargile (Kıraathane Nargilesi & Köz)
export function createOttomanNargile(scale = 1.0) {
  const nargileGroup = new THREE.Group();
  nargileGroup.scale.set(scale, scale, scale);

  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.88, roughness: 0.25 });
  const goldOrnamentMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.92, roughness: 0.2 });

  // A. Crystal/Glass Water Base (Şişe)
  const vasePoints = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.11, 0.02),
    new THREE.Vector2(0.14, 0.12), // Belly
    new THREE.Vector2(0.09, 0.24),
    new THREE.Vector2(0.045, 0.32), // Neck
    new THREE.Vector2(0.052, 0.36),
    new THREE.Vector2(0, 0.36)
  ];
  const vaseGeo = new THREE.LatheGeometry(vasePoints, 24);
  const vaseMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7, // Aegean tinted blue glass
    transmission: 0.85,
    transparent: true,
    opacity: 0.9,
    roughness: 0.1,
    ior: 1.5
  });
  const vase = new THREE.Mesh(vaseGeo, vaseMat);
  nargileGroup.add(vase);

  // Water level inside
  const waterGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.16, 20);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.y = 0.10;
  nargileGroup.add(water);

  // B. Engraved Brass Stem (Ser)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.44, 16), brassMat);
  stem.position.y = 0.54;
  nargileGroup.add(stem);

  // Ornate Brass Rings & Sphere on Stem
  const bulb1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), goldOrnamentMat);
  bulb1.scale.set(1, 0.7, 1);
  bulb1.position.y = 0.48;
  nargileGroup.add(bulb1);

  const bulb2 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 16), goldOrnamentMat);
  bulb2.scale.set(1, 0.7, 1);
  bulb2.position.y = 0.62;
  nargileGroup.add(bulb2);

  // C. Charcoal Tray (Tabla)
  const trayGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.018, 24);
  const tray = new THREE.Mesh(trayGeo, brassMat);
  tray.position.y = 0.76;
  nargileGroup.add(tray);

  // D. Ceramic Tobacco Bowl (Lüle)
  const bowlGeo = new THREE.CylinderGeometry(0.042, 0.024, 0.065, 16);
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 }); // Red terracotta
  const bowl = new THREE.Mesh(bowlGeo, bowlMat);
  bowl.position.y = 0.80;
  nargileGroup.add(bowl);

  // E. Glowing Orange Charcoal Embers (Köz & Kor)
  const coalMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    emissive: 0xea580c,
    emissiveIntensity: 1.8,
    roughness: 0.9
  });
  for (let c = 0; c < 3; c++) {
    const coal = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.022), coalMat);
    coal.position.set((c - 1) * 0.018, 0.84, (c % 2 === 0 ? 0.006 : -0.006));
    coal.rotation.set(0.2, c * 0.5, 0.1);
    nargileGroup.add(coal);
  }

  // F. Flexible Wrapped Hose (Marpuç) curving out
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.035, 0.38, 0),
    new THREE.Vector3(0.18, 0.36, 0.08),
    new THREE.Vector3(0.26, 0.44, 0.22),
    new THREE.Vector3(0.24, 0.58, 0.34)
  ]);
  const hoseGeo = new THREE.TubeGeometry(hoseCurve, 20, 0.012, 10, false);
  const hoseMat = new THREE.MeshStandardMaterial({ color: 0x831843, roughness: 0.6 }); // Burgundy velvet wrap
  const hose = new THREE.Mesh(hoseGeo, hoseMat);
  nargileGroup.add(hose);

  // Wooden Mouthpiece (Sipsi)
  const tipGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.08, 8);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 });
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.set(0.24, 0.61, 0.38);
  tip.rotation.x = 0.35;
  nargileGroup.add(tip);

  return nargileGroup;
}

// =========================================================================
// AVATAR BUILDER CLASS
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

  // --- CORE REALISTIC HUMAN ANATOMICAL HEAD BUILDER ---
  buildRealisticHead(config) {
    const {
      skinHex = 0xc27848,
      roughness = 0.65,
      hairHex = 0x18181b,
      eyeIrisHex = 0x3d2314,
      isFemale = false,
      stacheType = 'none',
      hairStyle = 'dayi_hair',
      sunglasses = false,
      hasEarrings = false,
      hasWrinkles = false,
      isSmiling = false
    } = config;

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.12, 0);

    const skinMat = new THREE.MeshStandardMaterial({
      color: skinHex,
      roughness: roughness,
      metalness: 0.04
    });

    // 1. Anatomical Cranium & Jaw
    const skullGeo = new THREE.SphereGeometry(0.114, 28, 24);
    skullGeo.scale(1.0, 1.18, 1.06);
    const cranium = new THREE.Mesh(skullGeo, skinMat);
    headGroup.add(cranium);

    const jawWidth = isFemale ? 0.09 : 0.118;
    const jawGeo = new THREE.CylinderGeometry(jawWidth, jawWidth * 0.78, 0.12, 16);
    const jaw = new THREE.Mesh(jawGeo, skinMat);
    jaw.position.set(0, -0.06, 0.038);
    headGroup.add(jaw);

    // Cheekbones
    [-0.076, 0.076].forEach(side => {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), skinMat);
      cheek.scale.set(0.65, 0.8, 1.15);
      cheek.position.set(side, 0.012, 0.076);
      headGroup.add(cheek);
    });

    // 2. Realistic Eyes & Sockets
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
    const irisMat = new THREE.MeshStandardMaterial({ color: eyeIrisHex, roughness: 0.25 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const eyelidMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: roughness });

    [-0.042, 0.042].forEach(eyeX => {
      const eyeSubGroup = new THREE.Group();
      eyeSubGroup.position.set(eyeX, 0.032, 0.094);

      const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 16), eyeWhiteMat);
      eyeSubGroup.add(eyeball);

      const iris = new THREE.Mesh(new THREE.CircleGeometry(0.012, 16), irisMat);
      iris.position.set(0, 0, 0.021);
      eyeSubGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 12), pupilMat);
      pupil.position.set(0, 0, 0.0215);
      eyeSubGroup.add(pupil);

      const gleam = new THREE.Mesh(new THREE.CircleGeometry(0.0025, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      gleam.position.set(0.004, 0.004, 0.0218);
      eyeSubGroup.add(gleam);

      const upperLid = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.006, 12, 1, false, 0, Math.PI), eyelidMat);
      upperLid.position.set(0, 0.012, 0.015);
      upperLid.rotation.z = Math.PI;
      eyeSubGroup.add(upperLid);

      headGroup.add(eyeSubGroup);
    });

    // 3. Eyebrows
    const browMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.95 });
    [-0.042, 0.042].forEach((browX, i) => {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.04, isFemale ? 0.007 : 0.013, 0.012), browMat);
      brow.position.set(browX, 0.065, 0.11);
      brow.rotation.z = (i === 0 ? 0.14 : -0.14);
      headGroup.add(brow);
    });

    if (hasWrinkles) {
      const wrinkleMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinHex).multiplyScalar(0.72), roughness: 0.95 });
      for (let w = 0; w < 3; w++) {
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.075, 8), wrinkleMat);
        line.rotation.z = Math.PI / 2;
        line.position.set(0, 0.085 + w * 0.016, 0.104);
        headGroup.add(line);
      }
    }

    // 4. Anatomical Nose
    const noseGroup = new THREE.Group();
    noseGroup.position.set(0, 0.012, 0.108);

    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.048, 10), skinMat);
    bridge.position.set(0, 0.008, 0.01);
    bridge.rotation.x = -0.28;
    noseGroup.add(bridge);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 12), skinMat);
    tip.position.set(0, -0.016, 0.022);
    noseGroup.add(tip);

    [-0.015, 0.015].forEach(nox => {
      const flare = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 10), skinMat);
      flare.position.set(nox, -0.018, 0.014);
      noseGroup.add(flare);
    });
    headGroup.add(noseGroup);

    // 5. Ears
    [-0.114, 0.114].forEach((earX, i) => {
      const earGroup = new THREE.Group();
      earGroup.position.set(earX, 0.025, 0.01);
      earGroup.rotation.y = (i === 0 ? -0.25 : 0.25);

      const earHelix = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 14, Math.PI * 1.3), skinMat);
      earHelix.rotation.z = (i === 0 ? 0.3 : -0.3);
      earGroup.add(earHelix);

      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), skinMat);
      lobe.position.set(0, -0.022, 0);
      earGroup.add(lobe);

      if (hasEarrings) {
        const goldHook = new THREE.Mesh(new THREE.TorusGeometry(0.005, 0.0015, 6, 12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.2 }));
        goldHook.position.set(0, -0.028, 0);
        earGroup.add(goldHook);

        const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, transmission: 0.3 }));
        pearl.position.set(0, -0.037, 0);
        earGroup.add(pearl);
      }

      headGroup.add(earGroup);
    });

    // 6. Lips
    const lipMat = new THREE.MeshStandardMaterial({
      color: isFemale ? 0xb91c1c : new THREE.Color(skinHex).multiplyScalar(0.70),
      roughness: 0.65
    });

    if (isSmiling) {
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 8, 14, Math.PI * 0.7), lipMat);
      smile.rotation.z = Math.PI * 0.15;
      smile.position.set(0, -0.052, 0.106);
      headGroup.add(smile);
    } else {
      const topLip = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.0055, 0.046, 8), lipMat);
      topLip.rotation.z = Math.PI / 2;
      topLip.position.set(0, -0.046, 0.104);
      headGroup.add(topLip);

      const botLip = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.004, 0.042, 8), lipMat);
      botLip.rotation.z = Math.PI / 2;
      botLip.position.set(0, -0.056, 0.102);
      headGroup.add(botLip);
    }

    // 7. Facial Hair Types from User Photos
    const hairMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.85 });

    if (stacheType === 'posbiyik_dayi') {
      const stacheMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.98 });
      const leftStache = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.07, 12), stacheMat);
      leftStache.rotation.z = 0.52;
      leftStache.rotation.y = 0.28;
      leftStache.position.set(-0.028, -0.045, 0.116);
      headGroup.add(leftStache);

      const rightStache = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.07, 12), stacheMat);
      rightStache.rotation.z = -0.52;
      rightStache.rotation.y = -0.28;
      rightStache.position.set(0.028, -0.045, 0.116);
      headGroup.add(rightStache);

      const centerTuft = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 10), stacheMat);
      centerTuft.scale.set(1.5, 0.85, 1.1);
      centerTuft.position.set(0, -0.039, 0.12);
      headGroup.add(centerTuft);
    } else if (stacheType === 'hayrettin_beard') {
      const beardMat = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.9 });
      const jawBeard = new THREE.Mesh(new THREE.CylinderGeometry(0.114, 0.09, 0.08, 16), beardMat);
      jawBeard.position.set(0, -0.068, 0.038);
      headGroup.add(jawBeard);

      const hStache = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.075, 10), beardMat);
      hStache.rotation.z = Math.PI / 2;
      hStache.position.set(0, -0.042, 0.116);
      headGroup.add(hStache);
    } else if (stacheType === 'serdar_smile') {
      const sMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
      const sStache = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.06, 10), sMat);
      sStache.rotation.z = Math.PI / 2;
      sStache.position.set(0, -0.042, 0.112);
      headGroup.add(sStache);

      const sGoatee = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), sMat);
      sGoatee.position.set(0, -0.074, 0.095);
      headGroup.add(sGoatee);
    } else if (stacheType === 'kahkaha_stache') {
      const kMat = new THREE.MeshStandardMaterial({ color: 0x2b221c, roughness: 0.95 });
      const kStache = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.017, 0.08, 10), kMat);
      kStache.rotation.z = Math.PI / 2;
      kStache.position.set(0, -0.04, 0.118);
      headGroup.add(kStache);
    } else if (stacheType === 'stubble') {
      const stubbleMat = new THREE.MeshStandardMaterial({ color: hairHex, roughness: 0.95, opacity: 0.6, transparent: true });
      const stubble = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.08, 16), stubbleMat);
      stubble.position.set(0, -0.065, 0.038);
      headGroup.add(stubble);
    }

    // 8. Sunglasses
    if (sunglasses) {
      const darkGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x111827, roughness: 0.1, metalness: 0.8, transmission: 0.2 });
      const fMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.3 });

      [-0.042, 0.042].forEach(gx => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.032, 0.008), fMat);
        frame.position.set(gx, 0.034, 0.118);
        headGroup.add(frame);

        const lens = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.028, 0.009), darkGlassMat);
        lens.position.set(gx, 0.034, 0.118);
        headGroup.add(lens);
      });

      const sBridge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.006), fMat);
      sBridge.position.set(0, 0.036, 0.118);
      headGroup.add(sBridge);
    }

    // 9. Hair Styles
    if (hairStyle === 'dayi_hair') {
      const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 18, 0, Math.PI * 2, 0, Math.PI / 1.7), hairMat);
      hairCrown.position.set(0, 0.042, -0.012);
      headGroup.add(hairCrown);

      const frontTuft = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), hairMat);
      frontTuft.scale.set(1.4, 0.6, 0.8);
      frontTuft.position.set(0, 0.098, 0.075);
      headGroup.add(frontTuft);
    } else if (hairStyle === 'hayrettin_wavy') {
      const wavyCrown = new THREE.Mesh(new THREE.SphereGeometry(0.124, 20, 18, 0, Math.PI * 2, 0, Math.PI / 1.6), hairMat);
      wavyCrown.position.set(0, 0.046, -0.01);
      headGroup.add(wavyCrown);

      [-0.03, 0.02, 0.05].forEach((wx, i) => {
        const wave = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.05, 8), hairMat);
        wave.position.set(wx, 0.088, 0.085);
        wave.rotation.z = (i % 2 === 0 ? 0.35 : -0.35);
        wave.rotation.x = 0.4;
        headGroup.add(wave);
      });
    } else if (hairStyle === 'serdar_crop') {
      const sHair = new THREE.Mesh(new THREE.SphereGeometry(0.121, 20, 18, 0, Math.PI * 2, 0, Math.PI / 1.8), hairMat);
      sHair.position.set(0, 0.04, -0.01);
      headGroup.add(sHair);
    } else if (hairStyle === 'kasket_kahkaha') {
      const capTex = textureGen.getTweedCapTexture();
      const capMat = new THREE.MeshStandardMaterial({ map: capTex, roughness: 0.85 });

      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.148, 0.065, 16), capMat);
      crown.position.set(0, 0.104, -0.008);
      crown.rotation.x = 0.08;
      headGroup.add(crown);

      const capBtn = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 10), capMat);
      capBtn.position.set(0, 0.142, -0.008);
      headGroup.add(capBtn);

      const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.014, 20, 1, false, 0, Math.PI), capMat);
      visor.position.set(0, 0.084, 0.082);
      visor.rotation.y = -Math.PI / 2;
      visor.rotation.x = 0.28;
      headGroup.add(visor);
    } else if (hairStyle === 'long_brunette') {
      const hairCrown = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 20, 0, Math.PI * 2, 0, Math.PI / 1.6), hairMat);
      hairCrown.position.set(0, 0.038, -0.01);
      headGroup.add(hairCrown);

      [-0.105, 0.105].forEach(hx => {
        const curl = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.018, 0.28, 10), hairMat);
        curl.position.set(hx, -0.09, 0.025);
        headGroup.add(curl);
      });
    }

    // 10. Anatomical Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.12, 16), skinMat);
    neck.position.set(0, -0.12, 0);
    headGroup.add(neck);

    return headGroup;
  }

  // --- 1. RECEP DAYI (Fotoğraf 1 + Elinde İnce Belli Çay) ---
  createRecepDayi() {
    const group = new THREE.Group();
    const skinHex = 0xc27848;
    const burgundyTex = textureGen.getBurgundyShirtTexture();
    const burgundyMat = new THREE.MeshStandardMaterial({ map: burgundyTex, color: 0x881337, roughness: 0.85 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.65 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.46, 0.24), burgundyMat);
    torso.position.set(0, 0.77, 0);
    group.add(torso);

    const ribbing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 20), new THREE.MeshStandardMaterial({ color: 0x701a2b, roughness: 0.9 }));
    ribbing.rotation.x = Math.PI / 2;
    ribbing.position.set(0, 0.99, 0.01);
    group.add(ribbing);

    const leftJacket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.47, 0.26), jacketMat);
    leftJacket.position.set(-0.15, 0.77, 0.01);
    group.add(leftJacket);

    const rightJacket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.47, 0.26), jacketMat);
    rightJacket.position.set(0.15, 0.77, 0.01);
    group.add(rightJacket);

    const backJacket = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.47, 0.04), jacketMat);
    backJacket.position.set(0, 0.77, -0.115);
    group.add(backJacket);

    const headGroup = this.buildRealisticHead({
      skinHex: skinHex,
      hairHex: 0x141210,
      eyeIrisHex: 0x3d2314,
      stacheType: 'posbiyik_dayi',
      hairStyle: 'dayi_hair',
      hasWrinkles: true
    });
    group.add(headGroup);

    // Arms + Holding Authentic Turkish Tea Glass in Hand
    const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.65 });
    this.addArmsWithProp(group, jacketMat, skinMat, 'tea');
    this.addSeatedLegsAndChair(group);

    group.userData = { head: headGroup, baseRotY: 0, animOffset: Math.random() * 10 };
    return group;
  }

  // --- 2. HAYRETTİN (Fotoğraf 2 + Elinde Köpüklü Türk Kahvesi) ---
  createHayrettin() {
    const group = new THREE.Group();
    const skinHex = 0xd99b6c;
    const pinstripeTex = textureGen.getNavyPinstripeTexture();
    const pinstripeMat = new THREE.MeshStandardMaterial({ map: pinstripeTex, roughness: 0.7 });
    const whiteShirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.46, 0.25), pinstripeMat);
    torso.position.set(0, 0.77, 0);
    group.add(torso);

    const shirtV = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.26), whiteShirtMat);
    shirtV.position.set(0, 0.77, 0.005);
    group.add(shirtV);

    const leftCollar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.02), whiteShirtMat);
    leftCollar.position.set(-0.06, 0.97, 0.12);
    leftCollar.rotation.z = -0.4;
    group.add(leftCollar);

    const rightCollar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.02), whiteShirtMat);
    rightCollar.position.set(0.06, 0.97, 0.12);
    rightCollar.rotation.z = 0.4;
    group.add(rightCollar);

    const headGroup = this.buildRealisticHead({
      skinHex: skinHex,
      hairHex: 0x221a14,
      eyeIrisHex: 0x4a2e18,
      stacheType: 'hayrettin_beard',
      hairStyle: 'hayrettin_wavy',
      isSmiling: true
    });
    group.add(headGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.6 });
    this.addArmsWithProp(group, pinstripeMat, skinMat, 'coffee');
    this.addSeatedLegsAndChair(group);

    group.userData = { head: headGroup, baseRotY: 0, animOffset: Math.random() * 10 };
    return group;
  }

  // --- 3. SERDAR ORTAÇ (Fotoğraf 3 + Çay Bardağı) ---
  createSerdarOrtac() {
    const group = new THREE.Group();
    const skinHex = 0xdb9f70;
    const greyJacketMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.75 });
    const blackInnerMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.46, 0.24), greyJacketMat);
    torso.position.set(0, 0.77, 0);
    group.add(torso);

    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.25), blackInnerMat);
    inner.position.set(0, 0.77, 0.005);
    group.add(inner);

    const headGroup = this.buildRealisticHead({
      skinHex: skinHex,
      hairHex: 0x18181b,
      eyeIrisHex: 0x3d2314,
      stacheType: 'serdar_smile',
      hairStyle: 'serdar_crop',
      isSmiling: true
    });
    group.add(headGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.6 });
    this.addArmsWithProp(group, greyJacketMat, skinMat, 'tea');
    this.addSeatedLegsAndChair(group);

    group.userData = { head: headGroup, baseRotY: 0, animOffset: Math.random() * 10 };
    return group;
  }

  // --- 4. KAHKAHA ATAN KASKETLİ DAYI (Fotoğraf 3 + Otantik Kıraathane Nargilesi) ---
  createKahkahaDayi() {
    const group = new THREE.Group();
    const skinHex = 0xd59560;
    const blueShirtMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.75 });
    const yellowScarfMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.9 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.46, 0.25), blueShirtMat);
    torso.position.set(0, 0.77, 0);
    group.add(torso);

    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.48, 0.27), yellowScarfMat);
    scarf.position.set(-0.14, 0.77, 0.01);
    group.add(scarf);

    const headGroup = this.buildRealisticHead({
      skinHex: skinHex,
      hairHex: 0x2b221c,
      eyeIrisHex: 0x3d2314,
      stacheType: 'kahkaha_stache',
      hairStyle: 'kasket_kahkaha',
      isSmiling: true
    });
    group.add(headGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.65 });
    this.addArmsWithProp(group, blueShirtMat, skinMat, 'nargile');
    this.addSeatedLegsAndChair(group);

    // Standing Ottoman Nargile by his right side on the floor
    const nargile = createOttomanNargile(0.95);
    nargile.position.set(0.38, 0, 0.15);
    group.add(nargile);

    group.userData = { head: headGroup, baseRotY: 0, animOffset: Math.random() * 10 };
    return group;
  }

  // --- 5. GÖZLÜKLÜ ABİ ---
  createGozlukluAbi() {
    const group = new THREE.Group();
    const skinHex = 0xd9a066;
    const poloMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.46, 0.24), poloMat);
    torso.position.set(0, 0.77, 0);
    group.add(torso);

    const headGroup = this.buildRealisticHead({
      skinHex: skinHex,
      hairHex: 0x18181b,
      eyeIrisHex: 0x3d2314,
      stacheType: 'stubble',
      hairStyle: 'serdar_crop',
      sunglasses: true
    });
    group.add(headGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.6 });
    this.addArmsWithProp(group, poloMat, skinMat, 'coffee');
    this.addSeatedLegsAndChair(group);

    group.userData = { head: headGroup, baseRotY: 0, animOffset: Math.random() * 10 };
    return group;
  }

  // --- 6. AYŞE HANIM ---
  createAyseHanim() {
    const group = new THREE.Group();
    const skinHex = 0xf5d0b5;
    const dressMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.65, metalness: 0.05 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.22), dressMat);
    torso.position.set(0, 0.77, 0);
    group.add(torso);

    const headGroup = this.buildRealisticHead({
      skinHex: skinHex,
      roughness: 0.52,
      hairHex: 0x22130c,
      eyeIrisHex: 0x5a3319,
      isFemale: true,
      hairStyle: 'long_brunette',
      hasEarrings: true
    });
    group.add(headGroup);

    const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.55 });
    this.addArmsWithProp(group, dressMat, skinMat, 'tea');
    this.addSeatedLegsAndChair(group);

    group.userData = { head: headGroup, baseRotY: 0, animOffset: Math.random() * 10 };
    return group;
  }

  // --- ARMS WITH HELD PROPS (ÇAY, TÜRK KAHVESİ, NARGİLE MARPUCU) ---
  addArmsWithProp(group, sleeveMat, skinMat, propType = 'none') {
    // Left Arm (Rests naturally on the table edge)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.22, 0.94, 0);

    const bicep1 = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.22, 12), sleeveMat);
    bicep1.position.y = -0.11;
    leftArm.add(bicep1);

    const forearm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.24, 12), skinMat);
    forearm1.position.set(0.07, -0.22, 0.13);
    forearm1.rotation.x = -Math.PI / 3.2;
    forearm1.rotation.z = -0.28;
    leftArm.add(forearm1);

    const leftHand = this.createDetailedHand(skinMat, false);
    leftHand.position.set(0.12, -0.32, 0.24);
    leftHand.rotation.x = -Math.PI / 4;
    leftHand.rotation.y = 0.2;
    leftArm.add(leftHand);

    group.add(leftArm);

    // Right Arm (Holds the beverage / shisha hose)
    const rightArm = new THREE.Group();
    rightArm.position.set(0.22, 0.94, 0);

    const bicep2 = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.22, 12), sleeveMat);
    bicep2.position.y = -0.11;
    rightArm.add(bicep2);

    const forearm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.24, 12), skinMat);
    
    if (propType === 'tea' || propType === 'coffee') {
      // Forearm raised slightly holding cup
      forearm2.position.set(-0.06, -0.20, 0.15);
      forearm2.rotation.x = -Math.PI / 2.6;
      forearm2.rotation.z = 0.22;
      rightArm.add(forearm2);

      const rightHand = this.createDetailedHand(skinMat, true, true);
      rightHand.position.set(-0.09, -0.28, 0.26);
      rightHand.rotation.x = -Math.PI / 3.5;
      rightArm.add(rightHand);

      // Attach Beverage to right hand
      if (propType === 'tea') {
        const teaGlass = createAuthenticTeaGlass(0.88);
        teaGlass.position.set(-0.09, -0.29, 0.28);
        rightArm.add(teaGlass);
      } else if (propType === 'coffee') {
        const coffeeCup = createTurkishCoffeeCup(0.88);
        coffeeCup.position.set(-0.09, -0.29, 0.28);
        rightArm.add(coffeeCup);
      }

    } else if (propType === 'nargile') {
      // Holding Shisha Hose Mouthpiece (Marpuç)
      forearm2.position.set(-0.05, -0.18, 0.16);
      forearm2.rotation.x = -Math.PI / 2.3;
      forearm2.rotation.z = 0.15;
      rightArm.add(forearm2);

      const rightHand = this.createDetailedHand(skinMat, true, true);
      rightHand.position.set(-0.06, -0.24, 0.27);
      rightArm.add(rightHand);

      // Shisha Hose tip in hand
      const marpucInHand = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 }));
      marpucInHand.position.set(-0.06, -0.24, 0.28);
      marpucInHand.rotation.x = 0.4;
      rightArm.add(marpucInHand);

    } else {
      forearm2.position.set(-0.07, -0.22, 0.13);
      forearm2.rotation.x = -Math.PI / 3.2;
      forearm2.rotation.z = 0.28;
      rightArm.add(forearm2);

      const rightHand = this.createDetailedHand(skinMat, true);
      rightHand.position.set(-0.12, -0.32, 0.24);
      rightHand.rotation.x = -Math.PI / 4;
      rightHand.rotation.y = -0.2;
      rightArm.add(rightHand);
    }

    group.add(rightArm);
  }

  createDetailedHand(skinMat, isRight = false, isGripping = false) {
    const handGroup = new THREE.Group();

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.016, 0.055), skinMat);
    handGroup.add(palm);

    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.035, 8), skinMat);
    thumb.position.set(isRight ? -0.028 : 0.028, -0.004, 0.012);
    thumb.rotation.z = isRight ? -0.7 : 0.7;
    if (isGripping) thumb.rotation.x = 0.5;
    handGroup.add(thumb);

    const fingerLengths = [0.038, 0.044, 0.040, 0.032];
    const fingerPositions = [-0.018, -0.006, 0.006, 0.018];

    fingerPositions.forEach((fx, i) => {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0048, fingerLengths[i], 8), skinMat);
      finger.position.set(isRight ? -fx : fx, 0, 0.028 + fingerLengths[i] * 0.45);
      finger.rotation.x = isGripping ? (Math.PI / 2 + 0.6) : (Math.PI / 2 + 0.15);
      handGroup.add(finger);
    });

    return handGroup;
  }

  addSeatedLegsAndChair(group) {
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });

    const leftThigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.36), pantsMat);
    leftThigh.position.set(-0.1, 0.52, 0.15);
    group.add(leftThigh);

    const rightThigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.36), pantsMat);
    rightThigh.position.set(0.1, 0.52, 0.15);
    group.add(rightThigh);

    const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.46, 12), pantsMat);
    leftShin.position.set(-0.1, 0.26, 0.3);
    group.add(leftShin);

    const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.46, 12), pantsMat);
    rightShin.position.set(0.1, 0.26, 0.3);
    group.add(rightShin);

    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.35, metalness: 0.2 });
    [-0.1, 0.1].forEach(sx => {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.18), shoeMat);
      shoe.position.set(sx, 0.03, 0.34);
      group.add(shoe);
    });

    const chairGroup = this.createCafeChair();
    chairGroup.position.set(0, 0, 0);
    group.add(chairGroup);
  }

  createCafeChair() {
    const chair = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x2b1810, roughness: 0.45, metalness: 0.05 });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.44), woodMat);
    seat.position.set(0, 0.48, 0);
    chair.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.035), woodMat);
    back.position.set(0, 0.72, -0.19);
    chair.add(back);

    const legGeo = new THREE.CylinderGeometry(0.02, 0.016, 0.48, 10);
    [[-0.18, 0.24, -0.18], [0.18, 0.24, -0.18], [-0.18, 0.24, 0.18], [0.18, 0.24, 0.18]].forEach(p => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(...p);
      chair.add(leg);
    });

    return chair;
  }

  createCharacter(id = 'dayi') {
    return this.createAvatarById(id);
  }
}

export const avatarBuilder = new AvatarBuilder();
