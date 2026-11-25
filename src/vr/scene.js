import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/examples/jsm/webxr/XRHandModelFactory.js';
import { createCard3DMesh, SUITS } from '../engine/cards.js';
import {
  createOkeyTile3DMesh,
  createIstaka3DMesh,
  OKEY_COLORS,
  arrangeHandTilesOnIstaka,
  assignRawIstakaSlots,
  createPhotoDemoHand,
  okeyTexGen,
  ISTAKA_SLOTS_PER_TIER,
  ISTAKA_SLOT_SPACING,
  ISTAKA_TIER_COORDS,
} from '../engine/okey/tiles.js';
import {
  avatarBuilder,
  createAuthenticTeaGlass,
  createTurkishCoffeeCup,
  createOttomanNargile,
  createCayciAvatar,
} from './avatars.js';
import { soundFx } from '../engine/audio.js';
import { spatialVoice } from '../engine/voiceChat.js';

// --- ÇAYCI HÜSEYİN FİZİK VE MASA ENGELİ NAVİGASYONU ---
export const CAYCI_OBSTACLES = [
  { id: 'main_table', x: 0, z: 0, r: 1.78 },
  { id: 'side_table_1', x: 3.6, z: -3.2, r: 1.55 },
  { id: 'side_table_2', x: -3.6, z: -3.2, r: 1.55 },
  { id: 'side_table_3', x: 3.8, z: 1.8, r: 1.55 },
  { id: 'tea_counter', x: -4.8, z: -4.5, r: 1.28 },
];

export const CAYCI_NAV_NODES = [
  { x: -3.1, z: -5.0, lookAt: [-4.8, -4.5], stopHere: true },   // 0: Çay ocağı önü
  { x: -1.85, z: -1.95, lookAt: [0, 0], stopHere: true },      // 1: Kuzeybatı masa yanı
  { x: 0.0, z: -2.25, lookAt: [0, 0], stopHere: false },       // 2: Kuzey koridor
  { x: 1.85, z: -1.95, lookAt: [0, 0], stopHere: true },       // 3: Kuzeydoğu masa yanı
  { x: 2.25, z: 0.0, lookAt: [0, 0], stopHere: false },        // 4: Doğu koridor
  { x: 1.55, z: 1.45, lookAt: [0, 0.35], stopHere: true },     // 5: Oyuncu yanı çay servisi
  { x: 0.0, z: 2.25, lookAt: [0, 0], stopHere: false },        // 6: Güney koridor (sandalye arkası)
  { x: -1.65, z: 1.45, lookAt: [0, 0], stopHere: true },     // 7: Güneybatı masa yanı
  { x: -2.25, z: 0.0, lookAt: [0, 0], stopHere: false },       // 8: Batı koridor
  { x: 1.95, z: -3.25, lookAt: [3.6, -3.2], stopHere: true },  // 9: Sağ arka tavla masası yanı
  { x: -1.75, z: -3.65, lookAt: [-3.6, -3.2], stopHere: true }, // 10: Sol arka masa yanı
];

export const CAYCI_NAV_EDGES = {
  0: [10],
  10: [0, 1],
  1: [10, 2, 8],
  2: [1, 3],
  3: [2, 4, 9],
  9: [3],
  4: [3, 5],
  5: [4, 6],
  6: [5, 7],
  7: [6, 8],
  8: [7, 1],
};

function _segmentIntersectsCircle(x1, z1, x2, z2, cx, cz, r) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-8) return Math.hypot(x1 - cx, z1 - cz) < r;
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cz - z1) * dz) / lenSq));
  const px = x1 + t * dx;
  const pz = z1 + t * dz;
  return Math.hypot(px - cx, pz - cz) < r;
}

export function findCayciPath(startIdx, goalIdx) {
  if (startIdx === goalIdx) return [];
  const queue = [[startIdx]];
  const visited = new Set([startIdx]);
  while (queue.length > 0) {
    const path = queue.shift();
    const cur = path[path.length - 1];
    const neighbors = CAYCI_NAV_EDGES[cur] || [];
    for (const next of neighbors) {
      if (visited.has(next)) continue;
      const nextPath = [...path, next];
      if (next === goalIdx) return nextPath.slice(1);
      visited.add(next);
      queue.push(nextPath);
    }
  }
  return [goalIdx];
}

export function findNearestCayciNode(x, z, obstacles = CAYCI_OBSTACLES) {
  let bestClearIdx = -1;
  let bestClearDist = Infinity;
  let bestAnyIdx = 0;
  let bestAnyDist = Infinity;

  for (let i = 0; i < CAYCI_NAV_NODES.length; i++) {
    const n = CAYCI_NAV_NODES[i];
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestAnyDist) {
      bestAnyDist = d;
      bestAnyIdx = i;
    }
    const blocked = obstacles.some((o) => _segmentIntersectsCircle(x, z, n.x, n.z, o.x, o.z, o.r));
    if (!blocked && d < bestClearDist) {
      bestClearDist = d;
      bestClearIdx = i;
    }
  }
  return bestClearIdx !== -1 ? bestClearIdx : bestAnyIdx;
}

export function resolveCayciCollisions(pos, obstacles = CAYCI_OBSTACLES) {
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const dx = pos.x - obs.x;
      const dz = pos.z - obs.z;
      const dist = Math.hypot(dx, dz);
      if (dist < obs.r) {
        if (dist > 1e-4) {
          const push = obs.r + 0.02;
          pos.x = obs.x + (dx / dist) * push;
          pos.z = obs.z + (dz / dist) * push;
        } else {
          pos.x = obs.x + obs.r + 0.02;
        }
      }
    }
    pos.x = Math.max(-6.8, Math.min(6.8, pos.x));
    pos.z = Math.max(-6.4, Math.min(4.8, pos.z));
  }
  return pos;
}

export const KIRAATHANE_THEMES = [
  {
    id: 'balat',
    name: 'Tarihi Balat Kıraathanesi',
    location: 'Fener & Balat / Haliç',
    badge: 'Tarihi Doku',
    image: './assets/env_balat.jpg',
    desc: 'Gün ışığı alan ferah kemerli pencereler, tarihi Balat dokusu ve sıcak kehribar atmosfer.',
    fogColor: 0xdad4c8,
    lightColor: 0xfff8ee,
    spotColor: 0xfffaf0,
    ambientIntensity: 0.92,
    hemiIntensity: 1.05
  },
  {
    id: 'bosphorus',
    name: 'Çengelköy Çınaraltı Boğaz Kahvesi',
    location: 'Çengelköy Sahili / Boğaziçi',
    badge: 'Boğaz Manzarası',
    image: './assets/env_bosphorus.jpg',
    desc: 'Pırıl pırıl gün ışığında Boğaz esintisi ve ferah panoramik deniz manzarası.',
    fogColor: 0xd4e5f2,
    lightColor: 0xf4faff,
    spotColor: 0xffffff,
    ambientIntensity: 1.05,
    hemiIntensity: 1.20
  },
  {
    id: 'kapalicarsi',
    name: 'Tarihi Kapalıçarşı & Beyazıt',
    location: 'Kapalıçarşı / Beyazıt',
    badge: 'Osmanlı Çinili',
    image: './assets/env_kapalicarsi.jpg',
    desc: 'Aydınlık Osmanlı taş kemerleri, İznik çinileri ve ferah avlu ışığı.',
    fogColor: 0xe2d7c4,
    lightColor: 0xfff7e6,
    spotColor: 0xfff5db,
    ambientIntensity: 0.94,
    hemiIntensity: 1.05
  },
  {
    id: 'classic',
    name: 'Nostaljik 1923 İstanbul Kıraathanesi',
    location: 'Süleymaniye / Eminönü',
    badge: 'Nostaljik',
    image: './assets/env_classic.jpg',
    desc: 'Bal meşesi ahşap lambri, aydınlık pencereler ve pirinç çay semaveri.',
    fogColor: 0xddd8ce,
    lightColor: 0xfff9f0,
    spotColor: 0xfffaf2,
    ambientIntensity: 0.92,
    hemiIntensity: 1.05
  }
];

