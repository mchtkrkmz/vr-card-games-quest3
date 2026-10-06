import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { createCard3DMesh, SUITS } from '../engine/cards.js';
import { createOkeyTile3DMesh, createIstaka3DMesh, OKEY_COLORS } from '../engine/okey/tiles.js';
import { avatarBuilder, createAuthenticTeaGlass, createTurkishCoffeeCup, createOttomanNargile } from './avatars.js';
import { soundFx } from '../engine/audio.js';
import { spatialVoice } from '../engine/voiceChat.js';

export const KIRAATHANE_THEMES = [
  {
    id: 'balat',
    name: 'Tarihi Balat Kıraathanesi',
    location: 'Fener & Balat / Haliç',
    badge: 'Tarihi Doku',
    image: './assets/env_balat.jpg',
    desc: 'Tarihi kırmızı tuğla duvarlar, antika saatler ve sıcak kehribar aydınlatma.',
    fogColor: 0x120d09,
    lightColor: 0xffeedd,
    spotColor: 0xfff1d0,
    ambientIntensity: 0.52
  },
  {
    id: 'bosphorus',
    name: 'Çengelköy Çınaraltı Boğaz Kahvesi',
    location: 'Çengelköy Sahili / Boğaziçi',
    badge: 'Boğaz Manzarası',
    image: './assets/env_bosphorus.jpg',
    desc: 'Asırlık çınar ağacı altında panoramik masmavi Boğaz ve vapur manzarası.',
    fogColor: 0x0a1628,
    lightColor: 0xe0f2fe,
    spotColor: 0xf8fafc,
    ambientIntensity: 0.70
  },
  {
    id: 'kapalicarsi',
    name: 'Tarihi Kapalıçarşı & Beyazıt',
    location: 'Kapalıçarşı / Beyazıt',
    badge: 'Osmanlı Çinili',
    image: './assets/env_kapalicarsi.jpg',
    desc: 'Tarihi Osmanlı taş kemerleri, mavi İznik çinileri ve renkli mozaik lambalar.',
    fogColor: 0x1a120b,
    lightColor: 0xfef3c7,
    spotColor: 0xfde68a,
    ambientIntensity: 0.55
  },
  {
    id: 'classic',
    name: 'Nostaljik 1923 İstanbul Kıraathanesi',
    location: 'Süleymaniye / Eminönü',
    badge: 'Nostaljik',
    image: './assets/env_classic.jpg',
    desc: 'Ahşap lambri kaplamalar, pirinç çay semaveri ve asırlık İstanbul hatıraları.',
    fogColor: 0x0c0e14,
    lightColor: 0xffedd5,
    spotColor: 0xffedd5,
    ambientIntensity: 0.48
  }
];

export class VRCardScene {
  constructor(containerElement) {
    this.container = containerElement;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Core Three.js components
    this.scene = null;
    this.cameraRig = null; // WebXR Dolly / Player Body Anchor
    this.camera = null;
    this.playerChair = null; // Local Player's Authentic Cafe Chair
    this.hasCalibratedVRSeat = false;
    this._lastThumbClickTime = 0;
    this.permanentInteractiveButtons = [];
    this.renderer = null;
    this.ambientLight = null;
    this.tableSpot = null;
    this.backWallMuralMesh = null;
    this.currentThemeId = localStorage.getItem('korkmaz_kiraathane_theme') || 'balat';
    this.themeChangeCallbacks = [];

    // VR specific
    this.controllers = [];
    this.controllerGrips = [];
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();

    // Table & Scene elements
    this.tableGroup = null;
    this.playerHandGroup = null; // Cards
    this.playerIstakaGroup = null; // Okey
    this.opponentHandGroups = [];
    this.opponentIstakaGroups = [];
    this.opponentAvatars = []; // 3 seated table opponents
    this.backgroundAvatars = []; // Patrons at side tables
    this.tableCenterGroup = null;
    this.discardGroups = [];
    this.openedPersGroup = null; // 101 Okey opened pers on table

    // UI in 3D
    this.floatingHudMesh = null;
    this.hudCanvas = null;
    this.hudContext = null;
    this.hudTexture = null;
    this.interactive3DButtons = [];

    // State
    this.activeGameType = 'BATAK';
    this.onCardSelectedCallback = null;
    this.onTileSelectedCallback = null;
    this.onCenterStackClickCallback = null;
    this.onOpenHandClickCallback = null;

    // Animation queue
    this.animatingMeshes = [];

    // Desktop/Mobile interactions
    this.isVRActive = false;
    this.mouse = new THREE.Vector2();
    this.desktopRaycaster = new THREE.Raycaster();
    this.speechIndicators = new Map();

    spatialVoice.onTalkingUpdate((seatIndex, isTalking, volume) => {
      const indicator = this.speechIndicators.get(seatIndex);
      if (indicator) {
        indicator.visible = isTalking;
        if (isTalking) {
          const scale = 1 + Math.min(volume / 60, 0.6);
          indicator.scale.set(scale, scale, scale);
        }
      }
    });

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0e14);
    this.scene.fog = new THREE.FogExp2(0x0c0e14, 0.09);

    // Camera Rig (Dolly): Anchors player's physical headset & controllers to the chair
    this.cameraRig = new THREE.Group();
    this.cameraRig.name = 'CameraRig';
    this.cameraRig.position.set(0, 0, 0); // Origin for Desktop mode
    this.scene.add(this.cameraRig);