export function computeResponsiveCameraConfig(width, height, gameType = 'BATAK', mobileDockActive = false) {
  const w = Math.max(1, Number(width) || 1280);
  const h = Math.max(1, Number(height) || 720);
  const aspect = w / h;
  const isOkey = gameType === 'OKEY' || gameType === 'OKEY101';

  if (aspect < 1.15) {
    // Portrait phone / narrow screen
    const targetHFovRad = THREE.MathUtils.degToRad(aspect < 0.65 ? 76 : 84);
    const rawVFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(targetHFovRad / 2) / Math.max(0.42, aspect)));
    const fov = Math.max(72, Math.min(96, rawVFov));
    const narrowFactor = Math.min(1, (1.15 - aspect) / 0.70);
    if (mobileDockActive) {
      // Aim at center table & opponents cleanly above bottom 2D mobile hand dock
      const z = (isOkey ? 1.14 : 1.10) + narrowFactor * 0.40;
      const y = (isOkey ? 1.42 : 1.38) + narrowFactor * 0.30;
      return { fov, pos: [0, y, z], lookAt: [0, 0.72, 0.22], isPortrait: true };
    }
    const z = (isOkey ? 1.06 : 1.04) + narrowFactor * 0.44;
    const y = (isOkey ? 1.36 : 1.32) + narrowFactor * 0.34;
    return { fov, pos: [0, y, z], lookAt: [0, 0.83, isOkey ? 0.16 : 0.14], isPortrait: true };
  }

  if (h <= 540) {
    // Landscape mobile phone
    if (mobileDockActive) {
      return { fov: 66, pos: [0, 1.38, 1.12], lookAt: [0, 0.74, 0.18], isPortrait: false };
    }
    return { fov: 66, pos: [0, 1.35, 1.10], lookAt: [0, 0.85, 0.06], isPortrait: false };
  }

  // Standard Desktop / Tablet
  return { fov: 70, pos: [0, 1.32, 1.04], lookAt: [0, 0.85, 0.02], isPortrait: false };
}

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
    this.hemiLight = null;
    this.sunLight = null;
    this.tableSpot = null;
    this.backWallMuralMesh = null;
    this.currentThemeId = localStorage.getItem('korkmaz_kiraathane_theme') || 'balat';
    this.themeChangeCallbacks = [];

    // VR specific
    this.controllers = [];
    this.controllerGrips = [];
    this.controllerReticles = [];
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();
    this.vrSeatZ = 0.88;

    // Reusable objects for zero-GC render/drag loop
    this._dragPlane = new THREE.Plane();
    this._dragIntersect = new THREE.Vector3();
    this._dragLocalPos = new THREE.Vector3();
    this._tempVec3 = new THREE.Vector3();
    this._tempBtnList = [];
    this._lastHoveredObj = null;

    // Drag & drop state (Desktop + VR controller trigger hold)
    this.dragState = {
      active: false,
      dragging: false,
      kind: null, // 'tile' | 'card'
      source: null, // 'desktop' | 'vr'
      isTouch: false,
      controller: null,
      mesh: null,
      data: null,
      startClientX: 0,
      startClientY: 0,
      startWorldPos: new THREE.Vector3(),
      targetTier: -1,
      targetSlot: -1,
      overDiscard: false,
      targetCardIndex: -1,
      overPlayZone: false,
    };
    this.istakaSlotHits = [];
    this.slotHighlightMesh = null;
    this.selfDiscardDropRing = null;
    this.centerStackHitMesh = null;
    this.leftDiscardHitMesh = null;
    this.nameBadgeCache = new Map();

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
    this.selectedTileIndex = -1;
    this.tablePlayers = [];
    this.mobileHandDockActive = false;
    this.featurePermissions = { canAutoSort: false, canUseAI: false };
    this.okeyQuickSortGroup = null;
    this.cardQuickSortGroup = null;
    this.onSortAiCallback = null;
    this.onSortRunsCallback = null;
    this.onSortPairsCallback = null;
    this.onSortCardsCallback = null;
    this.onDrawDiscardCallback = null;
    this.onAiAdviceClickCallback = null;
    this.onCardSelectedCallback = null;
    this.onCardReorderCallback = null;
    this.onTileSelectedCallback = null;
    this.onTileDropToSlotCallback = null;
    this.onTileDropToDiscardCallback = null;
    this.onCenterStackClickCallback = null;
    this.onOpenHandClickCallback = null;
    this.onVRMicToggleCallback = null;
    this.onVRSpeakerToggleCallback = null;
    this.onCayciServeCallback = null;

    // Gezen Çaycı (Çaycı Hüseyin) durumu
    this.cayciAvatar = null;
    this.cayciState = null;

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
    this.scene.background = new THREE.Color(0xdad4c8);
    this.scene.fog = new THREE.FogExp2(0xdad4c8, 0.018);

    // Camera Rig (Dolly): Anchors player's physical headset & controllers to the chair
    this.cameraRig = new THREE.Group();
    this.cameraRig.name = 'CameraRig';
    this.cameraRig.position.set(0, 0, 0); // Origin for Desktop mode
    this.scene.add(this.cameraRig);

    this.camera = new THREE.PerspectiveCamera(70, this.width / Math.max(1, this.height), 0.05, 50);
    this.cameraRig.add(this.camera);
    this.applyResponsiveCamera();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.20;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.xr.enabled = true;
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    // Lightweight procedural studio/kıraathane environment reflection map
    this.buildEnvironmentReflection();

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

    // Hide WebXR VR pill on mobile/desktop browsers without an immersive-vr headset so cards stay unobstructed
    if (typeof navigator === 'undefined' || !navigator.xr || !navigator.xr.isSessionSupported) {
      vrBtn.style.display = 'none';
    } else {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        if (!supported) vrBtn.style.display = 'none';
      }).catch(() => {
        vrBtn.style.display = 'none';
      });
    }

    this.renderer.xr.addEventListener('sessionstart', () => {
      this.isVRActive = true;
      this.mobileHandDockActive = false;
      const isOkeyType = this.activeGameType === 'OKEY' || this.activeGameType === 'OKEY101';
      if (this.playerHandGroup) this.playerHandGroup.visible = !isOkeyType;
      if (this.playerIstakaGroup) this.playerIstakaGroup.visible = isOkeyType;
      this.setFeaturePermissions(this.featurePermissions);
      spatialVoice.setVRActive(true);
      this.hasCalibratedVRSeat = false;
      soundFx.unlockAudio();
      spatialVoice.ensureAudioContext();

      // Zero out local desktop camera offset so it doesn't contaminate WebXR tracking space
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);

      // Place camera rig comfortably close at the player's table edge
      this.cameraRig.position.set(0, 0, this.vrSeatZ);

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
      spatialVoice.setVRActive(false);
      this.hasCalibratedVRSeat = false;
      this.cameraRig.position.set(0, 0, 0);
      this.applyResponsiveCamera();
      this.hideVRGameOverDialog();
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
    window.addEventListener('orientationchange', () => setTimeout(() => this.onWindowResize(), 180));
    this.setupDesktopInteractions();

    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  applyResponsiveCamera() {
    if (this.isVRActive || !this.camera) return;
    const cfg = computeResponsiveCameraConfig(
      this.width,
      this.height,
      this.activeGameType,
      this.mobileHandDockActive
    );
    this.camera.fov = cfg.fov;
    this.camera.aspect = this.width / Math.max(1, this.height);
    this.camera.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
    this.camera.lookAt(cfg.lookAt[0], cfg.lookAt[1], cfg.lookAt[2]);
    this.camera.updateProjectionMatrix();
  }

  setMobileHandDockActive(active) {
    this.mobileHandDockActive = Boolean(active) && !this.isVRActive;
    const isOkeyType = this.activeGameType === 'OKEY' || this.activeGameType === 'OKEY101';
    if (this.playerHandGroup) {
      this.playerHandGroup.visible = !isOkeyType && !this.mobileHandDockActive;
    }
    if (this.playerIstakaGroup) {
      this.playerIstakaGroup.visible = isOkeyType && !this.mobileHandDockActive;
    }
    this.setFeaturePermissions(this.featurePermissions);
    this.applyResponsiveCamera();
  }

  buildEnvironmentReflection() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0xcfe0ee);
      const ceilingLight = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 8),
        new THREE.MeshBasicMaterial({ color: 0xf8fbff, side: THREE.DoubleSide })
      );
      ceilingLight.position.set(0, 3, 0);
      ceilingLight.rotation.x = Math.PI / 2;
      envScene.add(ceilingLight);

      const warmWall = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 5),
        new THREE.MeshBasicMaterial({ color: 0xe8d9c0, side: THREE.DoubleSide })
      );
      warmWall.position.set(0, 1.5, -4);
      envScene.add(warmWall);

      const rt = pmrem.fromScene(envScene, 0.04);
      this.scene.environment = rt.texture;
      pmrem.dispose();
    } catch {
      // ignore if headless / unsupported
    }
  }

  createFeltTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Deep authentic kıraathane emerald green baize radial vignette
    const grad = ctx.createRadialGradient(size / 2, size / 2, 30, size / 2, size / 2, size * 0.52);
    grad.addColorStop(0, '#165b38');
    grad.addColorStop(0.65, '#0f472b');
    grad.addColorStop(1, '#0a331f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Subtle woven felt micro-fibers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let i = 0; i < 4200; i++) {
      const x = (i * 73) % size;
      const y = ((i * 139) + Math.floor(i / 7)) % size;
      ctx.fillRect(x, y, 2, 1);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
    for (let i = 0; i < 3500; i++) {
      const x = (i * 97 + 13) % size;
      const y = (i * 53 + 29) % size;
      ctx.fillRect(x, y, 1, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  buildLighting() {
    this.ambientLight = new THREE.AmbientLight(0xfff8ee, 0.92);
    this.scene.add(this.ambientLight);

    // Bright sky-to-oak hemisphere fill so interior feels airy & spacious
    this.hemiLight = new THREE.HemisphereLight(0xf2f8ff, 0xd9c2a3, 1.08);
    this.scene.add(this.hemiLight);

    // Warm afternoon window sunlight across the card table
    this.sunLight = new THREE.DirectionalLight(0xfff5e4, 1.30);
    this.sunLight.position.set(7.0, 5.8, 2.8);
    this.sunLight.target.position.set(0, 0.8, 0);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.tableSpot = new THREE.SpotLight(0xfffaf0, 3.6, 12, Math.PI / 2.2, 0.65, 1.0);
    this.tableSpot.position.set(0, 2.75, 0);
    this.tableSpot.target.position.set(0, 0.8, 0);
    this.tableSpot.castShadow = true;
    this.tableSpot.shadow.mapSize.width = 1024;
    this.tableSpot.shadow.mapSize.height = 1024;
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
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
    const shadeMesh = new THREE.Mesh(shadeGeo, shadeMat);
    shadeMesh.rotation.x = Math.PI;
    chandelierGroup.add(shadeMesh);

    const bulbGeo = new THREE.SphereGeometry(0.06, 16, 16);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb });
    const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat);
    bulbMesh.position.y = -0.05;
    chandelierGroup.add(bulbMesh);

    this.scene.add(chandelierGroup);

    // Warm airy side fill lights
    this.amberRim = new THREE.PointLight(0xffe4b5, 1.4, 16);
    this.amberRim.position.set(4.0, 2.6, -1.0);
    this.scene.add(this.amberRim);

    this.leftAmber = new THREE.PointLight(0xffe4b5, 1.4, 16);
    this.leftAmber.position.set(-4.0, 2.6, -1.0);
    this.scene.add(this.leftAmber);
  }

  createParquetTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#a0764a';
    ctx.fillRect(0, 0, 512, 512);

    const plankW = 64;
    const plankH = 128;
    for (let row = 0; row < 4; row++) {
      const offset = (row % 2) * (plankW / 2);
      for (let col = -1; col < 9; col++) {
        const x = col * plankW + offset;
        const y = row * plankH;
        const shade = ((row * 7 + col * 13) % 5) * 7;
        ctx.fillStyle = `rgb(${160 + shade}, ${118 + Math.floor(shade * 0.8)}, ${74 + Math.floor(shade * 0.6)})`;
        ctx.fillRect(x + 1, y + 1, plankW - 2, plankH - 2);

        ctx.strokeStyle = 'rgba(92, 58, 28, 0.30)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, plankW, plankH);

        ctx.fillStyle = 'rgba(255, 240, 215, 0.14)';
        ctx.fillRect(x + 10, y + 8, 2, plankH - 16);
        ctx.fillRect(x + 36, y + 12, 1.5, plankH - 24);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(7, 7);
    return tex;
  }

  createWallPanelTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Sunlit warm cream upper plaster
    const upperGrad = ctx.createLinearGradient(0, 0, 0, 290);
    upperGrad.addColorStop(0, '#f2eadc');
    upperGrad.addColorStop(1, '#e5d8c0');
    ctx.fillStyle = upperGrad;
    ctx.fillRect(0, 0, 512, 290);

    // Polished brass dado rail divider
    ctx.fillStyle = '#c9a042';
    ctx.fillRect(0, 286, 512, 10);

    // Lower honey-oak wainscoting panels (Aydınlık Ahşap Lambri)
    ctx.fillStyle = '#7e4f28';
    ctx.fillRect(0, 296, 512, 216);

    for (let x = 16; x < 512; x += 124) {
      ctx.fillStyle = '#925e33';
      ctx.fillRect(x, 314, 96, 178);
      ctx.strokeStyle = '#5c3618';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, 314, 96, 178);
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.32)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 6, 320, 84, 166);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(3, 1);
    return tex;
  }

  buildKahvehaneEnvironment() {
    // Spacious Polished Golden Oak Parquet Floor
    const floorGeo = new THREE.PlaneGeometry(22, 22);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.createParquetTexture(),
      roughness: 0.42,
      metalness: 0.06,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Bright Cream Plaster + Honey-Oak Lambri Walls
    const wallMat = new THREE.MeshStandardMaterial({
      map: this.createWallPanelTexture(),
      roughness: 0.68,
      metalness: 0.04,
    });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), wallMat);
    backWall.position.set(0, 3.5, -7.8);
    this.scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), wallMat);
    leftWall.position.set(-8.2, 3.5, 0);
    leftWall.rotation.y = Math.PI / 2;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), wallMat);
    rightWall.position.set(8.2, 3.5, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this.scene.add(rightWall);

    // Tall Bright Ivory Ceiling + Warm Honey-Oak Ceiling Beams
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 22),
      new THREE.MeshStandardMaterial({ color: 0xf3ece0, roughness: 0.85 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = 6.2;
    this.scene.add(ceiling);

    const beamMat = new THREE.MeshStandardMaterial({ color: 0x8c5b30, roughness: 0.55 });
    const beamGeo = new THREE.BoxGeometry(16.4, 0.24, 0.24);
    for (let bz = -6.0; bz <= 3.0; bz += 2.8) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, 6.06, bz);
      this.scene.add(beam);
    }

    // 4 Tall Sunlit Windows with Sky Views & Sheer Curtains
    this.buildKiraathaneWindow(-8.12, 3.1, -3.4, Math.PI / 2);
    this.buildKiraathaneWindow(-8.12, 3.1, 1.2, Math.PI / 2);
    this.buildKiraathaneWindow(8.12, 3.1, -3.4, -Math.PI / 2);
    this.buildKiraathaneWindow(8.12, 3.1, 1.2, -Math.PI / 2);

    // Lush Potted Café Plants in Rear Corners
    this.buildPottedPlant(-6.8, 0, -6.2);
    this.buildPottedPlant(6.8, 0, -6.2);

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
    this.backWallMuralMesh.position.set(0, 3.5, -7.74);
    this.scene.add(this.backWallMuralMesh);

    // 1. Traditional Turkish Kilim Rug
    this.buildTurkishKilimMesh(0, 3.5, -7.70, 3.6, 2.0);

    // 2. Framed Vintage Paintings & Turkish Wall Clock
    this.buildFramedArtwork(-3.5, 3.3, -7.70, 1.4, 1.0, 'ISTANBUL 1923', './assets/env_classic.jpg');
    this.buildFramedArtwork(3.5, 3.3, -7.70, 1.4, 1.0, 'KIRAATHANE', './assets/env_bosphorus.jpg');
    this.buildWallClock(0, 4.9, -7.68);

    // 3. Copper Turkish Tea Samovar & Counter + Vintage Price Board
    this.buildTeaSamovarCounter(-4.8, 0, -4.5);

    // 4. Gezen Çaycı (Çaycı Hüseyin + Askılı Çay Tepsisi)
    this.buildWalkingCayci();

    // Apply initial theme settings
    this.setKiraathaneEnvironment(this.currentThemeId, false);
  }

  _createDaylightWindowTexture() {
    if (this._daylightWinTex) return this._daylightWinTex;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#bae6fd');
    grad.addColorStop(0.65, '#e0f2fe');
    grad.addColorStop(1, '#fef3c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Soft bright daylight clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    [
      [68, 86, 34, 18],
      [96, 80, 28, 16],
      [182, 118, 38, 18],
      [208, 114, 24, 14],
    ].forEach(([cx, cy, rx, ry]) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._daylightWinTex = tex;
    return tex;
  }

  buildKiraathaneWindow(x, y, z, rotY) {
    const winGroup = new THREE.Group();
    winGroup.position.set(x, y, z);
    winGroup.rotation.y = rotY;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x7c4a24, roughness: 0.48 });
    const glassMat = new THREE.MeshBasicMaterial({ map: this._createDaylightWindowTexture() });

    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.5), glassMat);
    winGroup.add(backdrop);

    // Oak window mullions
    const barH = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.08, 0.06), frameMat);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.06), frameMat);
    winGroup.add(barH, barV);

    // Outer frame borders
    const topF = new THREE.Mesh(new THREE.BoxGeometry(2.96, 0.12, 0.09), frameMat);
    topF.position.y = 1.28;
    const botF = topF.clone();
    botF.position.y = -1.28;
    const leftF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.62, 0.09), frameMat);
    leftF.position.x = -1.43;
    const rightF = leftF.clone();
    rightF.position.x = 1.43;
    winGroup.add(topF, botF, leftF, rightF);

    // Sheer cream side curtains (zero transmission)
    const curtainMat = new THREE.MeshStandardMaterial({
      color: 0xf8f3e8,
      transparent: true,
      opacity: 0.78,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const curtainGeo = new THREE.BoxGeometry(0.36, 2.52, 0.04);
    const leftCurtain = new THREE.Mesh(curtainGeo, curtainMat);
    leftCurtain.position.set(-1.18, 0, 0.06);
    const rightCurtain = new THREE.Mesh(curtainGeo, curtainMat);
    rightCurtain.position.set(1.18, 0, 0.06);
    winGroup.add(leftCurtain, rightCurtain);

    this.scene.add(winGroup);
  }

  buildPottedPlant(x, y, z) {
    const plant = new THREE.Group();
    plant.position.set(x, y, z);

    const potMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.75 });
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.42, 16), potMat);
    pot.position.y = 0.21;
    plant.add(pot);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: 0x3f2a1a, roughness: 0.95 })
    );
    soil.position.y = 0.41;
    plant.add(soil);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228b22, roughness: 0.58 });
    const leafGeo = new THREE.ConeGeometry(0.14, 0.55, 7);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.cos(angle) * 0.11, 0.68 + (i % 2) * 0.12, Math.sin(angle) * 0.11);
      leaf.rotation.z = -Math.cos(angle) * 0.36;
      leaf.rotation.x = Math.sin(angle) * 0.36;
      plant.add(leaf);
    }

    this.scene.add(plant);
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

    // 2. Update Bright Airy Lighting & Atmosphere
    if (this.ambientLight) {
      this.ambientLight.color.setHex(theme.lightColor);
      this.ambientLight.intensity = theme.ambientIntensity;
    }
    if (this.hemiLight && theme.hemiIntensity) {
      this.hemiLight.intensity = theme.hemiIntensity;
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

    // Row of little tea glasses on tray (lightweight reflective glass — zero extra render pass)
    const gMat = new THREE.MeshStandardMaterial({
      color: 0xeaf6ff,
      transparent: true,
      opacity: 0.3,
      roughness: 0.08,
      metalness: 0.16,
      depthWrite: false
    });
    const gGeo = new THREE.CylinderGeometry(0.02, 0.015, 0.06, 12);
    for (let i = 0; i < 4; i++) {
      const glass = new THREE.Mesh(gGeo, gMat);
      glass.position.set(-0.5 + i * 0.12, 0.93, 0.15);
      counterGroup.add(glass);
    }

    // Authentic Kıraathane Fiyat Tabelası on Samovar Counter
    const menuCanvas = document.createElement('canvas');
    menuCanvas.width = 512;
    menuCanvas.height = 256;
    const mCtx = menuCanvas.getContext('2d');
    mCtx.fillStyle = '#18120c';
    mCtx.fillRect(0, 0, 512, 256);
    mCtx.strokeStyle = '#d4af37';
    mCtx.lineWidth = 10;
    mCtx.strokeRect(8, 8, 496, 240);
    mCtx.fillStyle = '#fef08a';
    mCtx.font = 'bold 34px "Cinzel", Georgia, serif';
    mCtx.textAlign = 'center';
    mCtx.fillText('☕ ÇAY OCAĞI FİYATLARI', 256, 48);
    mCtx.fillStyle = '#f8fafc';
    mCtx.font = 'bold 26px "Outfit", sans-serif';
    mCtx.textAlign = 'left';
    mCtx.fillText('• İnce Belli Çay ............. 15 ₺', 42, 104);
    mCtx.fillText('• Köpüklü Türk Kahvesi ..... 45 ₺', 42, 146);
    mCtx.fillText('• Sıcak Oralet / Ihlamur ... 20 ₺', 42, 188);
    mCtx.fillText('• Közde Osmanlı Nargile .... 180 ₺', 42, 230);

    const menuTex = new THREE.CanvasTexture(menuCanvas);
    menuTex.colorSpace = THREE.SRGBColorSpace;
    const menuBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.58, 0.04),
      new THREE.MeshStandardMaterial({ map: menuTex, roughness: 0.45 })
    );
    menuBoard.position.set(0.35, 1.55, -0.35);
    menuBoard.rotation.y = 0.25;
    counterGroup.add(menuBoard);

    this.scene.add(counterGroup);
  }

  // --- WALKING ÇAYCI (ÇAYCI HÜSEYİN) COLLISION-FREE PATROL & VOICE CALL (NO TEXT) ---
  buildWalkingCayci() {
    if (this.cayciAvatar) {
      this.scene.remove(this.cayciAvatar);
    }

    this.cayciAvatar = createCayciAvatar();
    const startNode = CAYCI_NAV_NODES[0];
    this.cayciAvatar.position.set(startNode.x, 0, startNode.z);
    this.cayciAvatar.userData.isCayci = true;

    this.scene.add(this.cayciAvatar);

    this.cayciPatrolOrder = [1, 3, 9, 5, 7, 10, 0];
    this.cayciState = {
      currentNode: 0,
      patrolStep: 0,
      pathQueue: findCayciPath(0, this.cayciPatrolOrder[0]),
      mode: 'walk', // 'walk' | 'pause' | 'summoned'
      pauseUntil: 0,
      speakingUntil: 0,
      lastSpeakTime: performance.now() - 20000,
      nextClinkTime: performance.now() + 3000,
      walkPhase: 0,
      lastTime: performance.now(),
    };
  }

  showCayciSpeechBubble() {
    // Kullanıcı isteği: Kahvecinin söyledikleri ekranda yazıyla gösterilmez.
  }

  _speakCayciSpatial(now) {
    if (!this.cayciAvatar || !this.cayciState) return;
    const cx = this.cayciAvatar.position.x;
    const cz = this.cayciAvatar.position.z;
    const dx = cx;
    const dz = cz - 0.95;
    const dist = Math.hypot(dx, dz);
    const pan = Math.max(-0.9, Math.min(0.9, cx / 3.5));
    const distGain = Math.max(0.35, Math.min(1.12, 1.15 - dist * 0.12));

    this.cayciState.speakingUntil = now + 3100;
    this.cayciState.lastSpeakTime = now;
    soundFx.speakCayciCall(pan, distGain);
  }

  summonCayciForTea() {
    if (!this.cayciAvatar || !this.cayciState) return;
    const now = performance.now();
    const st = this.cayciState;
    const nearest = findNearestCayciNode(this.cayciAvatar.position.x, this.cayciAvatar.position.z);
    const pathToPlayer = findCayciPath(nearest, 5);
    st.pathQueue = pathToPlayer.length > 0 ? pathToPlayer : [5];
    st.mode = 'summoned';
    st.pauseUntil = 0;

    this._speakCayciSpatial(now);
  }

  updateWalkingCayci(now = performance.now()) {
    if (!this.cayciAvatar || !this.cayciState) return;

    const st = this.cayciState;
    const dt = Math.min(0.08, Math.max(0.001, (now - st.lastTime) * 0.001));
    st.lastTime = now;
    const ud = this.cayciAvatar.userData;

    if (st.mode === 'pause') {
      const node = CAYCI_NAV_NODES[st.currentNode] || CAYCI_NAV_NODES[0];
      const lookDx = node.lookAt[0] - this.cayciAvatar.position.x;
      const lookDz = node.lookAt[1] - this.cayciAvatar.position.z;
      const targetRot = Math.atan2(lookDx, lookDz);
      const diff = Math.atan2(Math.sin(targetRot - this.cayciAvatar.rotation.y), Math.cos(targetRot - this.cayciAvatar.rotation.y));
      this.cayciAvatar.rotation.y += diff * Math.min(1, dt * 6.5);
      this._resetCayciIdle(ud, now);

      if (now >= st.pauseUntil) {
        st.mode = 'walk';
        st.patrolStep = (st.patrolStep + 1) % this.cayciPatrolOrder.length;
        const goalIdx = this.cayciPatrolOrder[st.patrolStep];
        st.pathQueue = findCayciPath(st.currentNode, goalIdx);
        if (st.pathQueue.length === 0) st.pathQueue = [goalIdx];
      }
      return;
    }

    if (st.mode === 'summoned' && st.pathQueue.length === 0 && st.pauseUntil > 0) {
      // Standing beside player's tea table spot (node 5), facing player
      const lookDx = 0 - this.cayciAvatar.position.x;
      const lookDz = 0.45 - this.cayciAvatar.position.z;
      const targetRot = Math.atan2(lookDx, lookDz);
      const diff = Math.atan2(Math.sin(targetRot - this.cayciAvatar.rotation.y), Math.cos(targetRot - this.cayciAvatar.rotation.y));
      this.cayciAvatar.rotation.y += diff * Math.min(1, dt * 6.5);
      this._resetCayciIdle(ud, now);

      if (now >= st.pauseUntil) {
        st.mode = 'walk';
        st.pauseUntil = 0;
        st.patrolStep = (st.patrolStep + 1) % this.cayciPatrolOrder.length;
        const goalIdx = this.cayciPatrolOrder[st.patrolStep];
        st.pathQueue = findCayciPath(st.currentNode, goalIdx);
      }
      return;
    }

    if (!st.pathQueue || st.pathQueue.length === 0) {
      const goalIdx = this.cayciPatrolOrder[st.patrolStep];
      st.pathQueue = findCayciPath(st.currentNode, goalIdx);
      if (st.pathQueue.length === 0) return;
    }

    const nextIdx = st.pathQueue[0];
    const targetNode = CAYCI_NAV_NODES[nextIdx];
    const pos = this.cayciAvatar.position;
    let dx = targetNode.x - pos.x;
    let dz = targetNode.z - pos.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.12) {
      // Normalized desired direction + gentle tangential avoidance around tables
      let vx = dx / dist;
      let vz = dz / dist;

      for (let i = 0; i < CAYCI_OBSTACLES.length; i++) {
        const obs = CAYCI_OBSTACLES[i];
        const odx = pos.x - obs.x;
        const odz = pos.z - obs.z;
        const od = Math.hypot(odx, odz);
        const safeBand = obs.r + 0.32;
        if (od < safeBand && od > 1e-4) {
          const strength = (safeBand - od) / 0.32;
          const rx = odx / od;
          const rz = odz / od;
          vx += rx * strength * 0.9;
          vz += rz * strength * 0.9;
        }
      }
      const vLen = Math.hypot(vx, vz) || 1;
      vx /= vLen;
      vz /= vLen;

      const speed = st.mode === 'summoned' ? 0.95 : 0.68;
      pos.x += vx * speed * dt;
      pos.z += vz * speed * dt;

      // Hard physical collision resolution (never pass through tables/chairs)
      resolveCayciCollisions(pos, CAYCI_OBSTACLES);

      const targetRot = Math.atan2(vx, vz);
      const diff = Math.atan2(Math.sin(targetRot - this.cayciAvatar.rotation.y), Math.cos(targetRot - this.cayciAvatar.rotation.y));
      this.cayciAvatar.rotation.y += diff * Math.min(1, dt * 6.5);
      this._animateCayciStride(st, ud, dt, st.mode === 'summoned' ? 1.25 : 1.0, now);

      if (now > st.nextClinkTime) {
        st.nextClinkTime = now + 7500 + Math.random() * 5000;
        const pan = Math.max(-0.9, Math.min(0.9, pos.x / 3.5));
        soundFx.playCayciTrayClink(pan);
      }
    } else {
      st.currentNode = nextIdx;
      st.pathQueue.shift();

      if (st.pathQueue.length === 0) {
        if (st.mode === 'summoned') {
          st.pauseUntil = now + 3500;
          soundFx.playTeaPourSound();
          if (this.steamPoints) {
            this.steamPoints.material.opacity = 0.68;
          }
        } else {
          st.mode = 'pause';
          st.pauseUntil = now + 3800;
          if (now - st.lastSpeakTime > 24000) {
            this._speakCayciSpatial(now);
          }
        }
      }
    }
  }

  _animateCayciStride(st, ud, dt, rate = 1.0, now = performance.now()) {
    st.walkPhase += dt * 5.2 * rate;
    const swing = Math.sin(st.walkPhase) * 0.42;
    if (ud.leftLeg) ud.leftLeg.rotation.x = swing;
    if (ud.rightLeg) ud.rightLeg.rotation.x = -swing;
    if (ud.leftArm) ud.leftArm.rotation.x = -swing * 0.65;
    if (ud.trayGroup) {
      ud.trayGroup.rotation.z = Math.sin(st.walkPhase * 2) * 0.03;
      ud.trayGroup.rotation.x = Math.cos(st.walkPhase) * 0.03;
    }
    this.cayciAvatar.position.y = Math.abs(Math.sin(st.walkPhase)) * 0.015;
    if (ud.mouth) {
      if (now < (st.speakingUntil || 0)) {
        ud.mouth.scale.set(1, 1 + Math.abs(Math.sin(now * 0.02)) * 0.42, 1);
      } else {
        ud.mouth.scale.set(1, 1, 1);
      }
    }
  }

  _resetCayciIdle(ud, now) {
    const st = this.cayciState;
    if (ud.leftLeg) ud.leftLeg.rotation.x *= 0.85;
    if (ud.rightLeg) ud.rightLeg.rotation.x *= 0.85;
    if (ud.leftArm) ud.leftArm.rotation.x *= 0.85;
    if (ud.trayGroup) {
      ud.trayGroup.rotation.z *= 0.85;
      ud.trayGroup.rotation.x *= 0.85;
    }
    this.cayciAvatar.position.y = Math.sin(now * 0.002) * 0.004;
    if (ud.mouth && st && now < (st.speakingUntil || 0)) {
      const talkScale = 1 + Math.abs(Math.sin(now * 0.02)) * 0.42;
      ud.mouth.scale.set(1, talkScale, 1);
    } else if (ud.mouth) {
      ud.mouth.scale.set(1, 1, 1);
    }
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
    this.tablePlayers = players;
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

    // Side Table 1 (Back Right Cafe Table — Tavla Masası)
    this.buildCafeTableWithPatrons(3.6, 0, -3.2, ['kahkaha_dayi', 'gozluklu_abi'], true);

    // Side Table 2 (Back Left Cafe Table)
    this.buildCafeTableWithPatrons(-3.6, 0, -3.2, ['ayse', 'hayrettin'], false);

    // Side Table 3 (Front Right Cafe Table)
    this.buildCafeTableWithPatrons(3.8, 0, 1.8, ['serdar', 'dayi'], false);
  }

  buildCafeTableWithPatrons(x, y, z, presetIds = ['kahkaha_dayi', 'gozluklu_abi'], hasTavla = false) {
    const tableGroup = new THREE.Group();
    tableGroup.position.set(x, y, z);

    // Table
    const topGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.04, 28);
    const woodMat = new THREE.MeshStandardMaterial({
      map: okeyTexGen.getWalnutWoodTexture(),
      roughness: 0.38,
    });
    const topMesh = new THREE.Mesh(topGeo, woodMat);
    topMesh.position.y = 0.8;
    tableGroup.add(topMesh);

    const legGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.8, 12);
    const legMesh = new THREE.Mesh(legGeo, woodMat);
    legMesh.position.y = 0.4;
    tableGroup.add(legMesh);

    // Green felt insert
    const feltGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.01, 28);
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x0f472b, roughness: 0.85 });
    const felt = new THREE.Mesh(feltGeo, feltMat);
    felt.position.y = 0.82;
    tableGroup.add(felt);

    if (hasTavla) {
      // Mini 3D Backgammon Board (Tavla) on Side Table
      const tavlaBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.024, 0.36),
        new THREE.MeshStandardMaterial({ color: 0x5c260a, roughness: 0.4 })
      );
      tavlaBoard.position.y = 0.835;
      tableGroup.add(tavlaBoard);

      const innerField = new THREE.Mesh(
        new THREE.BoxGeometry(0.41, 0.005, 0.31),
        new THREE.MeshStandardMaterial({ color: 0xead9be, roughness: 0.6 })
      );
      innerField.position.y = 0.848;
      tableGroup.add(innerField);

      const darkCheckerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
      const lightCheckerMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.3 });
      const checkerGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.006, 12);
      for (let i = 0; i < 4; i++) {
        const dc = new THREE.Mesh(checkerGeo, darkCheckerMat);
        dc.position.set(-0.14 + i * 0.04, 0.853, -0.10);
        const lc = new THREE.Mesh(checkerGeo, lightCheckerMat);
        lc.position.set(-0.14 + i * 0.04, 0.853, 0.10);
        tableGroup.add(dc, lc);
      }
    }

    // Two distinct realistic patrons facing each other
    const patron1 = avatarBuilder.createCharacter(presetIds[0] || 'dayi');
    patron1.position.set(0, 0, 0.72);
    patron1.rotation.y = Math.PI;
    patron1.userData.baseRotY = Math.PI;
    tableGroup.add(patron1);
    this.backgroundAvatars.push(patron1);

    const patron2 = avatarBuilder.createCharacter(presetIds[1] || 'hayrettin');
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

    // Table Top Rim (Rich Walnut Wood Grain)
    const rimGeo = new THREE.CylinderGeometry(tableRadius + 0.08, tableRadius + 0.08, 0.06, 48);
    const rimMat = new THREE.MeshStandardMaterial({
      map: okeyTexGen.getWalnutWoodTexture(),
      roughness: 0.36,
      metalness: 0.08
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = tableHeight - 0.03;
    rimMesh.receiveShadow = true;
    rimMesh.castShadow = true;
    this.tableGroup.add(rimMesh);

    // Woven Emerald Baize Felt Inset
    const feltGeo = new THREE.CylinderGeometry(tableRadius, tableRadius, 0.02, 48);
    const feltMat = new THREE.MeshStandardMaterial({
      map: this.createFeltTexture(),
      roughness: 0.90,
      metalness: 0.02
    });
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

    // Center Table Area (Strictly above green baize felt top at tableHeight + 0.010)
    this.tableCenterGroup = new THREE.Group();
    this.tableCenterGroup.position.set(0, tableHeight + 0.012, 0);
    this.tableGroup.add(this.tableCenterGroup);

    // 101 Okey Opened Pers area
    this.openedPersGroup = new THREE.Group();
    this.openedPersGroup.position.set(0, tableHeight + 0.012, 0);
    this.tableGroup.add(this.openedPersGroup);

    // Player Hand Group (Ergonomic raised card fan facing seated eye level — single upright tilt)
    this.playerHandGroup = new THREE.Group();
    this.playerHandGroup.position.set(0, tableHeight + 0.155, 0.57);
    this.playerHandGroup.rotation.set(0, 0, 0);
    this.scene.add(this.playerHandGroup);

    // Player 3D Istaka (Angled ~33 deg toward eye level so both rows & dimples are 100% crisp)
    this.playerIstakaGroup = new THREE.Group();
    this.playerIstakaGroup.position.set(0, tableHeight + 0.012, 0.56);
    this.playerIstakaGroup.rotation.x = -0.58;
    const playerRackMesh = createIstaka3DMesh();
    this.playerIstakaGroup.add(playerRackMesh);
    this.buildIstakaSlotTargets();
    this.playerIstakaGroup.visible = false;
    this.scene.add(this.playerIstakaGroup);

    // Opponents
    this.opponentHandGroups = [];
    this.opponentIstakaGroups = [];
    this.discardGroups = [];

    const oppPositions = [
      { pos: [0.68, tableHeight + 0.095, 0], rotY: -Math.PI / 2 },
      { pos: [0, tableHeight + 0.095, -0.68], rotY: Math.PI },
      { pos: [-0.68, tableHeight + 0.095, 0], rotY: Math.PI / 2 }
    ];

    const oppIstakaPositions = [
      { pos: [0.68, tableHeight + 0.005, 0], rotY: -Math.PI / 2 },
      { pos: [0, tableHeight + 0.005, -0.68], rotY: Math.PI },
      { pos: [-0.68, tableHeight + 0.005, 0], rotY: Math.PI / 2 }
    ];

    oppPositions.forEach((opp, idx) => {
      const hg = new THREE.Group();
      hg.position.set(...opp.pos);
      hg.rotation.y = opp.rotY;
      this.tableGroup.add(hg);
      this.opponentHandGroups.push(hg);

      const ig = new THREE.Group();
      ig.position.set(...oppIstakaPositions[idx].pos);
      ig.rotation.y = oppIstakaPositions[idx].rotY;
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
    // Authentic Kıraathane Chair for Local Player (Seat 0: X=0, Z=1.00m, facing table)
    this.playerChair = avatarBuilder.createCafeChair();
    this.playerChair.position.set(0, 0, this.vrSeatZ);
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

  buildIstakaSlotTargets() {
    this.istakaStaticGroup = new THREE.Group();
    const slotSpacing = ISTAKA_SLOT_SPACING;
    const hitGeo = new THREE.BoxGeometry(0.041, 0.058, 0.020);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.istakaSlotHits = [];

    for (let tier = 0; tier < 2; tier++) {
      const { y, z } = ISTAKA_TIER_COORDS[tier];
      for (let slot = 0; slot < ISTAKA_SLOTS_PER_TIER; slot++) {
        const x = (slot - (ISTAKA_SLOTS_PER_TIER - 1) / 2) * slotSpacing;
        const slotHit = new THREE.Mesh(hitGeo, hitMat);
        slotHit.position.set(x, y, z);
        slotHit.rotation.x = 0;
        slotHit.userData = { isIstakaSlot: true, tier, slot, baseX: x, baseY: y, baseZ: z };
        this.istakaStaticGroup.add(slotHit);
        this.istakaSlotHits.push(slotHit);
      }
    }

    // Translucent golden preview box showing target slot while dragging a tile
    const hlGeo = new THREE.BoxGeometry(0.041, 0.058, 0.014);
    const hlMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    this.slotHighlightMesh = new THREE.Mesh(hlGeo, hlMat);
    this.slotHighlightMesh.rotation.x = 0;
    this.slotHighlightMesh.visible = false;
    this.istakaStaticGroup.add(this.slotHighlightMesh);

    this.playerIstakaGroup.add(this.istakaStaticGroup);
  }

  buildPermanentVRControls() {
    const tableHeight = 0.82;
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 });

    const createTablePlaque = (label, x, z, rotY, borderColor, textColor, onClick) => {
      const plaqueGeo = new THREE.BoxGeometry(0.17, 0.014, 0.075);
      const plaque = new THREE.Mesh(plaqueGeo, brassMat);
      plaque.position.set(x, tableHeight + 0.008, z);
      plaque.rotation.y = rotY;
      this.tableGroup.add(plaque);

      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 112;
      const ctx = canvas.getContext('2d');

      const drawPlaque = (txt, strokeCol = borderColor, txtCol = textColor) => {
        ctx.clearRect(0, 0, 256, 112);
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(6, 6, 244, 100, 16);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = strokeCol;
        ctx.stroke();

        ctx.fillStyle = txtCol;
        ctx.font = 'bold 26px "Outfit", "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, 128, 56);
      };

      drawPlaque(label);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const btnGeo = new THREE.PlaneGeometry(0.155, 0.066);
      const btnMesh = new THREE.Mesh(btnGeo, mat);
      btnMesh.position.set(0, 0.0085, 0);
      btnMesh.rotation.x = -Math.PI / 2;
      plaque.add(btnMesh);

      btnMesh.userData = {
        isButton: true,
        label,
        redraw: (newTxt, strokeCol, txtCol) => {
          drawPlaque(newTxt, strokeCol, txtCol);
          tex.needsUpdate = true;
        },
        onClick: () => {
          soundFx.playButtonClick();
          onClick();
        }
      };

      return btnMesh;
    };

    const btnRecenter = createTablePlaque('🪑 Hizala', -0.58, 0.54, -Math.PI / 6, '#d4af37', '#fef08a', () => {
      this.recenterToChair();
    });

    this.vrMicDockBtn = createTablePlaque('🎙️ Mik: Kapalı', -0.42, 0.66, -Math.PI / 9, '#38bdf8', '#e0f2fe', () => {
      if (this.onVRMicToggleCallback) this.onVRMicToggleCallback();
    });

    this.vrSpeakerDockBtn = createTablePlaque('🔊 Ses: Açık', 0.42, 0.66, Math.PI / 9, '#22c55e', '#bbf7d0', () => {
      if (this.onVRSpeakerToggleCallback) this.onVRSpeakerToggleCallback();
    });

    const btnExitVr = createTablePlaque('🚪 VR Çık', 0.58, 0.54, Math.PI / 6, '#ef4444', '#fca5a5', () => {
      this.exitVR();
    });

    this.permanentInteractiveButtons = [btnRecenter, this.vrMicDockBtn, this.vrSpeakerDockBtn, btnExitVr];
    this.buildVRQuickSortPanels();
  }

  updateVRDockAudioLabels(micActive, micMuted, speakerMuted) {
    if (this.vrMicDockBtn?.userData?.redraw) {
      if (!micActive) {
        this.vrMicDockBtn.userData.redraw('🎙️ Mik: Aç', '#38bdf8', '#e0f2fe');
      } else if (micMuted) {
        this.vrMicDockBtn.userData.redraw('🔇 Mik: Kapalı', '#ef4444', '#fca5a5');
      } else {
        this.vrMicDockBtn.userData.redraw('🎤 Mik: Açık', '#22c55e', '#bbf7d0');
      }
    }
    if (this.vrSpeakerDockBtn?.userData?.redraw) {
      if (speakerMuted) {
        this.vrSpeakerDockBtn.userData.redraw('🔇 Ses: Sessiz', '#ef4444', '#fca5a5');
      } else {
        this.vrSpeakerDockBtn.userData.redraw('🔊 Ses: Açık', '#22c55e', '#bbf7d0');
      }
    }
  }

  buildVRQuickSortPanels() {
    const tableHeight = 0.82;

    const createDockButton = (label, x, y, z, width, height, color, onClick) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 0, 100);
      grad.addColorStop(0, color);
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(6, 6, 244, 88, 18);
      ctx.fill();

      ctx.lineWidth = 5;
      ctx.strokeStyle = '#f8fafc';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px "Outfit", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 128, 50);

      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1
      });

      const btnGeo = new THREE.BoxGeometry(width, height, 0.008);
      const btnMesh = new THREE.Mesh(btnGeo, mat);
      btnMesh.position.set(x, y, z);
      btnMesh.castShadow = true;

      btnMesh.userData = {
        isButton: true,
        label,
        onClick: () => {
          soundFx.playButtonClick();
          if (onClick) onClick();
        }
      };

      this.permanentInteractiveButtons.push(btnMesh);
      return btnMesh;
    };

    const dockWoodMat = new THREE.MeshStandardMaterial({ color: 0x241108, roughness: 0.35, metalness: 0.2 });

    // 1. OKEY QUICK SORT DOCK (🧠 Akıllı Diz | 📐 Seri Diz | 👥 Çift Diz | 📸 Fotoğraf Düzeni)
    this.okeyQuickSortGroup = new THREE.Group();
    this.okeyQuickSortGroup.position.set(0, tableHeight + 0.010, 0.69);
    this.okeyQuickSortGroup.rotation.x = -Math.PI / 4.2;

    const okeyDockGeo = new THREE.BoxGeometry(0.56, 0.010, 0.075);
    const okeyDockBase = new THREE.Mesh(okeyDockGeo, dockWoodMat);
    this.okeyQuickSortGroup.add(okeyDockBase);

    this.vrBtnOkeyAiSort = createDockButton('🧠 Akıllı Diz', -0.21, 0.007, 0, 0.12, 0.046, '#059669', () => {
      if (this.onSortAiCallback) this.onSortAiCallback();
    });
    this.vrBtnOkeyRuns = createDockButton('📐 Seri Diz', -0.07, 0.007, 0, 0.12, 0.046, '#2563eb', () => {
      if (this.onSortRunsCallback) this.onSortRunsCallback();
    });
    this.vrBtnOkeyPairs = createDockButton('👥 Çift Diz', 0.07, 0.007, 0, 0.12, 0.046, '#7c3aed', () => {
      if (this.onSortPairsCallback) this.onSortPairsCallback();
    });
    this.vrBtnOkeyPhotoDemo = createDockButton('📸 Fotoğraf Düzeni', 0.21, 0.007, 0, 0.13, 0.046, '#d97706', () => {
      if (this.onSortPhotoDemoCallback) this.onSortPhotoDemoCallback();
    });
    this.okeyQuickSortGroup.add(this.vrBtnOkeyAiSort, this.vrBtnOkeyRuns, this.vrBtnOkeyPairs, this.vrBtnOkeyPhotoDemo);
    this.tableGroup.add(this.okeyQuickSortGroup);

    // 2. CARD GAMES QUICK SORT DOCK (🎴 Kartları Sırala | 💡 AI Hamlesi)
    this.cardQuickSortGroup = new THREE.Group();
    this.cardQuickSortGroup.position.set(0, tableHeight + 0.015, 0.70);
    this.cardQuickSortGroup.rotation.x = -Math.PI / 4.2;

    const cardDockGeo = new THREE.BoxGeometry(0.42, 0.010, 0.075);
    const cardDockBase = new THREE.Mesh(cardDockGeo, dockWoodMat);
    this.cardQuickSortGroup.add(cardDockBase);

    this.vrBtnCardSort = createDockButton('🎴 Kartları Sırala', -0.10, 0.007, 0, 0.18, 0.046, '#0d9488', () => {
      if (this.onSortCardsCallback) this.onSortCardsCallback();
    });
    this.vrBtnCardAiAdvice = createDockButton('💡 AI Hamlesi', 0.11, 0.007, 0, 0.15, 0.046, '#d97706', () => {
      if (this.onAiAdviceClickCallback) this.onAiAdviceClickCallback();
    });
    this.cardQuickSortGroup.add(this.vrBtnCardSort, this.vrBtnCardAiAdvice);
    this.tableGroup.add(this.cardQuickSortGroup);

    this.setFeaturePermissions(this.featurePermissions);
  }

  setFeaturePermissions({ canAutoSort = false, canUseAI = false } = {}) {
    this.featurePermissions = {
      canAutoSort: Boolean(canAutoSort),
      canUseAI: Boolean(canUseAI),
    };
    const isOkeyType = this.activeGameType === 'OKEY' || this.activeGameType === 'OKEY101';
    const allowSort = this.featurePermissions.canAutoSort;
    const allowAi = this.featurePermissions.canUseAI;

    if (this.okeyQuickSortGroup) {
      this.okeyQuickSortGroup.visible = allowSort && isOkeyType && !this.mobileHandDockActive;
    }
    if (this.cardQuickSortGroup) {
      this.cardQuickSortGroup.visible = allowSort && !isOkeyType && !this.mobileHandDockActive;
    }
    if (this.vrBtnOkeyAiSort) this.vrBtnOkeyAiSort.visible = allowSort && allowAi;
    if (this.vrBtnOkeyPhotoDemo) this.vrBtnOkeyPhotoDemo.visible = allowSort && allowAi;
    if (this.vrBtnOkeyRuns) this.vrBtnOkeyRuns.visible = allowSort;
    if (this.vrBtnOkeyPairs) this.vrBtnOkeyPairs.visible = allowSort;

    if (this.vrBtnCardSort) this.vrBtnCardSort.visible = allowSort;
    if (this.vrBtnCardAiAdvice) this.vrBtnCardAiAdvice.visible = allowSort && allowAi;
  }

  recenterToChair() {
    const targetSeatX = 0;
    const targetSeatZ = this.vrSeatZ; // Comfortable close seated table edge (0.88m)

    if (this.isVRActive) {
      // In Three.js WebXR, query renderer.xr.getCamera() to get true physical headset offset
      const xrCamera = this.renderer.xr.getCamera();
      let hx = 0;
      let hz = 0;
      let hy = 1.2;

      if (xrCamera && xrCamera.position) {
        hx = xrCamera.position.x || 0;
        hz = xrCamera.position.z || 0;
        hy = xrCamera.position.y || 1.2;
      }

      // Position cameraRig so user's head in world space sits precisely at the table edge (0, y, 0.98)
      this.cameraRig.position.x = targetSeatX - hx;
      this.cameraRig.position.z = targetSeatZ - hz;

      // Seated height comfort:
      // If user is standing physically in room (eye height > 1.45m), lower rig so they sit naturally at table (~1.20m)
      // If user is already sitting down physically, keep rig Y = 0 to preserve real floor tracking
      if (hy > 1.45) {
        this.cameraRig.position.y = 1.20 - hy;
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

  exitVR() {
    soundFx.playButtonClick();
    if (this.renderer && this.renderer.xr) {
      const session = this.renderer.xr.getSession();
      if (session) {
        session.end().catch(err => console.warn('XR session end error:', err));
      }
    }
  }

  showVRGameOverDialog(options = {}) {
    this.hideVRGameOverDialog();

    this.vrGameOverGroup = new THREE.Group();
    this.vrGameOverGroup.position.set(0, 1.06, 0.36);
    this.vrGameOverGroup.rotation.x = -Math.PI / 10;

    const width = 0.62;
    const height = 0.34;

    // 1. Decorative Panel Frame with Canvas Texture
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, 280);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#1e293b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.roundRect(8, 8, 496, 264, 22);
    ctx.fill();

    ctx.lineWidth = 8;
    ctx.strokeStyle = '#f59e0b';
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 36px "Outfit", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 OYUN BİTTİ!', 256, 52);

    ctx.fillStyle = '#6ee7b7';
    ctx.font = 'bold 28px "Outfit", "Segoe UI", sans-serif';
    ctx.fillText(`👑 Kazanan: ${options.winnerName || 'Oyuncu'}`, 256, 98);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px "Segoe UI", sans-serif';
    ctx.fillText(options.scoreText || 'Maç tamamlandı!', 256, 140);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;

    const panelGeo = new THREE.BoxGeometry(width, height, 0.012);
    const panelMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.25,
      metalness: 0.15
    });
    const panelMesh = new THREE.Mesh(panelGeo, panelMat);
    this.vrGameOverGroup.add(panelMesh);

    // 2. Interactive 3D Action Buttons
    const createDialogButton = (label, x, y, color, onClick) => {
      const btnCanvas = document.createElement('canvas');
      btnCanvas.width = 256;
      btnCanvas.height = 100;
      const bCtx = btnCanvas.getContext('2d');

      bCtx.fillStyle = color;
      bCtx.roundRect(6, 6, 244, 88, 16);
      bCtx.fill();
      bCtx.lineWidth = 5;
      bCtx.strokeStyle = '#ffffff';
      bCtx.stroke();

      bCtx.fillStyle = '#ffffff';
      bCtx.font = 'bold 26px "Outfit", "Segoe UI", sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText(label, 128, 50);

      const bTex = new THREE.CanvasTexture(btnCanvas);
      const bMat = new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.3, metalness: 0.1 });
      const bGeo = new THREE.BoxGeometry(0.18, 0.062, 0.015);
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.set(x, y, 0.014);

      bMesh.userData = {
        isButton: true,
        label,
        onClick: () => {
          soundFx.playButtonClick();
          if (onClick) onClick();
        }
      };

      this.vrGameOverGroup.add(bMesh);
      this.interactive3DButtons.push(bMesh);
      return bMesh;
    };

    // Button 1: 🔄 Tekrar Oyna
    createDialogButton('🔄 Tekrar Oyna', -0.19, -0.09, '#059669', () => {
      this.hideVRGameOverDialog();
      if (options.onPlayAgain) options.onPlayAgain();
    });

    // Button 2: 🚪 VR'dan Çık
    createDialogButton('🚪 VR\'dan Çık', 0, -0.09, '#dc2626', () => {
      this.hideVRGameOverDialog();
      this.exitVR();
      if (options.onExitVR) options.onExitVR();
    });

    // Button 3: 🏠 Ana Menü
    createDialogButton('🏠 Ana Menü', 0.19, -0.09, '#2563eb', () => {
      this.hideVRGameOverDialog();
      if (options.onMenu) options.onMenu();
    });

    this.scene.add(this.vrGameOverGroup);
  }

  hideVRGameOverDialog() {
    if (this.vrGameOverGroup) {
      this.interactive3DButtons = this.interactive3DButtons.filter(b => !this.vrGameOverGroup.children.includes(b));
      this.scene.remove(this.vrGameOverGroup);
      this.vrGameOverGroup = null;
    }
  }

  setSelectedTileIndex(idx = -1) {
    this.selectedTileIndex = idx;
  }

  highlightTileOnRack(slotIndex) {
    this.selectedTileIndex = slotIndex;
    const tileMeshes = this.playerIstakaGroup.children.filter(c => c.userData && c.userData.isOkeyTile);
    tileMeshes.forEach((mesh, idx) => {
      const baseY = mesh.userData.baseY !== undefined ? mesh.userData.baseY : mesh.position.y;
      const baseZ = mesh.userData.baseZ !== undefined ? mesh.userData.baseZ : mesh.position.z;
      if (idx === slotIndex) {
        mesh.position.y = baseY + 0.024;
        mesh.position.z = baseZ - 0.012;
        mesh.scale.set(1.12, 1.12, 1.12);
      } else {
        mesh.position.y = baseY;
        mesh.position.z = baseZ;
        mesh.scale.set(1, 1, 1);
      }
    });
  }

  setGameModeView(gameType) {
    this.activeGameType = gameType;
    const isOkeyType = gameType === 'OKEY' || gameType === 'OKEY101';

    this.playerHandGroup.visible = !isOkeyType && !this.mobileHandDockActive;
    this.playerIstakaGroup.visible = isOkeyType && !this.mobileHandDockActive;

    if (this.okeyQuickSortGroup) this.okeyQuickSortGroup.visible = isOkeyType && !this.mobileHandDockActive;
    if (this.cardQuickSortGroup) this.cardQuickSortGroup.visible = !isOkeyType && !this.mobileHandDockActive;

    this.opponentHandGroups.forEach(g => g.visible = !isOkeyType);
    this.opponentIstakaGroups.forEach(g => g.visible = isOkeyType);
    this.setFeaturePermissions(this.featurePermissions);
    this.applyResponsiveCamera();
    this.resetSceneObjects();
  }

  resetSceneObjects() {
    // Clear player cards
    while (this.playerHandGroup.children.length > 0) {
      this.playerHandGroup.remove(this.playerHandGroup.children.pop());
    }

    // Clear player istaka tiles (keep rack body child 0 and static slot targets child 1)
    while (this.playerIstakaGroup.children.length > 2) {
      this.playerIstakaGroup.remove(this.playerIstakaGroup.children[2]);
    }
    if (this.slotHighlightMesh) this.slotHighlightMesh.visible = false;

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
    // Ergonomic close VR distance (~70cm from eyes instead of 1.26m)
    this.vrButtonsGroup.position.set(0, 1.02, 0.18);
    this.scene.add(this.vrButtonsGroup);
  }

  clearVRButtons() {
    while (this.vrButtonsGroup.children.length > 0) {
      const ch = this.vrButtonsGroup.children.pop();
      this.vrButtonsGroup.remove(ch);
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) {
        if (ch.material.map) ch.material.map.dispose();
        ch.material.dispose();
      }
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

  showBatakRoundEndButtonsInVR(nextRound, totalRounds, canStartNext, onNextRound, onLeaveGame) {
    this.clearVRButtons();
    if (canStartNext) {
      this.create3DButton(`▶️ ${nextRound}/${totalRounds}. Tur`, -0.14, 0.05, 0, 0.22, 0.065, '#059669', () => {
        soundFx.playButtonClick();
        this.clearVRButtons();
        if (onNextRound) onNextRound();
      });
    }
    this.create3DButton('🚪 Oyundan Ayrıl', canStartNext ? 0.14 : 0, 0.05, 0, 0.22, 0.065, '#dc2626', () => {
      soundFx.playButtonClick();
      this.clearVRButtons();
      if (onLeaveGame) onLeaveGame();
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
    const reticleGeo = new THREE.RingGeometry(0.005, 0.011, 20);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: false
    });

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      this.cameraRig.add(controller);
      this.controllers.push(controller);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -2.0)
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.65 });
      const laserLine = new THREE.Line(lineGeo, lineMat);
      controller.add(laserLine);

      // Glowing 3D Laser Hit Reticle Dot
      const reticle = new THREE.Mesh(reticleGeo, reticleMat);
      reticle.visible = false;
      this.scene.add(reticle);
      this.controllerReticles.push(reticle);

      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.cameraRig.add(grip);
      this.controllerGrips.push(grip);

      controller.addEventListener('selectstart', () => {
        soundFx.unlockAudio();
        this.onVRSelectStart(controller);
      });
      controller.addEventListener('selectend', () => {
        this.onVRSelectEnd(controller);
      });
    }

    // Direct WebXR Hand Tracking (Meta Quest / Hand Tracking)
    this.hands = [];
    try {
      const handModelFactory = new XRHandModelFactory();
      for (let i = 0; i < 2; i++) {
        const hand = this.renderer.xr.getHand(i);
        hand.add(handModelFactory.createHandModel(hand, 'mesh'));
        this.cameraRig.add(hand);
        this.hands.push(hand);

        hand.addEventListener('pinchstart', () => {
          soundFx.unlockAudio();
          this.onVRSelectStart(hand);
        });
        hand.addEventListener('pinchend', () => {
          this.onVRSelectEnd(hand);
        });
      }
    } catch (err) {
      console.warn('WebXR Hand Tracking factory fallback:', err);
    }
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

  _collectActiveButtons() {
    this._tempBtnList.length = 0;
    const sources = [this.interactive3DButtons, this.permanentInteractiveButtons];
    for (const arr of sources) {
      if (!arr) continue;
      for (const b of arr) {
        let vis = true;
        let cur = b;
        while (cur) {
          if (cur.visible === false) {
            vis = false;
            break;
          }
          cur = cur.parent;
        }
        if (vis) this._tempBtnList.push(b);
      }
    }
    return this._tempBtnList;
  }

  _setRayFromController(controller, raycaster = this.raycaster) {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
  }

  _tryClickAtRay(raycaster, controller = null) {
    const allButtons = this._collectActiveButtons();
    if (allButtons.length > 0) {
      const btnIntersects = raycaster.intersectObjects(allButtons, false);
      if (btnIntersects.length > 0) {
        if (controller) this.triggerHaptic(controller, 0.4, 25);
        btnIntersects[0].object.userData.onClick();
        return true;
      }
    }

    const isOkeyType = this.activeGameType === 'OKEY' || this.activeGameType === 'OKEY101';
    if (!isOkeyType) {
      const cardMeshes = this.playerHandGroup.children.filter(c => c.userData && c.userData.isCard);
      const intersects = raycaster.intersectObjects(cardMeshes, false);
      if (intersects.length > 0 && this.onCardSelectedCallback) {
        const hitCard = intersects[0].object;
        if (hitCard.userData?.card) {
          if (controller) this.triggerHaptic(controller, 0.65, 40);
          this.onCardSelectedCallback(hitCard.userData.card);
          return true;
        }
      }
      if (this.cayciAvatar) {
        const cayciHits = raycaster.intersectObject(this.cayciAvatar, true);
        if (cayciHits.length > 0) {
          if (controller) this.triggerHaptic(controller, 0.5, 30);
          this.summonCayciForTea();
          return true;
        }
      }
      return false;
    }

    // Okey / 101: Tile click, empty Istaka slot click, Left Discard (Yandan Al), or Center Stack
    const tileMeshes = this.playerIstakaGroup.children.filter(t => t.userData && t.userData.isOkeyTile);
    const tileHits = raycaster.intersectObjects(tileMeshes, false);
    if (tileHits.length > 0 && this.onTileSelectedCallback) {
      const hitTile = tileHits[0].object;
      if (hitTile.userData?.tile) {
        if (controller) this.triggerHaptic(controller, 0.7, 40);
        this.onTileSelectedCallback(hitTile.userData.tile);
        return true;
      }
    }

    // If an Istaka tile is currently selected and user clicks an empty Istaka slot -> move tile there!
    if (this.selectedTileIndex >= 0 && this.istakaSlotHits.length > 0) {
      const slotHits = raycaster.intersectObjects(this.istakaSlotHits, false);
      if (slotHits.length > 0 && this.onTileDropToSlotCallback) {
        const { tier, slot } = slotHits[0].object.userData;
        if (controller) this.triggerHaptic(controller, 0.45, 25);
        this.onTileDropToSlotCallback(null, tier, slot);
        return true;
      }
    }

    // Left opponent discard pile (Seat 3 -> Yandan Al)
    if (this.discardGroups[3]) {
      const discardHits = raycaster.intersectObjects(this.discardGroups[3].children, true);
      if (discardHits.length > 0 && this.onDrawDiscardCallback) {
        if (controller) this.triggerHaptic(controller, 0.65, 35);
        this.onDrawDiscardCallback();
        return true;
      }
    }

    // Self discard tray (Seat 0 -> click to discard currently selected tile)
    if (this.discardGroups[0] && this.selectedTileIndex >= 0) {
      const selfHits = raycaster.intersectObjects(this.discardGroups[0].children, true);
      if (selfHits.length > 0 && this.onTileDropToDiscardCallback) {
        if (controller) this.triggerHaptic(controller, 0.7, 40);
        this.onTileDropToDiscardCallback(null);
        return true;
      }
    }

    // Center draw stack
    const centerHits = raycaster.intersectObjects(this.tableCenterGroup.children, true);
    if (centerHits.length > 0 && this.onCenterStackClickCallback) {
      if (controller) this.triggerHaptic(controller, 0.5, 30);
      this.onCenterStackClickCallback();
      return true;
    }

    // Walking Çaycı Hüseyin interaction (click/laser on him to order fresh tea!)
    if (this.cayciAvatar) {
      const cayciHits = raycaster.intersectObject(this.cayciAvatar, true);
      if (cayciHits.length > 0) {
        if (controller) this.triggerHaptic(controller, 0.5, 30);
        this.summonCayciForTea();
        return true;
      }
    }

    return false;
  }

  _beginDragAtRay(raycaster, source, controller = null, clientX = 0, clientY = 0) {
    // Buttons take immediate priority on click, do not drag over UI buttons
    const allButtons = this._collectActiveButtons();
    if (allButtons.length > 0 && raycaster.intersectObjects(allButtons, false).length > 0) {
      return false;
    }

    const isOkeyType = this.activeGameType === 'OKEY' || this.activeGameType === 'OKEY101';
    if (isOkeyType) {
      const tileMeshes = this.playerIstakaGroup.children.filter(t => t.userData && t.userData.isOkeyTile);
      const hits = raycaster.intersectObjects(tileMeshes, false);
      if (hits.length === 0) return false;
      const mesh = hits[0].object;

      // Drag plane parallel to slanted Istaka face
      const normal = new THREE.Vector3(0, 0.92, 0.38).normalize();
      const origin = new THREE.Vector3();
      mesh.getWorldPosition(origin);
      this._dragPlane.setFromNormalAndCoplanarPoint(normal, origin);

      this.dragState.active = true;
      this.dragState.dragging = false;
      this.dragState.kind = 'tile';
      this.dragState.source = source;
      this.dragState.controller = controller;
      this.dragState.mesh = mesh;
      this.dragState.data = mesh.userData.tile;
      this.dragState.startClientX = clientX;
      this.dragState.startClientY = clientY;
      this.dragState.startWorldPos.copy(hits[0].point);
      this.dragState.targetTier = mesh.userData.tier;
      this.dragState.targetSlot = mesh.userData.slot;
      this.dragState.overDiscard = false;
      return true;
    } else {
      const cardMeshes = this.playerHandGroup.children.filter(c => c.userData && c.userData.isCard);
      const hits = raycaster.intersectObjects(cardMeshes, false);
      if (hits.length === 0) return false;
      const mesh = hits[0].object;

      const normal = new THREE.Vector3(0, 0.48, 0.88).normalize();
      const origin = new THREE.Vector3();
      mesh.getWorldPosition(origin);
      this._dragPlane.setFromNormalAndCoplanarPoint(normal, origin);

      this.dragState.active = true;
      this.dragState.dragging = false;
      this.dragState.kind = 'card';
      this.dragState.source = source;
      this.dragState.controller = controller;
      this.dragState.mesh = mesh;
      this.dragState.data = mesh.userData.card;
      this.dragState.startClientX = clientX;
      this.dragState.startClientY = clientY;
      this.dragState.startWorldPos.copy(hits[0].point);
      this.dragState.targetCardIndex = cardMeshes.indexOf(mesh);
      this.dragState.overPlayZone = false;
      return true;
    }
  }

  _updateDragAtRay(raycaster, clientX = 0, clientY = 0) {
    const ds = this.dragState;
    if (!ds.active || !ds.mesh) return;

    const hitPlane = raycaster.ray.intersectPlane(this._dragPlane, this._dragIntersect);
    if (!ds.dragging) {
      if (ds.source === 'desktop') {
        const dx = clientX - ds.startClientX;
        const dy = clientY - ds.startClientY;
        const deadzoneSq = ds.isTouch ? 144 : 64;
        if (dx * dx + dy * dy < deadzoneSq) return; // < deadzone still a tap/click
      } else if (hitPlane) {
        if (this._dragIntersect.distanceTo(ds.startWorldPos) < 0.022) return;
      } else {
        return;
      }
      ds.dragging = true;
      if (ds.source === 'vr' && ds.controller) {
        this.triggerHaptic(ds.controller, 0.35, 18);
      }
      if (ds.kind === 'tile') {
        soundFx.playOkeyStoneClack(0.28, 0);
      }
    }

    if (!hitPlane) return;

    if (ds.kind === 'tile') {
      // Check if dragged over own Discard Tray (Seat 0)
      let overDiscard = false;
      if (this.discardGroups[0]) {
        const dPos = this._tempVec3;
        this.discardGroups[0].getWorldPosition(dPos);
        const dist = Math.hypot(this._dragIntersect.x - dPos.x, this._dragIntersect.z - dPos.z);
        if (dist < 0.16) overDiscard = true;
      }
      ds.overDiscard = overDiscard;
      if (this.selfDiscardDropRing) {
        this.selfDiscardDropRing.visible = overDiscard;
      }

      // Position dragged tile visually floating under pointer/ray
      this._dragLocalPos.copy(this._dragIntersect);
      this.playerIstakaGroup.worldToLocal(this._dragLocalPos);
      ds.mesh.position.set(this._dragLocalPos.x, this._dragLocalPos.y + 0.032, this._dragLocalPos.z - 0.015);
      ds.mesh.scale.set(1.12, 1.12, 1.12);

      if (!overDiscard) {
        // Snap target preview to nearest of 30 Istaka slots (15 × 2)
        const tier = this._dragLocalPos.y >= 0.068 ? 0 : 1;
        const slotSpacing = ISTAKA_SLOT_SPACING;
        const rawSlot = Math.round(this._dragLocalPos.x / slotSpacing + (ISTAKA_SLOTS_PER_TIER - 1) / 2);
        const slot = Math.max(0, Math.min(ISTAKA_SLOTS_PER_TIER - 1, rawSlot));

        ds.targetTier = tier;
        ds.targetSlot = slot;

        if (this.slotHighlightMesh) {
          this.slotHighlightMesh.visible = true;
          const hx = (slot - (ISTAKA_SLOTS_PER_TIER - 1) / 2) * slotSpacing;
          const { y: hy, z: hz } = ISTAKA_TIER_COORDS[tier];
          this.slotHighlightMesh.position.set(hx, hy, hz + 0.004);
        }
      } else if (this.slotHighlightMesh) {
        this.slotHighlightMesh.visible = false;
      }
    } else if (ds.kind === 'card') {
      this._dragLocalPos.copy(this._dragIntersect);
      this.playerHandGroup.worldToLocal(this._dragLocalPos);
      ds.mesh.position.set(this._dragLocalPos.x, this._dragLocalPos.y + 0.035, this._dragLocalPos.z - 0.02);
      ds.mesh.scale.set(1.1, 1.1, 1.1);

      // Dragged upward/forward past hand -> play onto table!
      ds.overPlayZone = this._dragLocalPos.y > 0.095 || this._dragLocalPos.z < -0.10;
      const cards = this.playerHandGroup.children.filter(c => c.userData?.isCard);
      const count = cards.length;
      if (count > 1) {
        const maxSpan = 0.72;
        const spacing = Math.min(0.058, maxSpan / (count - 1));
        const rawIdx = Math.round(this._dragLocalPos.x / spacing + (count - 1) / 2);
        ds.targetCardIndex = Math.max(0, Math.min(count - 1, rawIdx));
      }
    }
  }

  _finishDragOrClick(raycaster, controller = null) {
    const ds = this.dragState;
    const wasActive = ds.active;
    const wasDragging = ds.dragging;
    const kind = ds.kind;
    const data = ds.data;
    const targetTier = ds.targetTier;
    const targetSlot = ds.targetSlot;
    const overDiscard = ds.overDiscard;
    const targetCardIndex = ds.targetCardIndex;
    const overPlayZone = ds.overPlayZone;

    ds.active = false;
    ds.dragging = false;
    ds.mesh = null;
    ds.controller = null;
    if (this.slotHighlightMesh) this.slotHighlightMesh.visible = false;
    if (this.selfDiscardDropRing) this.selfDiscardDropRing.visible = false;

    if (wasActive && wasDragging) {
      if (kind === 'tile') {
        if (overDiscard && this.onTileDropToDiscardCallback) {
          if (controller) this.triggerHaptic(controller, 0.85, 50);
          this.onTileDropToDiscardCallback(data);
        } else if (this.onTileDropToSlotCallback) {
          if (controller) this.triggerHaptic(controller, 0.5, 25);
          this.onTileDropToSlotCallback(data, targetTier, targetSlot);
        }
      } else if (kind === 'card') {
        if (overPlayZone && this.onCardSelectedCallback) {
          if (controller) this.triggerHaptic(controller, 0.75, 45);
          this.onCardSelectedCallback(data);
        } else if (this.onCardReorderCallback) {
          if (controller) this.triggerHaptic(controller, 0.4, 20);
          this.onCardReorderCallback(data, targetCardIndex);
        }
      }
      return;
    }

    // Simple click / tap
    this._tryClickAtRay(raycaster, controller);
  }

  onVRSelectStart(controller) {
    this._setRayFromController(controller, this.raycaster);
    this._beginDragAtRay(this.raycaster, 'vr', controller);
  }

  onVRSelectEnd(controller) {
    this._setRayFromController(controller, this.raycaster);
    if (this.dragState.active && this.dragState.source === 'vr' && this.dragState.controller === controller) {
      this._finishDragOrClick(this.raycaster, controller);
    } else if (!this.dragState.active) {
      this._tryClickAtRay(this.raycaster, controller);
    }
  }

  updateHoverAtRay(raycaster, reticle = null, controller = null) {
    let hovered = null;
    let hitPoint = null;

    const allButtons = this._collectActiveButtons();
    if (allButtons.length > 0) {
      const hits = raycaster.intersectObjects(allButtons, false);
      if (hits.length > 0) {
        hovered = hits[0].object;
        hitPoint = hits[0].point;
      }
    }

    if (!hovered) {
      const isOkeyType = this.activeGameType === 'OKEY' || this.activeGameType === 'OKEY101';
      if (!isOkeyType) {
        const cardMeshes = this.playerHandGroup.children.filter(c => c.userData?.isCard);
        const hits = raycaster.intersectObjects(cardMeshes, false);
        if (hits.length > 0) {
          hovered = hits[0].object;
          hitPoint = hits[0].point;
        }
      } else {
        const tileMeshes = this.playerIstakaGroup.children.filter(t => t.userData?.isOkeyTile);
        const hits = raycaster.intersectObjects(tileMeshes, false);
        if (hits.length > 0) {
          hovered = hits[0].object;
          hitPoint = hits[0].point;
        } else if (this.discardGroups[3]) {
          const dHits = raycaster.intersectObjects(this.discardGroups[3].children, true);
          if (dHits.length > 0) {
            hovered = this.discardGroups[3];
            hitPoint = dHits[0].point;
          }
        }
        if (!hovered) {
          const cHits = raycaster.intersectObjects(this.tableCenterGroup.children, true);
          if (cHits.length > 0) {
            hovered = this.tableCenterGroup;
            hitPoint = cHits[0].point;
          }
        }
      }
    }

    if (reticle) {
      if (hitPoint) {
        reticle.visible = true;
        reticle.position.copy(hitPoint);
        reticle.position.addScaledVector(raycaster.ray.direction, -0.008);
        reticle.lookAt(raycaster.ray.origin);
      } else {
        reticle.visible = false;
      }
    }

    if (this._lastHoveredObj !== hovered) {
      // Reset previous card hover lift cleanly
      if (this._lastHoveredObj && this._lastHoveredObj.userData?.isCard && this._lastHoveredObj !== this.dragState.mesh) {
        const ud = this._lastHoveredObj.userData;
        if (ud.baseY !== undefined) this._lastHoveredObj.position.y = ud.baseY;
        if (ud.baseZ !== undefined) this._lastHoveredObj.position.z = ud.baseZ;
        if (ud.baseScale !== undefined) this._lastHoveredObj.scale.setScalar(ud.baseScale);
      }
      this._lastHoveredObj = hovered;
      if (hovered && controller) {
        this.triggerHaptic(controller, 0.14, 12);
      }
    }

    // Smooth hover lift on card under pointer/laser
    if (hovered && hovered.userData?.isCard && hovered !== this.dragState.mesh) {
      const ud = hovered.userData;
      if (ud.baseY !== undefined) {
        hovered.position.y = ud.baseY + 0.028;
        if (ud.baseZ !== undefined) hovered.position.z = ud.baseZ + 0.012;
        hovered.scale.setScalar((ud.baseScale || 1) * 1.06);
      }
    }

    if (!this.isVRActive) {
      document.body.style.cursor = hovered ? (this.dragState.dragging ? 'grabbing' : 'pointer') : 'default';
    }
  }

  setupDesktopInteractions() {
    window.addEventListener('pointermove', (e) => {
      if (this.isVRActive) return;
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.desktopRaycaster.setFromCamera(this.mouse, this.camera);

      if (this.dragState.active && this.dragState.source === 'desktop') {
        this._updateDragAtRay(this.desktopRaycaster, e.clientX, e.clientY);
      } else {
        this.updateHoverAtRay(this.desktopRaycaster, null, null);
      }
    });

    window.addEventListener('pointerdown', (e) => {
      if (this.isVRActive || e.button !== 0) return;
      // Ignore clicks on 2D UI overlay elements
      if (e.target && e.target !== this.renderer.domElement) return;

      soundFx.unlockAudio();
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.desktopRaycaster.setFromCamera(this.mouse, this.camera);

      this.dragState.isTouch = e.pointerType === 'touch';
      this._beginDragAtRay(this.desktopRaycaster, 'desktop', null, e.clientX, e.clientY);
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isVRActive || e.button !== 0) return;
      if (e.target && e.target !== this.renderer.domElement && !this.dragState.active) return;

      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.desktopRaycaster.setFromCamera(this.mouse, this.camera);

      this._finishDragOrClick(this.desktopRaycaster, null);
    });

    window.addEventListener('pointercancel', () => {
      if (this.dragState.active && this.dragState.source === 'desktop') {
        this.dragState.active = false;
        this.dragState.dragging = false;
        this.dragState.mesh = null;
        this.dragState.controller = null;
        this.dragState.isTouch = false;
        if (this.slotHighlightMesh) this.slotHighlightMesh.visible = false;
        if (this.selfDiscardDropRing) this.selfDiscardDropRing.visible = false;
      }
    });
  }

  createFloatingNameBadge(name, color = '#10b981', icon = '👤', subText = '') {
    const cacheKey = `${name}|${color}|${icon}|${subText}`;
    if (!this._sharedBadgeGeo) {
      this._sharedBadgeGeo = new THREE.PlaneGeometry(0.14, 0.042);
    }
    let mat = this.nameBadgeCache.get(cacheKey);
    if (!mat) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 76;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createLinearGradient(0, 0, 256, 76);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(4, 4, 248, 68, 20);
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(36, 38, 20, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, 36, 38);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 24px "Outfit", "Segoe UI", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const displayTitle = name.length > 12 ? name.substring(0, 11) + '…' : name;
      ctx.fillText(displayTitle, 66, subText ? 26 : 38);

      if (subText) {
        ctx.fillStyle = color;
        ctx.font = 'bold 17px "Outfit", "Segoe UI", sans-serif';
        ctx.fillText(subText, 66, 52);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
      this.nameBadgeCache.set(cacheKey, mat);
    }

    return new THREE.Mesh(this._sharedBadgeGeo, mat);
  }

  // --- CARDS RENDERING ---
  _addCardShadowPlane(parent, x, y, z, rotZ = 0, scale = 1.0) {
    if (!this._sharedCardShadowGeo) {
      this._sharedCardShadowGeo = new THREE.PlaneGeometry(0.115, 0.162);
      this._sharedCardShadowMat = new THREE.MeshBasicMaterial({
        color: 0x041d10,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      });
    }
    const shadow = new THREE.Mesh(this._sharedCardShadowGeo, this._sharedCardShadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.rotation.z = rotZ;
    shadow.position.set(x, y, z);
    shadow.scale.setScalar(scale);
    parent.add(shadow);
  }

  renderPlayerHand(handCards, playableCardIds = null, recommendedCardId = null) {
    while (this.playerHandGroup.children.length > 0) this.playerHandGroup.remove(this.playerHandGroup.children.pop());
    const total = handCards?.length || 0;
    if (total === 0) return;

    // Ergonomic arched handheld fan: Every card's top-left index is clearly readable
    const maxSpan = 0.72;
    const spacing = total > 1 ? Math.min(0.058, maxSpan / (total - 1)) : 0;

    handCards.forEach((card, idx) => {
      const isPlayable = !playableCardIds || playableCardIds.includes(card.id);
      const isRecommended = Boolean(recommendedCardId && card.id === recommendedCardId);
      const isSelected = this.selectedCardId === card.id;

      const mesh = createCard3DMesh(card, isRecommended, !isPlayable);

      const x = total > 1 ? (idx - (total - 1) / 2) * spacing : 0;
      const normX = total > 1 ? (idx - (total - 1) / 2) / ((total - 1) / 2) : 0; // -1 to +1

      // Natural circular handheld fan curvature + left-to-right forward depth order
      let y = -Math.pow(normX, 2) * 0.026;
      let z = Math.pow(normX, 2) * 0.040 + idx * 0.0024;

      let scaleVal = isPlayable ? 1.0 : 0.94;
      if (isRecommended || isSelected) {
        y += 0.028;
        z += 0.016;
        scaleVal = 1.08;
      } else if (!isPlayable) {
        y -= 0.014;
      }
      mesh.scale.set(scaleVal, scaleVal, scaleVal);

      mesh.position.set(x, y, z);

      // Single clean upright tilt directly facing eye level
      mesh.rotation.x = -0.50;
      mesh.rotation.y = -normX * 0.16;
      mesh.rotation.z = -normX * 0.13;

      mesh.userData = {
        card,
        isCard: true,
        isRecommended,
        isSelected,
        isPlayable,
        baseY: y,
        baseZ: z,
        baseScale: scaleVal
      };

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
      const spacing = 0.026;
      const startX = -((count - 1) * spacing) / 2;

      for (let i = 0; i < count; i++) {
        const dummyCard = { rank: 'A', suit: 'S', isRed: false };
        const mesh = createCard3DMesh(dummyCard);
        const norm = count > 1 ? (i - (count - 1) / 2) / ((count - 1) / 2) : 0;
        // Raised upright fan facing inward so opponent backs stay visible without table clipping
        mesh.position.set(startX + i * spacing, -Math.pow(norm, 2) * 0.012, norm * 0.025 + i * 0.0008);
        mesh.rotation.x = 0.22;
        mesh.rotation.z = -norm * 0.10;
        oppGroup.add(mesh);
      }
    }
  }

  renderTableCards(tableCards) {
    while (this.tableCenterGroup.children.length > 0) this.tableCenterGroup.remove(this.tableCenterGroup.children.pop());
    if (!tableCards || tableCards.length === 0) return;

    const defaultNames = ['Siz', 'Hasan Dayı', 'Hayrettin', 'Serdar'];
    const seatPillColors = ['#10b981', '#f59e0b', '#3b82f6', '#a855f7'];

    // Check if these cards belong to a trick (e.g. Batak where playerIndex or seat is attached)
    const isTrick = tableCards.some(tc => (tc && (tc.playerIndex !== undefined || tc.seat !== undefined)));

    if (isTrick) {
      // 4 quadrants laid flat on emerald felt — zero table clipping!
      const seatLayouts = {
        0: { x: 0, z: 0.18, yaw: 0.02 },
        1: { x: 0.21, z: 0.0, yaw: -0.06 },
        2: { x: 0, z: -0.18, yaw: -0.03 },
        3: { x: -0.21, z: 0.0, yaw: 0.06 }
      };

      tableCards.forEach((tc, idx) => {
        const card = tc.card || tc;
        const seat = tc.playerIndex !== undefined ? tc.playerIndex : (tc.seat !== undefined ? tc.seat : idx % 4);
        const layout = seatLayouts[seat] || seatLayouts[idx % 4];
        const cardY = 0.002 + idx * 0.0028;

        this._addCardShadowPlane(this.tableCenterGroup, layout.x, 0.0008 + idx * 0.0028, layout.z, layout.yaw, 1.0);

        const cardMesh = createCard3DMesh(card);
        cardMesh.scale.set(1.28, 1.28, 1.28);
        cardMesh.position.set(layout.x, cardY, layout.z);
        cardMesh.rotation.set(-Math.PI / 2, 0, layout.yaw);
        this.tableCenterGroup.add(cardMesh);

        // Floating 3D Player Name Badge cleanly hovering behind/above each card
        const pName = (seat === 0) ? 'Siz' : (this.tablePlayers?.[seat]?.name || defaultNames[seat]);
        const badge = this.createFloatingNameBadge(pName, seatPillColors[seat] || '#3b82f6');
        badge.position.set(layout.x, 0.048, layout.z - 0.095);
        badge.rotation.x = -0.55;
        this.tableCenterGroup.add(badge);
      });
    } else {
      // Stacked table layout (e.g. Pişti) flat on felt
      const total = tableCards.length;
      tableCards.forEach((tc, idx) => {
        const card = tc.card || tc;
        const isFaceUp = tc.faceUp !== undefined ? tc.faceUp : true;
        const isTopCard = idx === total - 1;
        const cardMesh = createCard3DMesh(card);
        const cardY = 0.002 + idx * 0.0022;

        if (isTopCard) {
          this._addCardShadowPlane(this.tableCenterGroup, 0, 0.0009 + idx * 0.0022, 0.02, 0, 1.0);
          cardMesh.scale.set(1.28, 1.28, 1.28);
          cardMesh.position.set(0, cardY, 0.02);
          cardMesh.rotation.set(isFaceUp ? -Math.PI / 2 : Math.PI / 2, 0, 0);

          if (tc.playerIndex !== undefined) {
            const pName = (tc.playerIndex === 0) ? 'Siz' : (this.tablePlayers?.[tc.playerIndex]?.name || defaultNames[tc.playerIndex]);
            const badge = this.createFloatingNameBadge(pName, seatPillColors[tc.playerIndex] || '#10b981');
            badge.position.set(0, 0.052, -0.10);
            badge.rotation.x = -0.55;
            this.tableCenterGroup.add(badge);
          }
        } else {
          const offsetAngle = idx * 0.25 - 0.35;
          cardMesh.position.set(Math.sin(offsetAngle) * 0.028, cardY, Math.cos(offsetAngle) * 0.018 - 0.02);
          cardMesh.rotation.set(isFaceUp ? -Math.PI / 2 : Math.PI / 2, 0, offsetAngle * 0.35);
        }

        this.tableCenterGroup.add(cardMesh);
      });
    }
  }

  animateCardPlay(card, fromSeat, targetTablePos, onComplete) {
    soundFx.playCardDeal();
    const flyingMesh = createCard3DMesh(card);
    let startPos = new THREE.Vector3();

    if (fromSeat === 0) {
      startPos.set(0, 0.98, 0.48);
    } else {
      this.opponentHandGroups[fromSeat - 1].getWorldPosition(startPos);
      startPos.y += 0.06;
    }

    flyingMesh.position.copy(startPos);
    this.scene.add(flyingMesh);

    // Designated quadrant positions lying flat on emerald felt
    const quadrantOffsets = {
      0: new THREE.Vector3(0, 0.835, 0.18),
      1: new THREE.Vector3(0.21, 0.835, 0),
      2: new THREE.Vector3(0, 0.835, -0.18),
      3: new THREE.Vector3(-0.21, 0.835, 0)
    };

    const targetPos = targetTablePos || quadrantOffsets[fromSeat] || new THREE.Vector3(0, 0.835, 0);
    const duration = 420;
    const startTime = performance.now();

    const animObj = {
      update: (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1.0, elapsed / duration);
        const ease = 1 - Math.pow(1 - progress, 3);

        flyingMesh.position.lerpVectors(startPos, targetPos, ease);
        flyingMesh.position.y += Math.sin(progress * Math.PI) * 0.14;
        flyingMesh.rotation.x = THREE.MathUtils.lerp(-0.4, -Math.PI / 2, ease);

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
  renderPlayerIstaka(handTiles, recommendedIndex = -1, allowAutoSort = false) {
    while (this.playerIstakaGroup.children.length > 2) {
      this.playerIstakaGroup.remove(this.playerIstakaGroup.children[2]);
    }
    if (!handTiles || handTiles.length === 0) return;

    if (allowAutoSort) {
      arrangeHandTilesOnIstaka(handTiles, false);
    } else {
      assignRawIstakaSlots(handTiles);
    }

    const slotSpacing = ISTAKA_SLOT_SPACING;

    handTiles.forEach((tile, idx) => {
      const isSelected = this.selectedTileIndex === idx;
      const isRecommended = recommendedIndex === idx;
      const mesh = createOkeyTile3DMesh(tile, isSelected, isRecommended);

      const tier = tile._istakaTier === 0 ? 0 : 1;
      const slot = typeof tile._istakaSlot === 'number'
        ? Math.max(0, Math.min(ISTAKA_SLOTS_PER_TIER - 1, tile._istakaSlot))
        : (idx % ISTAKA_SLOTS_PER_TIER);

      const x = (slot - (ISTAKA_SLOTS_PER_TIER - 1) / 2) * slotSpacing;

      const coords = ISTAKA_TIER_COORDS[tier];
      let y = coords.y;
      let z = coords.z;

      if (isSelected) {
        y += 0.020;
        z += 0.012;
      } else if (isRecommended) {
        y += 0.012;
        z += 0.008;
      }

      mesh.position.set(x, y, z);
      // Parallel to Istaka backboard so full beveled face + dimple show cleanly
      mesh.rotation.x = 0;

      mesh.userData = {
        tile,
        tileIndex: idx,
        isOkeyTile: true,
        tier,
        slot,
        baseY: coords.y,
        baseZ: coords.z
      };

      this.playerIstakaGroup.add(mesh);
    });
  }

  renderOpponentIstakas(players) {
    for (let seat = 1; seat < 4; seat++) {
      const oppIstaka = this.opponentIstakaGroups[seat - 1];
      while (oppIstaka.children.length > 1) oppIstaka.remove(oppIstaka.children[1]);

      const p = players[seat];
      if (!p || !p.hand) continue;

      // Opponents' racks face the opponents - from table center & player's view,
      // only the authentic wooden backboard and dark end caps are shown (exactly as in the reference photograph)
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

    // Generous invisible collider for effortless VR center-stack drawing
    if (!this._centerHitGeo) {
      this._centerHitGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.07, 16);
      this._centerHitMat = new THREE.MeshBasicMaterial({ visible: false });
    }
    const centerHit = new THREE.Mesh(this._centerHitGeo, this._centerHitMat);
    centerHit.position.set(0, 0.03, 0);
    this.tableCenterGroup.add(centerHit);
  }

  renderOkeyDiscards(discardPiles, canDrawLeft = false) {
    const defaultNames = ['Siz', 'Hasan Dayı', 'Hayrettin', 'Serdar'];
    const seatPillColors = ['#10b981', '#f59e0b', '#3b82f6', '#a855f7'];

    if (!this._sharedTrayGeo) {
      this._sharedTrayGeo = new THREE.BoxGeometry(0.125, 0.008, 0.155);
      this._sharedTrayMat = new THREE.MeshStandardMaterial({ color: 0x1c1008, roughness: 0.45, metalness: 0.15 });
      this._sharedTrayBorderGeo = new THREE.BoxGeometry(0.130, 0.004, 0.160);
      this._sharedTrayBrassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.75, roughness: 0.3 });
      this._sharedDiscardHitGeo = new THREE.BoxGeometry(0.16, 0.09, 0.19);
      this._sharedDiscardHitMat = new THREE.MeshBasicMaterial({ visible: false });
      this._sharedDropRingGeo = new THREE.RingGeometry(0.075, 0.092, 24);
      this._sharedDropRingMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
    }

    discardPiles.forEach((pile, seat) => {
      const dg = this.discardGroups[seat];
      while (dg.children.length > 0) dg.remove(dg.children.pop());

      // 1. Shared Coaster Tray with Brass Rim
      const trayMesh = new THREE.Mesh(this._sharedTrayGeo, this._sharedTrayMat);
      trayMesh.receiveShadow = true;
      dg.add(trayMesh);

      const borderMesh = new THREE.Mesh(this._sharedTrayBorderGeo, this._sharedTrayBrassMat);
      borderMesh.position.set(0, -0.002, 0);
      dg.add(borderMesh);

      // Padded invisible hit target for easy VR discard grab (Seat 3) or drop (Seat 0)
      if (seat === 0 || seat === 3) {
        const hitBox = new THREE.Mesh(this._sharedDiscardHitGeo, this._sharedDiscardHitMat);
        hitBox.position.set(0, 0.04, 0);
        dg.add(hitBox);
      }

      if (seat === 0) {
        this.selfDiscardDropRing = new THREE.Mesh(this._sharedDropRingGeo, this._sharedDropRingMat);
        this.selfDiscardDropRing.rotation.x = -Math.PI / 2;
        this.selfDiscardDropRing.position.set(0, 0.012, 0);
        this.selfDiscardDropRing.visible = false;
        dg.add(this.selfDiscardDropRing);
      }

      // 2. Player Name Badge above discard tray
      const pName = (seat === 0) ? 'Siz' : (this.tablePlayers?.[seat]?.name || defaultNames[seat]);
      const isLeftPlayer = (seat === 3);
      const sub = (isLeftPlayer && canDrawLeft) ? '📥 Yandan Al' : '';
      const badge = this.createFloatingNameBadge(
        pName,
        isLeftPlayer && canDrawLeft ? '#22c55e' : (seatPillColors[seat] || '#3b82f6'),
        '👤',
        sub
      );
      badge.position.set(0, 0.078, -0.06);
      badge.rotation.x = -Math.PI / 4;
      dg.add(badge);

      if (!pile || pile.length === 0) return;

      // 3. Render discarded tiles
      const topTile = pile[pile.length - 1];
      const previousTiles = pile.slice(-4, -1);

      // Older tiles lie flat underneath
      previousTiles.forEach((tile, i) => {
        const mesh = createOkeyTile3DMesh(tile);
        mesh.position.set((i - 1) * 0.008, 0.006 + i * 0.003, -0.02 + i * 0.008);
        mesh.rotation.x = -Math.PI / 2;
        mesh.scale.set(0.92, 0.92, 0.92);
        dg.add(mesh);
      });

      // The TOP tile is upright, prominently angled, and enlarged
      const isHighlightLeft = isLeftPlayer && canDrawLeft;
      const topMesh = createOkeyTile3DMesh(topTile, isHighlightLeft, isHighlightLeft);
      topMesh.scale.set(1.22, 1.22, 1.22);
      topMesh.position.set(0, 0.022, 0.015);
      topMesh.rotation.x = -Math.PI / 3.2; // Tilted upright facing the players!
      topMesh.userData.isDiscardTop = true;
      topMesh.userData.seat = seat;
      topMesh.userData.tile = topTile;
      dg.add(topMesh);
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
    this.applyResponsiveCamera();
    this.renderer.setSize(this.width, this.height);
  }

  render(time) {
    // 0. VR Seated Auto-Calibration, Reticle Hover, Trigger Drag & Thumbstick Navigation
    if (this.isVRActive) {
      const xrCam = this.renderer.xr.getCamera();
      if (!this.hasCalibratedVRSeat && xrCam && (xrCam.position.y > 0.3 || Math.abs(xrCam.position.z) > 0.04)) {
        this.recenterToChair();
        this.hasCalibratedVRSeat = true;
      }
      this.handleVRThumbstickNavigation();

      // Active controller drag or hover laser reticle feedback
      if (this.dragState.active && this.dragState.source === 'vr' && this.dragState.controller) {
        this._setRayFromController(this.dragState.controller, this.raycaster);
        this._updateDragAtRay(this.raycaster);
      } else {
        for (let i = 0; i < this.controllers.length; i++) {
          const ctrl = this.controllers[i];
          const reticle = this.controllerReticles[i];
          if (ctrl && ctrl.visible) {
            this._setRayFromController(ctrl, this.raycaster);
            this.updateHoverAtRay(this.raycaster, reticle, ctrl);
          } else if (reticle) {
            reticle.visible = false;
          }
        }
      }

      spatialVoice.updateListenerFromCamera(xrCam || this.camera);
    } else {
      spatialVoice.updateListenerFromCamera(this.camera);
    }

    // 1. Run card / tile animations
    for (let i = this.animatingMeshes.length - 1; i >= 0; i--) {
      const finished = this.animatingMeshes[i].update(time);
      if (finished) this.animatingMeshes.splice(i, 1);
    }

    // 2. Animate Kıraathane Human Characters (Breathing, Blinking Eyes, Lip Sync & Glances)
    const now = performance.now();
    const t = (time || 0) * 0.001;
    const animateChar = (char, speechSeatIdx = -1) => {
      if (char.userData && char.userData.head) {
        const offset = char.userData.animOffset || 0;
        char.position.y = Math.sin(t * 1.6 + offset) * 0.004;
        char.userData.head.rotation.y = Math.sin(t * 0.55 + offset) * 0.16 + Math.sin(t * 1.3 + offset * 2) * 0.05;
        char.userData.head.rotation.x = Math.sin(t * 0.8 + offset) * 0.04 + 0.08;
        char.userData.head.rotation.z = Math.sin(t * 0.4 + offset) * 0.032;

        // Natural Eyelid Blink every ~3.8 seconds
        if (char.userData.eyelids) {
          const blinkCycle = (t + offset) % 3.8;
          const lidRot = blinkCycle > 3.64 ? 0.05 : -0.78;
          for (let e = 0; e < char.userData.eyelids.length; e++) {
            char.userData.eyelids[e].rotation.x = lidRot;
          }
        }

        // Subtle mouth motion when player in this seat is speaking
        if (char.userData.mouth && speechSeatIdx >= 0) {
          const ind = this.speechIndicators.get(speechSeatIdx);
          if (ind && ind.visible) {
            char.userData.mouth.scale.set(1, 1 + Math.abs(Math.sin(t * 14)) * 0.4, 1);
          } else {
            char.userData.mouth.scale.set(1, 1, 1);
          }
        }
      }
    };
    for (let i = 0; i < this.opponentAvatars.length; i++) animateChar(this.opponentAvatars[i], i + 1);
    for (let i = 0; i < this.backgroundAvatars.length; i++) animateChar(this.backgroundAvatars[i], -1);

    // 2b. Animate Walking Çaycı Hüseyin Patrol & Tea Tray
    this.updateWalkingCayci(now);

    // 3. Animate rising tea steam
    if (this.steamPoints) {
      const pos = this.steamPoints.geometry.attributes.position.array;
      for (let i = 1; i < pos.length; i += 3) {
        pos[i] += 0.0006;
        if (pos[i] > 0.16) pos[i] = 0.07;
      }
      this.steamPoints.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