    this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.05, 50);
    this.camera.position.set(0, 1.25, 0.95);
    this.camera.lookAt(0, 0.85, 0);
    this.cameraRig.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    const vrBtn = VRButton.createButton(this.renderer);
    vrBtn.id = 'vr-enter-button';
    vrBtn.style.position = 'fixed';
    vrBtn.style.bottom = '24px';
    vrBtn.style.left = '50%';
    vrBtn.style.transform = 'translateX(-50%)';
    vrBtn.style.zIndex = '99999';
    vrBtn.style.padding = '14px 28px';
    vrBtn.style.background = 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
    vrBtn.style.border = '2px solid #60a5fa';
    vrBtn.style.borderRadius = '30px';
    vrBtn.style.color = '#ffffff';
    vrBtn.style.fontFamily = 'sans-serif';
    vrBtn.style.fontSize = '16px';
    vrBtn.style.fontWeight = 'bold';
    vrBtn.style.boxShadow = '0 0 25px rgba(59, 130, 246, 0.6)';
    vrBtn.style.cursor = 'pointer';
    document.body.appendChild(vrBtn);

    this.renderer.xr.addEventListener('sessionstart', () => {
      this.isVRActive = true;
      this.hasCalibratedVRSeat = false;
      soundFx.initContext();

      // Immediately place camera rig at the player's chair (Z = 1.05m)
      this.cameraRig.position.set(0, 0, 1.05);

      // Listen for Meta Quest OS recenter (holding Meta button on right controller)
      const refSpace = this.renderer.xr.getReferenceSpace();
      if (refSpace) {
        refSpace.addEventListener('reset', () => {
          this.recenterToChair();
        });
      }
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.isVRActive = false;
      this.hasCalibratedVRSeat = false;
      this.cameraRig.position.set(0, 0, 0);
      this.camera.position.set(0, 1.25, 0.95);
      this.camera.lookAt(0, 0.85, 0);
    });

    this.buildLighting();
    this.buildKahvehaneEnvironment();
    this.buildCardTable();
    this.buildPlayerChair();
    this.buildTableOpponentAvatars();
    this.buildSideTablePatrons();
    this.buildFloatingVRHUD();
    this.setupControllers();

    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.setupDesktopInteractions();

    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  buildLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffeedd, 0.52);
    this.scene.add(this.ambientLight);

    this.tableSpot = new THREE.SpotLight(0xfff1d0, 5.0, 8, Math.PI / 3, 0.4, 1.2);
    this.tableSpot.position.set(0, 2.8, 0);
    this.tableSpot.target.position.set(0, 0.8, 0);
    this.tableSpot.castShadow = true;
    this.tableSpot.shadow.mapSize.width = 2048;
    this.tableSpot.shadow.mapSize.height = 2048;
    this.scene.add(this.tableSpot);
    this.scene.add(this.tableSpot.target);

    // Chandelier
    const chandelierGroup = new THREE.Group();
    chandelierGroup.position.set(0, 2.7, 0);

    const chainGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.6, 8);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.2 });
    const chainMesh = new THREE.Mesh(chainGeo, goldMat);
    chainMesh.position.y = 0.3;
    chandelierGroup.add(chainMesh);

    const shadeGeo = new THREE.ConeGeometry(0.35, 0.22, 24, 1, true);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide });
    const shadeMesh = new THREE.Mesh(shadeGeo, shadeMat);
    shadeMesh.rotation.x = Math.PI;
    chandelierGroup.add(shadeMesh);

    const bulbGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff7ed });
    const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
    bulbMesh.position.y = -0.05;
    chandelierGroup.add(bulbMesh);

    this.scene.add(chandelierGroup);

    // Warm side lights
    this.amberRim = new THREE.PointLight(0xf59e0b, 1.5, 12);
    this.amberRim.position.set(3.5, 2.2, -1);
    this.scene.add(this.amberRim);

    this.leftAmber = new THREE.PointLight(0xf59e0b, 1.5, 12);
    this.leftAmber.position.set(-3.5, 2.2, -1);
    this.scene.add(this.leftAmber);
  }

  buildKahvehaneEnvironment() {
    // Parquet Floor
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x16100c, roughness: 0.5, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Turkish Wood Paneling Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x131720, roughness: 0.85 });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), wallMat);
    backWall.position.set(0, 3, -7);
    this.scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), wallMat);
    leftWall.position.set(-7, 3, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 6), wallMat);
    rightWall.position.set(7, 3, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.scene.add(rightWall);

    // Realistic Istanbul Kıraathane Dynamic Panoramic Mural Wall
    const initialTheme = KIRAATHANE_THEMES.find(t => t.id === this.currentThemeId) || KIRAATHANE_THEMES[0];
    const texLoader = new THREE.TextureLoader();
    const muralTex = texLoader.load(initialTheme.image, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    });

    const muralMat = new THREE.MeshStandardMaterial({
      map: muralTex,
      roughness: 0.45,
      metalness: 0.05
    });

    const muralGeo = new THREE.PlaneGeometry(16.5, 5.8);
    this.backWallMuralMesh = new THREE.Mesh(muralGeo, muralMat);
    this.backWallMuralMesh.position.set(0, 3.0, -6.94);
    this.scene.add(this.backWallMuralMesh);

    // 1. Traditional Turkish Kilim Rug
    this.buildTurkishKilimMesh(0, 3.1, -6.90, 3.6, 2.0);

    // 2. Framed Vintage Paintings & Turkish Wall Clock
    this.buildFramedArtwork(-3.5, 2.9, -6.90, 1.4, 1.0, 'ISTANBUL 1923', './assets/env_classic.jpg');
    this.buildFramedArtwork(3.5, 2.9, -6.90, 1.4, 1.0, 'KIRAATHANE', './assets/env_bosphorus.jpg');
    this.buildWallClock(0, 4.4, -6.88);

    // 3. Copper Turkish Tea Samovar & Counter (Çay Kazanı / Ocakbaşı)
    this.buildTeaSamovarCounter(-4.8, 0, -4.5);

    // Apply initial theme settings
    this.setKiraathaneEnvironment(this.currentThemeId, false);
  }

  setKiraathaneEnvironment(themeId = 'balat', save = true) {
    const theme = KIRAATHANE_THEMES.find(t => t.id === themeId) || KIRAATHANE_THEMES[0];
    this.currentThemeId = theme.id;
    if (save) {
      localStorage.setItem('korkmaz_kiraathane_theme', theme.id);
    }

    // 1. Update Panoramic Mural Background
    if (this.backWallMuralMesh) {
      const texLoader = new THREE.TextureLoader();
      texLoader.load(theme.image, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        this.backWallMuralMesh.material.map = tex;
        this.backWallMuralMesh.material.needsUpdate = true;
      });
    }

    // 2. Update Lighting & Atmosphere
    if (this.ambientLight) {
      this.ambientLight.color.setHex(theme.lightColor);
      this.ambientLight.intensity = theme.ambientIntensity;
    }
    if (this.tableSpot) {
      this.tableSpot.color.setHex(theme.spotColor);
    }
    if (this.scene) {
      this.scene.background = new THREE.Color(theme.fogColor);
      if (this.scene.fog) {
        this.scene.fog.color.setHex(theme.fogColor);
      }
    }

    // Notify listeners
    this.themeChangeCallbacks.forEach(cb => cb(theme));
  }

  onThemeChange(cb) {
    if (typeof cb === 'function') {
      this.themeChangeCallbacks.push(cb);
    }
  }

  buildWallClock(x, y, z) {
    const clockGroup = new THREE.Group();
    clockGroup.position.set(x, y, z);

    // Wooden ring
    const ringGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 32);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.4 });
    const ring = new THREE.Mesh(ringGeo, woodMat);
    ring.rotation.x = Math.PI / 2;
    clockGroup.add(ring);

    // Clock Face
    const faceGeo = new THREE.CircleGeometry(0.26, 32);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#faf8f5';
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let num = 1; num <= 12; num++) {
      const angle = (num / 12) * Math.PI * 2 - Math.PI / 2;
      const nx = 128 + Math.cos(angle) * 95;
      const ny = 128 + Math.sin(angle) * 95;
      ctx.fillText(`${num}`, nx, ny);
    }

    // Hands
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128, 60);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(180, 128);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    const faceMat = new THREE.MeshBasicMaterial({ map: tex });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = 0.022;
    clockGroup.add(face);

    this.scene.add(clockGroup);
  }

  buildTeaSamovarCounter(x, y, z) {
    const counterGroup = new THREE.Group();
    counterGroup.position.set(x, y, z);

    // Wooden counter desk
    const deskGeo = new THREE.BoxGeometry(1.6, 0.9, 0.8);
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x241108, roughness: 0.4 });
    const desk = new THREE.Mesh(deskGeo, deskMat);
    desk.position.y = 0.45;
    counterGroup.add(desk);

    // Copper Samovar (Bakır Çay Kazanı)
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.85, roughness: 0.25 });
    const boilerGeo = new THREE.CylinderGeometry(0.22, 0.2, 0.55, 20);
    const boiler = new THREE.Mesh(boilerGeo, copperMat);
    boiler.position.set(0, 1.18, 0);
    counterGroup.add(boiler);

    // Teapot on top (Demlik)
    const potGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.2, 16);
    const pot = new THREE.Mesh(potGeo, copperMat);
    pot.position.set(0, 1.52, 0);
    counterGroup.add(pot);

    // Row of little tea glasses on tray
    for (let i = 0; i < 4; i++) {
      const gGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.06, 12);
      const gMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.9, opacity: 0.9, transparent: true });
      const glass = new THREE.Mesh(gGeo, gMat);
      glass.position.set(-0.5 + i * 0.12, 0.93, 0.15);
      counterGroup.add(glass);
    }

    this.scene.add(counterGroup);
  }

  buildTurkishKilimMesh(x, y, z, w, h) {
    const texLoader = new THREE.TextureLoader();
    const kilimTex = texLoader.load('./assets/kilim.jpg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    });

    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshStandardMaterial({
      map: kilimTex,
      roughness: 0.88,
      metalness: 0.05
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
  }

  buildFramedArtwork(x, y, z, w, h, title, imagePath = './assets/istanbul_cafe.jpg') {
    const texLoader = new THREE.TextureLoader();
    const artTex = texLoader.load(imagePath, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    });

    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshStandardMaterial({
      map: artTex,
      roughness: 0.35,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);

    // Ornate Carved Gold / Mahogany Picture Frame
    const frameGeo = new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.05);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xb45309, // Antique gold / polished mahogany
      metalness: 0.8,
      roughness: 0.3
    });
    const frameMesh = new THREE.Mesh(frameGeo, frameMat);
    frameMesh.position.set(x, y, z - 0.025);

    this.scene.add(frameMesh);
    this.scene.add(mesh);
  }

  // --- 3D HUMAN CHARACTERS (OPPONENTS & CAFE PATRONS) ---
  buildTableOpponentAvatars() {
    this.opponentAvatars = [];
    this.updateTableAvatars();
  }

  updateTableAvatars(players = []) {
    if (this.opponentAvatars && this.opponentAvatars.length > 0) {
      this.opponentAvatars.forEach(av => {
        this.scene.remove(av);
      });
    }
    this.opponentAvatars = [];

    // Clear old speech indicators
    if (this.speechIndicators) {
      this.speechIndicators.forEach(mesh => this.scene.remove(mesh));
      this.speechIndicators.clear();
    }

    const defaultPresets = ['dayi', 'hayrettin', 'serdar'];
    const seatConfigs = [
      { seat: 1, pos: [1.02, 0, 0], rotY: -Math.PI / 2 },
      { seat: 2, pos: [0, 0, -1.02], rotY: 0 },
      { seat: 3, pos: [-1.02, 0, 0], rotY: Math.PI / 2 }
    ];

    seatConfigs.forEach((cfg, idx) => {
      const p = players[cfg.seat];
      const avatarId = p?.avatarId || defaultPresets[idx];
      const avatarMesh = avatarBuilder.createAvatarById(avatarId);
      avatarMesh.position.set(...cfg.pos);
      avatarMesh.rotation.y = cfg.rotY;
      avatarMesh.userData.baseRotY = cfg.rotY;
      this.scene.add(avatarMesh);
      this.opponentAvatars.push(avatarMesh);

      // Voice speech indicator ring above head
      const haloGeo = new THREE.RingGeometry(0.08, 0.12, 24);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(cfg.pos[0], 1.68, cfg.pos[2]);
      halo.visible = false;
      this.scene.add(halo);
      this.speechIndicators.set(cfg.seat, halo);
    });
  }

  buildSideTablePatrons() {
    this.backgroundAvatars = [];

    // Side Table 1 (Back Right Cafe Table)
    this.buildCafeTableWithPatrons(3.6, 0, -3.2);

    // Side Table 2 (Back Left Cafe Table)
    this.buildCafeTableWithPatrons(-3.6, 0, -3.2);

    // Side Table 3 (Front Right Cafe Table)
    this.buildCafeTableWithPatrons(3.8, 0, 1.8);
  }

  buildCafeTableWithPatrons(x, y, z) {
    const tableGroup = new THREE.Group();
    tableGroup.position.set(x, y, z);

    // Table
    const topGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.04, 32);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x241108, roughness: 0.4 });
    const topMesh = new THREE.Mesh(topGeo, woodMat);
    topMesh.position.y = 0.8;
    tableGroup.add(topMesh);

    const legGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.8, 12);
    const legMesh = new THREE.Mesh(legGeo, woodMat);
    legMesh.position.y = 0.4;
    tableGroup.add(legMesh);

    // Green felt insert
    const feltGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.01, 32);
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x0f3b25, roughness: 0.85 });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.position.y = 0.82;
    tableGroup.add(felt);

    // Two seated patrons facing each other
    const patron1 = avatarBuilder.createCharacter();
    patron1.position.set(0, 0, 0.72);
    patron1.rotation.y = Math.PI;
    patron1.userData.baseRotY = Math.PI;
    tableGroup.add(patron1);
    this.backgroundAvatars.push(patron1);

    const patron2 = avatarBuilder.createCharacter();
    patron2.position.set(0, 0, -0.72);
    patron2.rotation.y = 0;
    patron2.userData.baseRotY = 0;
    tableGroup.add(patron2);
    this.backgroundAvatars.push(patron2);

    this.scene.add(tableGroup);
  }

  buildCardTable() {
    this.tableGroup = new THREE.Group();
    this.tableGroup.position.set(0, 0, 0);

    const tableRadius = 0.95;
    const tableHeight = 0.82;

    // Table Top Rim
    const rimGeo = new THREE.CylinderGeometry(tableRadius + 0.08, tableRadius + 0.08, 0.06, 48);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x241108, roughness: 0.3, metalness: 0.2 });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = tableHeight - 0.03;
    rimMesh.receiveShadow = true;
    rimMesh.castShadow = true;
    this.tableGroup.add(rimMesh);

    // Felt Inset
    const feltGeo = new THREE.CylinderGeometry(tableRadius, tableRadius, 0.02, 48);
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x0f3b25, roughness: 0.88, metalness: 0.02 });
    const feltMesh = new THREE.Mesh(feltGeo, feltMat);
    feltMesh.position.y = tableHeight;
    feltMesh.receiveShadow = true;
    this.tableGroup.add(feltMesh);

    // Gold decorative inlay
    const goldRingGeo = new THREE.RingGeometry(tableRadius * 0.72, tableRadius * 0.73, 48);
    const goldRingMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide });
    const goldRing = new THREE.Mesh(goldRingGeo, goldRingMat);
    goldRing.rotation.x = -Math.PI / 2;
    goldRing.position.y = tableHeight + 0.011;
    this.tableGroup.add(goldRing);

    // Pedestal Leg
    const legGeo = new THREE.CylinderGeometry(0.12, 0.25, tableHeight - 0.06, 24);
    const legMesh = new THREE.Mesh(legGeo, rimMat);
    legMesh.position.y = (tableHeight - 0.06) / 2;
    this.tableGroup.add(legMesh);

    // 1. Authentic Turkish "İnce Belli" Tea on Player's Table Right
    this.buildTurkishTeaGlass(tableRadius * 0.72, tableHeight + 0.012, 0.36);

    // 2. Authentic Frothy Turkish Coffee Cup with Lokum on Table Left
    const coffeeCup = createTurkishCoffeeCup(1.0);
    coffeeCup.position.set(-tableRadius * 0.70, tableHeight + 0.012, 0.32);
    this.tableGroup.add(coffeeCup);

    // 3. Authentic Standing Ottoman Kıraathane Nargilesi beside table
    const tableNargile = createOttomanNargile(1.0);
    tableNargile.position.set(-1.18, 0, -0.45);
    this.scene.add(tableNargile);

    // Center Table Area (Lies directly on green felt cloth)
    this.tableCenterGroup = new THREE.Group();
    this.tableCenterGroup.position.set(0, tableHeight + 0.006, 0);
    this.tableGroup.add(this.tableCenterGroup);

    // 101 Okey Opened Pers area
    this.openedPersGroup = new THREE.Group();
    this.openedPersGroup.position.set(0, tableHeight + 0.008, 0);
    this.tableGroup.add(this.openedPersGroup);

    // Player Hand Group (Natural position in lower foreground right at player's table side)
    this.playerHandGroup = new THREE.Group();
    this.playerHandGroup.position.set(0, tableHeight + 0.048, 0.54);
    this.playerHandGroup.rotation.x = -Math.PI / 4.4;
    this.scene.add(this.playerHandGroup);

    // Player 3D Istaka (Tilted and positioned cleanly in player's foreground)
    this.playerIstakaGroup = new THREE.Group();
    this.playerIstakaGroup.position.set(0, tableHeight + 0.038, 0.50);
    this.playerIstakaGroup.rotation.x = -Math.PI / 5.2;
    const playerRackMesh = createIstaka3DMesh();
    this.playerIstakaGroup.add(playerRackMesh);
    this.playerIstakaGroup.visible = false;
    this.scene.add(this.playerIstakaGroup);

    // Opponents
    this.opponentHandGroups = [];
    this.opponentIstakaGroups = [];
    this.discardGroups = [];

    const oppPositions = [
      { pos: [0.72, tableHeight + 0.08, 0], rotY: -Math.PI / 2 },
      { pos: [0, tableHeight + 0.08, -0.72], rotY: Math.PI },
      { pos: [-0.72, tableHeight + 0.08, 0], rotY: Math.PI / 2 }
    ];

    oppPositions.forEach((opp) => {
      const hg = new THREE.Group();
      hg.position.set(...opp.pos);
      hg.rotation.y = opp.rotY;
      this.tableGroup.add(hg);
      this.opponentHandGroups.push(hg);

      const ig = new THREE.Group();
      ig.position.set(...opp.pos);
      ig.rotation.y = opp.rotY;
      ig.position.y = tableHeight + 0.02;
      const oppRack = createIstaka3DMesh();
      ig.add(oppRack);
      ig.visible = false;
      this.tableGroup.add(ig);
      this.opponentIstakaGroups.push(ig);
    });

    // 4 Discard Areas
    const discardPositions = [
      [0.32, tableHeight + 0.012, 0.38],
      [0.38, tableHeight + 0.012, -0.32],
      [-0.32, tableHeight + 0.012, -0.38],
      [-0.38, tableHeight + 0.012, 0.32]
    ];

    discardPositions.forEach(pos => {
      const dg = new THREE.Group();
      dg.position.set(...pos);
      this.tableGroup.add(dg);
      this.discardGroups.push(dg);
    });

    this.buildPermanentVRControls();
    this.scene.add(this.tableGroup);
  }

  buildTurkishTeaGlass(x, y, z) {
    const teaGroup = createAuthenticTeaGlass(1.0);
    teaGroup.position.set(x, y, z);

    // Soft Smooth Steam Vapor Particles (Yumuşak Sıcak Buhar)
    const steamGeo = new THREE.BufferGeometry();
    const steamCount = 28;
    const steamPos = new Float32Array(steamCount * 3);
    for (let i = 0; i < steamCount * 3; i += 3) {
      steamPos[i] = (Math.random() - 0.5) * 0.022;
      steamPos[i + 1] = 0.07 + Math.random() * 0.10;
      steamPos[i + 2] = (Math.random() - 0.5) * 0.022;
    }
    steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPos, 3));

    // Create a circular soft particle canvas texture for smooth steam
    const sCanvas = document.createElement('canvas');
    sCanvas.width = 64;
    sCanvas.height = 64;
    const sCtx = sCanvas.getContext('2d');
    const grad = sCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 64, 64);
    const steamTex = new THREE.CanvasTexture(sCanvas);

    const steamMat = new THREE.PointsMaterial({
      map: steamTex,
      size: 0.032,
      transparent: true,
      opacity: 0.40,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.steamPoints = new THREE.Points(steamGeo, steamMat);
    teaGroup.add(this.steamPoints);

    this.tableGroup.add(teaGroup);
  }

  buildPlayerChair() {
    if (this.playerChair) {
      this.scene.remove(this.playerChair);
    }
    // Authentic Kıraathane Chair for Local Player (Seat 0: X=0, Z=1.05m, facing table)
    this.playerChair = avatarBuilder.createCafeChair();
    this.playerChair.position.set(0, 0, 1.05);
    this.playerChair.rotation.y = Math.PI; // Face forward (-Z) towards table

    // Deluxe Kahvehane emerald green felt cushion for player's comfort
    const cushion = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.03, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x0f3b25, roughness: 0.82, metalness: 0.05 })
    );
    cushion.position.set(0, 0.505, 0);
    this.playerChair.add(cushion);

    this.scene.add(this.playerChair);
  }

  buildPermanentVRControls() {
    const tableHeight = 0.82;

    // Authentic Brass Plaque on Player's Table Left: "🪑 Sandalyeye Otur" (Recenter to Chair)
    const plaqueGeo = new THREE.BoxGeometry(0.24, 0.015, 0.10);
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });
    const plaque = new THREE.Mesh(plaqueGeo, brassMat);
    plaque.position.set(-0.52, tableHeight + 0.008, 0.64);
    plaque.rotation.y = -Math.PI / 7;
    this.tableGroup.add(plaque);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1e293b';
    ctx.roundRect(6, 6, 244, 116, 16);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 26px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪑 Sandalyeye Otur', 128, 64);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const btnGeo = new THREE.PlaneGeometry(0.22, 0.088);
    const btnMesh = new THREE.Mesh(btnGeo, mat);
    btnMesh.position.set(0, 0.009, 0);
    btnMesh.rotation.x = -Math.PI / 2;
    plaque.add(btnMesh);

    btnMesh.userData = {
      isButton: true,
      label: 'recenter_chair',
      onClick: () => {
        soundFx.playButtonClick();
        this.recenterToChair();
      }
    };
    this.permanentInteractiveButtons = [btnMesh];
  }

  recenterToChair() {
    const targetSeatX = 0;
    const targetSeatZ = 1.05; // Exact position in front of player's chair

    if (this.isVRActive && this.camera) {
      // In Three.js WebXR, camera.position holds the headset's physical offset relative to guardian origin
      const hx = this.camera.position.x || 0;
      const hz = this.camera.position.z || 0;

      // Position cameraRig so user's head in world space sits precisely at (0, y, 1.05)
      this.cameraRig.position.x = targetSeatX - hx;
      this.cameraRig.position.z = targetSeatZ - hz;

      // Seated height comfort:
      // If user is standing physically in room (eye height > 1.45m), lower rig so they sit naturally at table (~1.22m)
      // If user is already sitting down physically, keep rig Y = 0 to preserve real floor tracking
      const hy = this.camera.position.y || 1.2;
      if (hy > 1.45) {
        this.cameraRig.position.y = 1.22 - hy;
      } else {
        this.cameraRig.position.y = 0;
      }
    } else {
      this.cameraRig.position.set(targetSeatX, 0, targetSeatZ);
    }
  }

  handleVRThumbstickNavigation() {
    for (const controller of this.controllers) {
      if (controller && controller.inputSource && controller.inputSource.gamepad) {
        const gp = controller.inputSource.gamepad;

        // Thumbstick click (index 3) -> instant snap back to chair
        if (gp.buttons && gp.buttons[3] && gp.buttons[3].pressed) {
          if (!this._lastThumbClickTime || (Date.now() - this._lastThumbClickTime > 700)) {
            this._lastThumbClickTime = Date.now();
            this.triggerHaptic(controller, 0.8, 50);
            this.recenterToChair();
            return;
          }
        }

        // Thumbstick axes navigation (axes[2]: horizontal X, axes[3]: vertical Z)
        if (gp.axes && gp.axes.length >= 4) {
          const stickX = gp.axes[2];
          const stickZ = gp.axes[3];
          const deadzone = 0.22;
          const speed = 0.012;

          if (Math.abs(stickX) > deadzone) {
            this.cameraRig.position.x += stickX * speed;
            this.cameraRig.position.x = Math.max(-0.55, Math.min(0.55, this.cameraRig.position.x));
          }
          if (Math.abs(stickZ) > deadzone) {
            this.cameraRig.position.z += stickZ * speed;
            this.cameraRig.position.z = Math.max(0.78, Math.min(1.45, this.cameraRig.position.z));
          }
        }
      }
    }
  }

  highlightTileOnRack(slotIndex) {
    const tileMeshes = this.playerIstakaGroup.children.filter(c => c.userData && c.userData.isOkeyTile);
    tileMeshes.forEach((mesh, idx) => {
      if (idx === slotIndex) {
        mesh.position.y += 0.024;
        mesh.scale.set(1.1, 1.1, 1.1);
      } else {
        mesh.scale.set(1, 1, 1);
      }
    });
  }

  setGameModeView(gameType) {
    this.activeGameType = gameType;
    const isOkeyType = gameType === 'OKEY' || gameType === 'OKEY101';

    this.playerHandGroup.visible = !isOkeyType;
    this.playerIstakaGroup.visible = isOkeyType;

    this.opponentHandGroups.forEach(g => g.visible = !isOkeyType);
    this.opponentIstakaGroups.forEach(g => g.visible = isOkeyType);
    this.resetSceneObjects();
  }

  resetSceneObjects() {
    // Clear player cards
    while (this.playerHandGroup.children.length > 0) {
      this.playerHandGroup.remove(this.playerHandGroup.children.pop());
    }

    // Clear player istaka tiles (keep rack body child 0)
    while (this.playerIstakaGroup.children.length > 1) {
      this.playerIstakaGroup.remove(this.playerIstakaGroup.children[1]);
    }

    // Clear opponent cards
    this.opponentHandGroups.forEach(g => {
      while (g.children.length > 0) g.remove(g.children.pop());
    });

    // Clear opponent istaka tiles (keep rack body child 0)
    this.opponentIstakaGroups.forEach(ig => {
      while (ig.children.length > 1) ig.remove(ig.children[1]);
    });

    // Clear center items & 101 pers
    while (this.tableCenterGroup.children.length > 0) {
      this.tableCenterGroup.remove(this.tableCenterGroup.children.pop());
    }
    if (this.openedPersGroup) {
      while (this.openedPersGroup.children.length > 0) {
        this.openedPersGroup.remove(this.openedPersGroup.children.pop());
      }
    }

    // Clear discards
    this.discardGroups.forEach(dg => {
      while (dg.children.length > 0) dg.remove(dg.children.pop());
    });

    // Clear VR action buttons
    this.clearVRButtons();
    this.animatingMeshes = [];
  }

  // --- FLOATING VR HUD ---
  buildFloatingVRHUD() {
    const hudWidth = 1024;
    const hudHeight = 512;
    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = hudWidth;
    this.hudCanvas.height = hudHeight;
    this.hudContext = this.hudCanvas.getContext('2d');

    this.hudTexture = new THREE.CanvasTexture(this.hudCanvas);
    this.hudTexture.colorSpace = THREE.SRGBColorSpace;

    const hudGeo = new THREE.PlaneGeometry(0.9, 0.45);
    const hudMat = new THREE.MeshBasicMaterial({ map: this.hudTexture, transparent: true, side: THREE.DoubleSide });

    this.floatingHudMesh = new THREE.Mesh(hudGeo, hudMat);
    this.floatingHudMesh.position.set(0, 1.45, -0.65);
    this.floatingHudMesh.rotation.x = 0.1;
    this.scene.add(this.floatingHudMesh);

    this.buildVRActionButtons();
  }

  buildVRActionButtons() {
    this.vrButtonsGroup = new THREE.Group();
    this.vrButtonsGroup.position.set(0, 0.95, -0.28);
    this.scene.add(this.vrButtonsGroup);
  }

  clearVRButtons() {
    while (this.vrButtonsGroup.children.length > 0) {
      this.vrButtonsGroup.remove(this.vrButtonsGroup.children.pop());
    }
    this.interactive3DButtons = [];
  }

  create3DButton(label, x, y, z, width, height, color, onClick) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = color;
    ctx.roundRect(4, 4, 248, 120, 18);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 64);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const geo = new THREE.PlaneGeometry(width, height);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.x = -Math.PI / 4;
    mesh.userData = { isButton: true, onClick, label };

    this.vrButtonsGroup.add(mesh);
    this.interactive3DButtons.push(mesh);
    return mesh;
  }

  showBiddingButtonsInVR(currentHighestBid, onBid) {
    this.clearVRButtons();
    const minBid = currentHighestBid === 0 ? 5 : currentHighestBid + 1;

    this.create3DButton('PAS', -0.26, 0.05, 0, 0.12, 0.06, '#dc2626', () => {
      soundFx.playButtonClick();
      this.clearVRButtons();
      onBid(0);
    });

    let xOffset = -0.12;
    for (let b = minBid; b <= Math.min(minBid + 3, 13); b++) {
      const bidVal = b;
      this.create3DButton(`${bidVal}`, xOffset, 0.05, 0, 0.08, 0.06, '#2563eb', () => {
        soundFx.playButtonClick();
        this.clearVRButtons();
        onBid(bidVal);
      });
      xOffset += 0.095;
    }
  }

  showTrumpSelectionButtonsInVR(onTrumpSelected) {
    this.clearVRButtons();
    const suits = [
      { key: 'S', label: '♠ Maça', color: '#1e293b' },
      { key: 'H', label: '♥ Kupa', color: '#b91c1c' },
      { key: 'D', label: '♦ Karo', color: '#c2410c' },
      { key: 'C', label: '♣ Sinek', color: '#15803d' }
    ];

    let x = -0.22;
    suits.forEach(s => {
      this.create3DButton(s.label, x, 0.05, 0, 0.13, 0.06, s.color, () => {
        soundFx.playButtonClick();
        this.clearVRButtons();
        onTrumpSelected(s.key);
      });
      x += 0.145;
    });
  }

  showOkey101DrawButtonsInVR(canDrawDiscard, topTileName, onDrawStack, onDrawDiscard, canOpen, openPoints, onOpenHand) {
    this.clearVRButtons();

    this.create3DButton('🎲 Ortadan Çek', -0.22, 0.05, 0, 0.18, 0.06, '#2563eb', () => {
      soundFx.playButtonClick();
      this.clearVRButtons();
      if (onDrawStack) onDrawStack();
    });

    if (canDrawDiscard) {
      this.create3DButton(`📥 Yandan Al`, 0.02, 0.05, 0, 0.18, 0.06, '#15803d', () => {
        soundFx.playButtonClick();
        this.clearVRButtons();
        if (onDrawDiscard) onDrawDiscard();
      });
    }

    if (canOpen) {
      this.create3DButton(`🌟 El Aç (${openPoints})`, 0.24, 0.05, 0, 0.18, 0.06, '#d97706', () => {
        soundFx.playButtonClick();
        this.clearVRButtons();
        if (onOpenHand) onOpenHand();
      });
    }
  }

  showOkeyDrawButtonsInVR(canDrawDiscard, onDrawStack, onDrawDiscard, canOpenHand = false, onOpenHand = null) {
    this.clearVRButtons();
    this.create3DButton('ORTADAN ÇEK', -0.18, 0.05, 0, 0.2, 0.06, '#2563eb', () => {
      soundFx.playButtonClick();
      this.clearVRButtons();
      onDrawStack();
    });

    if (canDrawDiscard) {
      this.create3DButton('YANDAN AL', 0.08, 0.05, 0, 0.18, 0.06, '#16a34a', () => {
        soundFx.playButtonClick();
        this.clearVRButtons();
        onDrawDiscard();
      });
    }

    if (canOpenHand && onOpenHand) {
      this.create3DButton('ELİ AÇ (101)', 0.3, 0.05, 0, 0.18, 0.06, '#d97706', () => {
        soundFx.playButtonClick();
        this.clearVRButtons();
        onOpenHand();
      });
    }
  }

  updateHUD(state) {
    if (!this.hudContext) return;
    const ctx = this.hudContext;
    const w = this.hudCanvas.width;
    const h = this.hudCanvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.roundRect(10, 10, w - 20, h - 20, 24);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#d4af37';
    ctx.stroke();

    // Title
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 36px "Cinzel", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.title || 'KIRAATHANE VR', 40, 65);

    // Trump / Okey Badge
    if (state.trump && SUITS[state.trump]) {
      const suit = SUITS[state.trump];
      ctx.fillStyle = '#334155';
      ctx.roundRect(w - 220, 25, 180, 55, 14);
      ctx.fill();
      ctx.fillStyle = suit.isRed ? '#ef4444' : '#60a5fa';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(`KOZ: ${suit.symbol} ${suit.name}`, w - 205, 62);
    } else if (state.okeyTile) {
      ctx.fillStyle = '#334155';
      ctx.roundRect(w - 250, 25, 215, 55, 14);
      ctx.fill();
      ctx.fillStyle = state.okeyTile.colorHex || '#fef08a';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`OKEY: ${state.okeyTile.colorName} ${state.okeyTile.number}`, w - 235, 62);
    }

    // Status Banner
    ctx.fillStyle = 'rgba(30, 41, 59, 0.88)';
    ctx.roundRect(40, 95, w - 80, 50, 12);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.status || 'Oyun Sürüyor', w / 2, 128);

    // Scores
    if (state.scores && state.scores.length > 0) {
      const colW = (w - 80) / state.scores.length;
      state.scores.forEach((p, i) => {
        const startX = 40 + i * colW;
        const isActive = i === state.currentTurn;

        ctx.fillStyle = isActive ? 'rgba(59, 130, 246, 0.35)' : 'rgba(30, 41, 59, 0.4)';
        ctx.roundRect(startX + 6, 165, colW - 12, 180, 16);
        ctx.fill();

        if (isActive) {
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.fillStyle = isActive ? '#93c5fd' : '#f1f5f9';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, startX + colW / 2, 205);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '20px sans-serif';
        if (p.bid !== undefined) ctx.fillText(`İhale: ${p.bid}`, startX + colW / 2, 245);
        if (p.tricks !== undefined) ctx.fillText(`Alınan: ${p.tricks}`, startX + colW / 2, 280);
        if (p.opened !== undefined) ctx.fillText(`Açtı: ${p.opened ? 'Evet' : 'Hayır'}`, startX + colW / 2, 245);

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(`${p.score} Puan`, startX + colW / 2, 325);
      });
    }

    // AI Advisor Card in 3D VR HUD
    if (state.aiAdvice) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.roundRect(40, 360, w - 80, 120, 16);
      ctx.fill();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🤖 AI ASİSTAN ÖNERİSİ:', 60, 395);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '20px sans-serif';
      const cleanAdvice = state.aiAdvice.replace(/\*\*/g, '').replace(/[\n\r]+/g, ' ');
      const displayAdvice = cleanAdvice.length > 70 ? cleanAdvice.substring(0, 68) + '...' : cleanAdvice;
      ctx.fillText(displayAdvice, 320, 395);

      if (state.aiDetail) {
        ctx.fillStyle = '#fde047';
        ctx.font = '19px sans-serif';
        const cleanDetail = state.aiDetail.replace(/\*\*/g, '').replace(/[\n\r]+/g, ' ');
        const displayDetail = cleanDetail.length > 85 ? cleanDetail.substring(0, 83) + '...' : cleanDetail;
        ctx.fillText(displayDetail, 60, 440);
      }
    }

    this.hudTexture.needsUpdate = true;
  }

  // --- CONTROLLER RAYCASTING ---
  setupControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      this.cameraRig.add(controller); // Attach to cameraRig so hands stay anchored to player's chair
      this.controllers.push(controller);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1.8)]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.6 });
      const laserLine = new THREE.Line(lineGeo, lineMat);
      controller.add(laserLine);

      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.cameraRig.add(grip); // Attach to cameraRig
      this.controllerGrips.push(grip);

      controller.addEventListener('selectstart', () => {
        this.onVRSelectStart(controller);
      });
    }

    // Direct WebXR Hand Tracking (Meta Quest / Hand Tracking)
    this.hands = [];
    try {
      const handModelFactory = new XRHandModelFactory();
      for (let i = 0; i < 2; i++) {
        const hand = this.renderer.xr.getHand(i);
        hand.add(handModelFactory.createHandModel(hand, 'mesh'));
        this.cameraRig.add(hand); // Attach to cameraRig
        this.hands.push(hand);

        hand.addEventListener('pinchstart', () => {
          this.onHandPinch(hand, i);
        });
      }
    } catch (err) {
      console.warn('WebXR Hand Tracking factory fallback:', err);
    }
  }

  onHandPinch(hand, handIndex) {
    // Treat pinch gesture as a natural tap/grab on cards or tiles
    this.onVRSelectStart(hand);
  }

  triggerHaptic(controller, intensity = 0.6, duration = 40) {
    try {
      if (controller && controller.inputSource && controller.inputSource.gamepad) {
        const actuators = controller.inputSource.gamepad.hapticActuators;
        if (actuators && actuators.length > 0) {
          actuators[0].pulse(intensity, duration);
        }
      }
    } catch (e) {
      // Haptics not supported or permitted on this device
    }
  }

  onVRSelectStart(controller) {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    // 1. Buttons (Dynamic VR action buttons + Permanent table controls)
    const allButtons = [...this.interactive3DButtons, ...(this.permanentInteractiveButtons || [])];
    if (allButtons.length > 0) {
      const btnIntersects = this.raycaster.intersectObjects(allButtons, false);
      if (btnIntersects.length > 0) {
        this.triggerHaptic(controller, 0.4, 25);
        btnIntersects[0].object.userData.onClick();
        return;
      }
    }

    const isOkeyType = this.activeGameType === 'OKEY' || this.activeGameType === 'OKEY101';

    if (!isOkeyType) {
      const cardMeshes = this.playerHandGroup.children.filter(c => c.userData && c.userData.isCard);
      const intersects = this.raycaster.intersectObjects(cardMeshes, true);
      if (intersects.length > 0) {
        let hitCard = intersects[0].object;
        while (hitCard.parent && hitCard.parent !== this.playerHandGroup) hitCard = hitCard.parent;
        if (hitCard.userData && hitCard.userData.card && this.onCardSelectedCallback) {
          this.triggerHaptic(controller, 0.7, 45);
          this.onCardSelectedCallback(hitCard.userData.card);
        }
      }
    } else {
      const tileMeshes = this.playerIstakaGroup.children.filter(t => t.userData && t.userData.isOkeyTile);
      const intersects = this.raycaster.intersectObjects(tileMeshes, true);
      if (intersects.length > 0) {
        let hitTile = intersects[0].object;
        while (hitTile.parent && hitTile.parent !== this.playerIstakaGroup) hitTile = hitTile.parent;
        if (hitTile.userData && hitTile.userData.tile && this.onTileSelectedCallback) {
          this.triggerHaptic(controller, 0.8, 50); // Ceramic tile tactile thud
          this.onTileSelectedCallback(hitTile.userData.tile);
        }
      }

      const centerStackHits = this.raycaster.intersectObjects(this.tableCenterGroup.children, true);
      if (centerStackHits.length > 0 && this.onCenterStackClickCallback) {
        this.triggerHaptic(controller, 0.5, 30);
        this.onCenterStackClickCallback();
      }
    }
  }

  setupDesktopInteractions() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('click', () => {
      if (this.isVRActive) return;
      this.desktopRaycaster.setFromCamera(this.mouse, this.camera);

      const allButtons = [...this.interactive3DButtons, ...(this.permanentInteractiveButtons || [])];
      if (allButtons.length > 0) {
        const btnIntersects = this.desktopRaycaster.intersectObjects(allButtons, false);
        if (btnIntersects.length > 0) {
          btnIntersects[0].object.userData.onClick();
          return;
        }
      }

      const isOkeyType = this.activeGameType === 'OKEY' || this.activeGameType === 'OKEY101';
      if (!isOkeyType) {
        const cardMeshes = this.playerHandGroup.children.filter(c => c.userData && c.userData.isCard);
        const intersects = this.desktopRaycaster.intersectObjects(cardMeshes, false);
        if (intersects.length > 0 && this.onCardSelectedCallback) {
          this.onCardSelectedCallback(intersects[0].object.userData.card);
        }
      } else {
        const tileMeshes = this.playerIstakaGroup.children.filter(t => t.userData && t.userData.isOkeyTile);
        const intersects = this.desktopRaycaster.intersectObjects(tileMeshes, false);
        if (intersects.length > 0 && this.onTileSelectedCallback) {
          this.onTileSelectedCallback(intersects[0].object.userData.tile);
        }

        const centerStackHits = this.desktopRaycaster.intersectObjects(this.tableCenterGroup.children, true);
        if (centerStackHits.length > 0 && this.onCenterStackClickCallback) {
          this.onCenterStackClickCallback();
        }
      }
    });
  }

  // --- CARDS RENDERING ---
  renderPlayerHand(handCards, playableCardIds = null, recommendedCardId = null) {
    while (this.playerHandGroup.children.length > 0) this.playerHandGroup.remove(this.playerHandGroup.children.pop());
    const total = handCards.length;
    if (total === 0) return;

    // Beautiful natural card fanning
    const arcAngle = Math.min(Math.PI * 0.40, total * 0.052);
    const startAngle = -arcAngle / 2;
    const stepAngle = total > 1 ? arcAngle / (total - 1) : 0;
    const radius = 0.46;

    handCards.forEach((card, idx) => {
      const isRecommended = Boolean(recommendedCardId && card.id === recommendedCardId);
      const mesh = createCard3DMesh(card, isRecommended);
      const angle = startAngle + idx * stepAngle;

      let yOffset = idx * 0.0008;
      let zOffset = -(Math.cos(angle) * radius - radius) * 0.5;
      if (isRecommended) {
        yOffset += 0.024;
        zOffset -= 0.015;
      }

      mesh.position.set(Math.sin(angle) * radius, yOffset, zOffset);
      mesh.rotation.z = -angle * 0.65;
      mesh.rotation.y = angle * 0.22;
      mesh.rotation.x = -0.18; // natural tilt towards player eye-level

      if (playableCardIds && !playableCardIds.includes(card.id)) {
        mesh.traverse(child => { if (child.material) child.material.color = new THREE.Color(0x666666); });
      }
      this.playerHandGroup.add(mesh);
    });
  }

  renderOpponentHands(players) {
    for (let seat = 1; seat < 4; seat++) {
      const oppGroup = this.opponentHandGroups[seat - 1];
      while (oppGroup.children.length > 0) oppGroup.remove(oppGroup.children.pop());

      const p = players[seat];
      if (!p || !p.hand) continue;

      const count = p.hand.length;
      const spacing = 0.022;
      const startX = -((count - 1) * spacing) / 2;

      for (let i = 0; i < count; i++) {
        const dummyCard = { rank: 'A', suit: 'S', isRed: false };
        const mesh = createCard3DMesh(dummyCard);
        mesh.position.set(startX + i * spacing, i * 0.0006, 0);
        mesh.rotation.x = Math.PI / 2;
        oppGroup.add(mesh);
      }
    }
  }

  renderTableCards(tableCards) {
    while (this.tableCenterGroup.children.length > 0) this.tableCenterGroup.remove(this.tableCenterGroup.children.pop());

    tableCards.forEach((tc, idx) => {
      const card = tc.card || tc;
      const isFaceUp = tc.faceUp !== undefined ? tc.faceUp : true;
      const mesh = createCard3DMesh(card);

      // Sits flat on the green felt table
      mesh.position.set((Math.sin(idx * 2.3) * 0.035), idx * 0.0012, (Math.cos(idx * 3.1) * 0.035));
      mesh.rotation.x = isFaceUp ? -Math.PI / 2 : Math.PI / 2;
      mesh.rotation.z = (idx * 0.24) - 0.35;
      this.tableCenterGroup.add(mesh);
    });
  }

  animateCardPlay(card, fromSeat, targetTablePos, onComplete) {
    soundFx.playCardDeal();
    const flyingMesh = createCard3DMesh(card);
    let startPos = new THREE.Vector3();

    if (fromSeat === 0) {
      startPos.set(0, 0.95, 0.4);
    } else {
      this.opponentHandGroups[fromSeat - 1].getWorldPosition(startPos);
      startPos.y += 0.1;
    }

    flyingMesh.position.copy(startPos);
    this.scene.add(flyingMesh);

    const targetPos = targetTablePos || new THREE.Vector3((Math.random() - 0.5) * 0.08, 0.835 + Math.random() * 0.005, (Math.random() - 0.5) * 0.08);
    const duration = 450;
    const startTime = performance.now();

    const animObj = {
      update: (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 3);

        flyingMesh.position.lerpVectors(startPos, targetPos, ease);
        flyingMesh.position.y += Math.sin(progress * Math.PI) * 0.15;
        flyingMesh.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 2, ease);

        if (progress >= 1.0) {
          const pan = (fromSeat === 1 ? 0.6 : (fromSeat === 3 ? -0.6 : 0));
          soundFx.playCardSnap(0.95, pan);
          this.scene.remove(flyingMesh);
          if (onComplete) onComplete();
          return true;
        }
        return false;
      }
    };
    this.animatingMeshes.push(animObj);
  }

  animateTrickCollection(winnerSeat, onComplete) {
    soundFx.playCollectTrick();
    const centerCards = [...this.tableCenterGroup.children];
    if (centerCards.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    let targetPos = new THREE.Vector3();
    if (winnerSeat === 0) {
      targetPos.set(0.35, 0.83, 0.45);
    } else {
      this.opponentHandGroups[winnerSeat - 1].getWorldPosition(targetPos);
    }

    const duration = 400;
    const startTime = performance.now();

    const animObj = {
      update: (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        const ease = progress * progress;

        centerCards.forEach(c => {
          c.position.lerp(targetPos, ease * 0.25);
          c.scale.multiplyScalar(0.96);
        });

        if (progress >= 1.0) {
          while (this.tableCenterGroup.children.length > 0) this.tableCenterGroup.remove(this.tableCenterGroup.children.pop());
          if (onComplete) onComplete();
          return true;
        }
        return false;
      }
    };
    this.animatingMeshes.push(animObj);
  }

  // --- OKEY TILES & 101 PERS RENDERING ---
  renderPlayerIstaka(handTiles, recommendedIndex = -1) {
    while (this.playerIstakaGroup.children.length > 1) {
      this.playerIstakaGroup.remove(this.playerIstakaGroup.children[1]);
    }

    const slotSpacing = 0.042;
    const maxPerTier = 11;

    handTiles.forEach((tile, idx) => {
      const isSelected = this.selectedTileIndex === idx;
      const isRecommended = recommendedIndex === idx;
      const mesh = createOkeyTile3DMesh(tile, isSelected, isRecommended);
      const tier = idx < maxPerTier ? 0 : 1; // 0 = upper shelf, 1 = lower shelf
      const col = idx % maxPerTier;

      const x = (col - (maxPerTier - 1) / 2) * slotSpacing;
      let y = tier === 0 ? 0.076 : 0.040;
      let z = tier === 0 ? -0.012 : 0.030;

      if (isSelected || isRecommended) {
        y += 0.012;
        z += 0.008;
      }

      mesh.position.set(x, y, z);
      // Resting tilt against rack
      mesh.rotation.x = Math.PI / 18;
      this.playerIstakaGroup.add(mesh);
    });
  }

  renderOpponentIstakas(players) {
    for (let seat = 1; seat < 4; seat++) {
      const oppIstaka = this.opponentIstakaGroups[seat - 1];
      while (oppIstaka.children.length > 1) oppIstaka.remove(oppIstaka.children[1]);

      const p = players[seat];
      if (!p || !p.hand) continue;

      const count = p.hand.length;
      const slotSpacing = 0.042;
      const maxPerTier = 11;

      for (let i = 0; i < count; i++) {
        const dummyTile = { colorKey: 'RED', number: 1, isFakeOkey: false };
        const mesh = createOkeyTile3DMesh(dummyTile);
        const tier = i < maxPerTier ? 0 : 1;
        const col = i % maxPerTier;

        mesh.position.set((col - (maxPerTier - 1) / 2) * slotSpacing, tier === 0 ? 0.076 : 0.040, tier === 0 ? -0.012 : 0.030);
        mesh.rotation.x = Math.PI;
        oppIstaka.add(mesh);
      }
    }
  }

  renderCenterOkeyStack(drawStackCount, gostergeTile) {
    while (this.tableCenterGroup.children.length > 0) {
      this.tableCenterGroup.remove(this.tableCenterGroup.children.pop());
    }

    const stackTowers = Math.min(8, Math.ceil(drawStackCount / 5));
    for (let s = 0; s < stackTowers; s++) {
      const angle = (s / stackTowers) * Math.PI * 2;
      const dummyTile = { colorKey: 'RED', number: 1, isFakeOkey: false };
      const mesh = createOkeyTile3DMesh(dummyTile);
      mesh.position.set(Math.cos(angle) * 0.08, 0.015, Math.sin(angle) * 0.08);
      mesh.rotation.x = Math.PI / 2;
      this.tableCenterGroup.add(mesh);
    }

    if (gostergeTile) {
      const gMesh = createOkeyTile3DMesh(gostergeTile);
      gMesh.position.set(0, 0.035, 0);
      gMesh.rotation.x = -Math.PI / 2;
      this.tableCenterGroup.add(gMesh);
    }
  }

  renderOkeyDiscards(discardPiles) {
    discardPiles.forEach((pile, seat) => {
      const dg = this.discardGroups[seat];
      while (dg.children.length > 0) dg.remove(dg.children.pop());
      if (pile.length === 0) return;

      const topTiles = pile.slice(-3);
      topTiles.forEach((tile, i) => {
        const mesh = createOkeyTile3DMesh(tile);
        mesh.position.set(i * 0.012, i * 0.006, i * 0.005);
        mesh.rotation.x = -Math.PI / 2;
        dg.add(mesh);
      });
    });
  }

  // 101 Okey Opened Pers Display on Table Center
  render101OpenedPers(openedPersList) {
    while (this.openedPersGroup.children.length > 0) {
      this.openedPersGroup.remove(this.openedPersGroup.children.pop());
    }

    openedPersList.forEach((perObj, perIdx) => {
      const perRow = new THREE.Group();
      const rowY = perIdx * 0.04 - 0.12;
      perRow.position.set(0, 0.005, rowY);

      perObj.tiles.forEach((tile, tileIdx) => {
        const mesh = createOkeyTile3DMesh(tile);
        mesh.position.set((tileIdx - (perObj.tiles.length - 1) / 2) * 0.035, 0, 0);
        mesh.rotation.x = -Math.PI / 2;
        perRow.add(mesh);
      });

      this.openedPersGroup.add(perRow);
    });
  }

  animateTileDiscard(tile, playerSeat, onComplete) {
    const seatPan = (playerSeat === 1 ? 0.65 : (playerSeat === 3 ? -0.65 : 0));
    soundFx.playCardDeal(3, seatPan);

    const targetGroup = this.discardGroups[playerSeat];
    const targetPos = new THREE.Vector3();
    targetGroup.getWorldPosition(targetPos);

    const flyingTile = createOkeyTile3DMesh(tile);
    let startPos = new THREE.Vector3();

    if (playerSeat === 0) {
      startPos.set(0, 0.9, 0.45);
    } else {
      this.opponentIstakaGroups[playerSeat - 1].getWorldPosition(startPos);
    }

    flyingTile.position.copy(startPos);
    this.scene.add(flyingTile);

    const duration = 350;
    const startTime = performance.now();

    const animObj = {
      update: (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 3);

        flyingTile.position.lerpVectors(startPos, targetPos, ease);
        flyingTile.position.y += Math.sin(progress * Math.PI) * 0.12;
        flyingTile.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 2, ease);

        if (progress >= 1.0) {
          soundFx.playOkeyTileSlap(1.25, seatPan);
          this.scene.remove(flyingTile);
          if (onComplete) onComplete();
          return true;
        }
        return false;
      }
    };
    this.animatingMeshes.push(animObj);
  }

  onWindowResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  render(time) {
    // 0. VR Seated Auto-Calibration and Controls
    if (this.isVRActive) {
      if (!this.hasCalibratedVRSeat && this.camera) {
        // Once WebXR starts reporting active tracking data, align user directly to chair
        if (this.camera.position.y > 0.4 || Math.abs(this.camera.position.x) > 0.001 || Math.abs(this.camera.position.z) > 0.001) {
          this.recenterToChair();
          this.hasCalibratedVRSeat = true;
        }
      }
      this.handleVRThumbstickNavigation();
    }

    // 1. Run card / tile animations
    for (let i = this.animatingMeshes.length - 1; i >= 0; i--) {
      const finished = this.animatingMeshes[i].update(time);
      if (finished) this.animatingMeshes.splice(i, 1);
    }

    // 2. Animate Kıraathane Human Characters (Organic breathing, realistic head tilts & table glances)
    const t = (time || 0) * 0.001;
    [...this.opponentAvatars, ...this.backgroundAvatars].forEach((char) => {
      if (char.userData && char.userData.head) {
        const offset = char.userData.animOffset || 0;
        
        // Organic respiratory chest cycle (subtle vertical rise & fall)
        const breath = Math.sin(t * 1.6 + offset);
        char.position.y = breath * 0.005;
        
        // Thoughtful human head movements (looking at cards, scanning table, subtle tilts)
        const headPan = Math.sin(t * 0.55 + offset) * 0.16 + Math.sin(t * 1.3 + offset * 2) * 0.05;
        const headPitch = Math.sin(t * 0.8 + offset) * 0.04 + 0.08; // Natural slight downward gaze toward hand/table
        const headRoll = Math.sin(t * 0.4 + offset) * 0.035; // Slight thoughtful ear-to-shoulder tilt
        
        char.userData.head.rotation.y = headPan;
        char.userData.head.rotation.x = headPitch;
        char.userData.head.rotation.z = headRoll;
      }
    });

    // 3. Animate rising tea steam
    if (this.steamPoints) {
      const pos = this.steamPoints.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] += 0.0006;
        if (pos[i] > 0.16) {
          pos[i] = 0.07;
        }
      }
      this.steamPoints.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
