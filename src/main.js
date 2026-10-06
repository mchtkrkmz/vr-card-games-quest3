import confetti from 'canvas-confetti';
import { VRCardScene, KIRAATHANE_THEMES } from './vr/scene.js';
import { BatakGameEngine } from './engine/rules/batak.js';
import { PistiGameEngine } from './engine/rules/pisti.js';
import { OkeyGameEngine } from './engine/okey/okeyEngine.js';
import { Okey101GameEngine } from './engine/okey/okey101Engine.js';
import { soundFx } from './engine/audio.js';
import { SUITS } from './engine/cards.js';
import { aiAdvisor } from './engine/aiAdvisor.js';
import { networkManager } from './engine/network.js';
import { AVAILABLE_AVATARS } from './vr/avatars.js';
import { spatialVoice } from './engine/voiceChat.js';
import { userDb } from './engine/db/userDatabase.js';

class AppManager {
  constructor() {
    this.scene = null;
    this.currentGameType = 'BATAK'; // 'BATAK', 'PISTI', 'OKEY', 'OKEY101'
    this.gameEngine = null;
    this.aiEnabled = true;
    this.currentAdvice = null;

    // Multiplayer State
    this.selectedCreateAvatar = 'dayi';
    this.selectedJoinAvatar = 'hayrettin';
    this.selectedCreateGame = 'BATAK';
    this.selectedCreateCount = 4;

    // DOM Elements
    this.dom = {
      container: document.getElementById('canvas-container'),
      hudGameName: document.getElementById('hud-game-name'),
      hudTrump: document.getElementById('hud-trump'),
      trumpContainer: document.getElementById('trump-info-container'),
      trumpInfoLabel: document.getElementById('trump-info-label'),
      hudStatus: document.getElementById('hud-status'),
      gameLogBox: document.getElementById('game-log-box'),
      actionPanel: document.getElementById('action-panel'),
      actionTitle: document.getElementById('action-title'),
      actionButtonsContainer: document.getElementById('action-buttons-container'),
      btnMenu: document.getElementById('btn-menu'),
      btnMultiplayer: document.getElementById('btn-multiplayer'),
      btnThemeModal: document.getElementById('btn-theme-modal'),
      themeModal: document.getElementById('theme-modal'),
      btnCloseThemeModal: document.getElementById('btn-close-theme-modal'),
      themeGridContainer: document.getElementById('theme-grid-container'),
      btnAmbiance: document.getElementById('btn-ambiance'),
      ambianceIcon: document.getElementById('ambiance-icon'),
      btnSound: document.getElementById('btn-sound'),
      soundIcon: document.getElementById('sound-icon'),
      btnToggleAI: document.getElementById('btn-toggle-ai'),
      aiToggleLabel: document.getElementById('ai-toggle-label'),
      aiCoachPanel: document.getElementById('ai-coach-panel'),
      aiCoachContent: document.getElementById('ai-coach-content'),
      btnApplyAI: document.getElementById('btn-apply-ai'),
      btnNewHand: document.getElementById('btn-new-hand'),
      menuModal: document.getElementById('menu-modal'),
      btnCloseMenu: document.getElementById('btn-close-menu'),
      optBatak: document.getElementById('opt-batak'),
      optOkey101: document.getElementById('opt-okey101'),
      optOkey: document.getElementById('opt-okey'),
      optPisti: document.getElementById('opt-pisti'),
      btnStartGame: document.getElementById('btn-start-game'),
      okeyRackControls: document.getElementById('okey-rack-controls'),
      batakControls: document.getElementById('batak-card-controls'),
      btnSortCards: document.getElementById('btn-sort-cards'),
      btnAISort: document.getElementById('btn-ai-sort'),
      btnSortRuns: document.getElementById('btn-sort-runs'),
      btnSortPairs: document.getElementById('btn-sort-pairs'),

      // Multiplayer Elements
      multiplayerModal: document.getElementById('multiplayer-modal'),
      tabCreateRoom: document.getElementById('tab-create-room'),
      tabJoinRoom: document.getElementById('tab-join-room'),
      viewCreateRoom: document.getElementById('view-create-room'),
      viewJoinRoom: document.getElementById('view-join-room'),
      inputCreateName: document.getElementById('input-create-name'),
      inputCreatePassword: document.getElementById('input-create-password'),
      avatarPickerCreate: document.getElementById('avatar-picker-create'),
      btnSubmitCreateRoom: document.getElementById('btn-submit-create-room'),
      btnCloseMpModal: document.getElementById('btn-close-mp-modal'),
      btnCloseMpModal2: document.getElementById('btn-close-mp-modal-2'),
      inputJoinCode: document.getElementById('input-join-code'),
      inputJoinPassword: document.getElementById('input-join-password'),
      inputJoinName: document.getElementById('input-join-name'),
      avatarPickerJoin: document.getElementById('avatar-picker-join'),
      btnSubmitJoinRoom: document.getElementById('btn-submit-join-room'),

      // Lobby Modal Elements
      lobbyModal: document.getElementById('lobby-modal'),
      lobbyCodeDisplay: document.getElementById('lobby-code-display'),
      btnCopyCode: document.getElementById('btn-copy-code'),
      lobbyGameTag: document.getElementById('lobby-game-tag'),
      lobbyPlayersGrid: document.getElementById('lobby-players-grid'),
      btnLobbyStartGame: document.getElementById('btn-lobby-start-game'),
      btnLobbyLeave: document.getElementById('btn-lobby-leave'),

      // Voice & PWA Controls
      btnVoice: document.getElementById('btn-voice'),
      voiceIcon: document.getElementById('voice-icon'),
      voiceLabel: document.getElementById('voice-label'),
      btnInstallPwa: document.getElementById('btn-install-pwa'),

      // User Profile & VIP Auth Elements
      btnProfile: document.getElementById('btn-profile'),
      profileIcon: document.getElementById('profile-icon'),
      profileLabel: document.getElementById('profile-label'),
      authModal: document.getElementById('auth-modal'),
      btnCloseAuthModal: document.getElementById('btn-close-auth-modal'),
      authLoggedInView: document.getElementById('auth-logged-in-view'),
      authFormsContainer: document.getElementById('auth-forms-container'),
      authAvatarIcon: document.getElementById('auth-avatar-icon'),
      authUserName: document.getElementById('auth-user-name'),
      authUserEmailDisplay: document.getElementById('auth-user-email-display'),
      authVipBadge: document.getElementById('auth-vip-badge'),
      authRegularBadge: document.getElementById('auth-regular-badge'),
      btnAuthLogout: document.getElementById('btn-auth-logout'),
      tabAuthLogin: document.getElementById('tab-auth-login'),
      tabAuthRegister: document.getElementById('tab-auth-register'),
      viewAuthLogin: document.getElementById('view-auth-login'),
      viewAuthRegister: document.getElementById('view-auth-register'),
      inputLoginEmail: document.getElementById('input-login-email'),
      inputLoginPassword: document.getElementById('input-login-password'),
      btnLoginSubmit: document.getElementById('btn-login-submit'),
      inputRegName: document.getElementById('input-reg-name'),
      inputRegEmail: document.getElementById('input-reg-email'),
      inputRegPassword: document.getElementById('input-reg-password'),
      btnRegSubmit: document.getElementById('btn-reg-submit'),
      authMsg: document.getElementById('auth-msg')
    };

    this.currentUser = JSON.parse(localStorage.getItem('vr_kiraathane_active_user') || 'null');
    if (!localStorage.getItem('vr_registered_users')) {
      const defaultUsers = [
        { name: 'Mücahit Korkmaz', email: 'mchtkrkmz@gmail.com', password: '123' }
      ];
      localStorage.setItem('vr_registered_users', JSON.stringify(defaultUsers));
    }

    this.selectedTileIndex = -1;
    this.init();
  }

  init() {
    this.scene = new VRCardScene(this.dom.container);
    this.scene.onCardSelectedCallback = this.handleUserCardSelected.bind(this);
    this.scene.onTileSelectedCallback = this.handleUserTileSelected.bind(this);
    this.scene.onCenterStackClickCallback = this.handleCenterStackClick.bind(this);
    this.scene.onSortAiCallback = () => this.sortHandAI();
    this.scene.onSortRunsCallback = () => this.sortHandRuns();
    this.scene.onSortPairsCallback = () => this.sortHandPairs();
    this.scene.onSortCardsCallback = () => this.sortBatakCards();
    this.scene.onDrawDiscardCallback = () => {
      if (this.gameEngine && typeof this.gameEngine.drawFromDiscard === 'function') {
        this.gameEngine.drawFromDiscard(0);
        this.hideActionPanel();
      }
    };
    this.scene.onAiAdviceClickCallback = () => {
      this.applyAIRecommendation();
    };

    this.renderAvatarPickers();
    this.renderThemeSelector();
    this.updateVIPState();
    this.setupUIEventListeners();
    this.setupMultiplayerListeners();
    this.startBatakGame();
  }

  renderThemeSelector() {
    if (!this.dom.themeGridContainer) return;
    this.dom.themeGridContainer.innerHTML = '';

    const currentThemeId = this.scene ? this.scene.currentThemeId : 'balat';

    KIRAATHANE_THEMES.forEach(theme => {
      const card = document.createElement('div');
      const isActive = (theme.id === currentThemeId);
      card.className = `theme-card ${isActive ? 'active' : ''}`;
      card.innerHTML = `
        <div class="theme-card-img-wrapper">
          <img src="${theme.image}" class="theme-card-img" alt="${theme.name}" />
          <span class="theme-card-badge">${theme.badge}</span>
        </div>
        <div class="theme-card-content">
          <div class="theme-card-title">${theme.name}</div>
          <div class="theme-card-location">📍 ${theme.location}</div>
          <div class="theme-card-desc">${theme.desc}</div>
        </div>
      `;

      card.onclick = () => {
        soundFx.playButtonClick();
        if (this.scene) {
          this.scene.setKiraathaneEnvironment(theme.id);
        }
        this.renderThemeSelector();
        this.dom.themeModal.classList.add('hidden');
        this.appendLog(`🌆 Mekan Değiştirildi: ${theme.name}`);
      };

      this.dom.themeGridContainer.appendChild(card);
    });
  }

  renderAvatarPickers() {
    const createPicker = (container, isCreate = true) => {
      if (!container) return;
      container.innerHTML = '';
      AVAILABLE_AVATARS.forEach(av => {
        const card = document.createElement('div');
        const isSelected = isCreate ? (av.id === this.selectedCreateAvatar) : (av.id === this.selectedJoinAvatar);
        card.className = `avatar-card ${isSelected ? 'selected' : ''}`;
        const imgHtml = av.image 
          ? `<img src="${av.image}" class="avatar-photo-thumb" alt="${av.name}" />`
          : `<div class="avatar-icon">${av.icon}</div>`;
        card.innerHTML = `
          <div class="avatar-visual-wrapper">${imgHtml}</div>
          <div class="avatar-info">
            <span class="avatar-name">${av.name}</span>
            <span class="avatar-role">${av.role}</span>
          </div>
        `;
        card.onclick = () => {
          soundFx.playButtonClick();
          if (isCreate) {
            this.selectedCreateAvatar = av.id;
          } else {
            this.selectedJoinAvatar = av.id;
          }
          createPicker(container, isCreate);
        };
        container.appendChild(card);
      });
    };

    createPicker(this.dom.avatarPickerCreate, true);
    createPicker(this.dom.avatarPickerJoin, false);
  }

  setupUIEventListeners() {
    // Theme Modal Listeners
    if (this.dom.btnThemeModal) {
      this.dom.btnThemeModal.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.renderThemeSelector();
        this.dom.themeModal.classList.remove('hidden');
      });
    }

    if (this.dom.btnCloseThemeModal) {
      this.dom.btnCloseThemeModal.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.dom.themeModal.classList.add('hidden');
      });
    }

    // User Profile / VIP Auth Modal Listeners
    if (this.dom.btnProfile) {
      this.dom.btnProfile.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.openAuthModal();
      });
    }

    if (this.dom.btnCloseAuthModal) {
      this.dom.btnCloseAuthModal.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.dom.authModal.classList.add('hidden');
      });
    }

    // Auth Tab Switchers
    if (this.dom.tabAuthLogin) {
      this.dom.tabAuthLogin.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.dom.tabAuthLogin.classList.add('active');
        this.dom.tabAuthRegister.classList.remove('active');
        this.dom.viewAuthLogin.classList.remove('hidden');
        this.dom.viewAuthRegister.classList.add('hidden');
        if (this.dom.authMsg) this.dom.authMsg.style.display = 'none';
      });
    }

    if (this.dom.tabAuthRegister) {
      this.dom.tabAuthRegister.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.dom.tabAuthRegister.classList.add('active');
        this.dom.tabAuthLogin.classList.remove('active');
        this.dom.viewAuthRegister.classList.remove('hidden');
        this.dom.viewAuthLogin.classList.add('hidden');
        if (this.dom.authMsg) this.dom.authMsg.style.display = 'none';
      });
    }

    // Login Submit
    if (this.dom.btnLoginSubmit) {
      this.dom.btnLoginSubmit.addEventListener('click', async () => {
        soundFx.playButtonClick();
        const email = (this.dom.inputLoginEmail.value || '').trim();
        const pass = (this.dom.inputLoginPassword.value || '').trim();

        if (!email || !email.includes('@')) {
          this.showAuthMsg('Lütfen geçerli bir e-posta adresi girin.', 'error');
          return;
        }

        try {
          this.dom.btnLoginSubmit.textContent = 'Doğrulanıyor...';
          const user = await userDb.loginUser(email, pass);
          this.currentUser = user;
          this.updateVIPState();

          if (this.isVIPUser()) {
            this.showAuthMsg('👑 Mücahit Korkmaz doğrulandı! VIP Yapay Zeka Koçu aktif edildi.', 'success');
          } else {
            this.showAuthMsg(`Hoş geldiniz ${user.name}! Giriş başarılı.`, 'success');
          }

          setTimeout(() => {
            this.dom.authModal.classList.add('hidden');
            this.updateAIAdvisor();
          }, 1100);
        } catch (err) {
          this.showAuthMsg(err.message || 'Giriş başarısız oldu.', 'error');
        } finally {
          this.dom.btnLoginSubmit.textContent = '🔐 Giriş Yap';
        }
      });
    }

    // Register Submit
    if (this.dom.btnRegSubmit) {
      this.dom.btnRegSubmit.addEventListener('click', async () => {
        soundFx.playButtonClick();
        const name = (this.dom.inputRegName.value || '').trim();
        const email = (this.dom.inputRegEmail.value || '').trim();
        const pass = (this.dom.inputRegPassword.value || '').trim();

        if (!name) {
          this.showAuthMsg('Lütfen adınızı ve soyadınızı girin.', 'error');
          return;
        }
        if (!email || !email.includes('@')) {
          this.showAuthMsg('Lütfen geçerli bir e-posta adresi girin.', 'error');
          return;
        }
        if (pass.length < 3) {
          this.showAuthMsg('Şifre en az 3 karakter olmalıdır.', 'error');
          return;
        }

        try {
          this.dom.btnRegSubmit.textContent = 'Kaydediliyor...';
          const user = await userDb.registerUser(name, email, pass, 'kasketli');
          this.currentUser = user;
          this.updateVIPState();

          if (this.isVIPUser()) {
            this.showAuthMsg('👑 Mücahit Korkmaz üyeliği veritabanına kaydedildi! VIP AI Asistanı aktif.', 'success');
          } else {
            this.showAuthMsg(`✨ Tebrikler ${name}! Üyeliğiniz veritabanına kaydedildi ve giriş yapıldı.`, 'success');
          }

          setTimeout(() => {
            this.dom.authModal.classList.add('hidden');
            this.updateAIAdvisor();
          }, 1100);
        } catch (err) {
          this.showAuthMsg(err.message || 'Kayıt başarısız oldu.', 'error');
        } finally {
          this.dom.btnRegSubmit.textContent = '✨ Üyeliği Oluştur ve Başla';
        }
      });
    }

    // Logout
    if (this.dom.btnAuthLogout) {
      this.dom.btnAuthLogout.addEventListener('click', () => {
        soundFx.playButtonClick();
        userDb.clearSession();
        this.currentUser = null;
        this.updateVIPState();
        this.openAuthModal();
      });
    }

    // AI Assistant Toggle (VIP Master only)
    if (this.dom.btnToggleAI) {
      this.dom.btnToggleAI.addEventListener('click', () => {
        if (!this.isVIPUser()) return;
        soundFx.playButtonClick();
        this.aiEnabled = !this.aiEnabled;
        this.dom.btnToggleAI.classList.toggle('active', this.aiEnabled);
        this.dom.aiToggleLabel.textContent = this.aiEnabled ? 'AI Asistan' : 'AI Kapalı';
        if (this.dom.aiCoachPanel) {
          this.dom.aiCoachPanel.style.display = this.aiEnabled ? 'block' : 'none';
        }
        this.updateAIAdvisor();
      });
    }

    // AI Apply Recommendation
    if (this.dom.btnApplyAI) {
      this.dom.btnApplyAI.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.applyAIRecommendation();
      });
    }

    // AI Auto-Arrange Istaka
    if (this.dom.btnAISort) {
      this.dom.btnAISort.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.sortHandAI();
      });
    }

    // Tile Sorting Buttons
    if (this.dom.btnSortRuns) {
      this.dom.btnSortRuns.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.sortHandRuns();
      });
    }
    if (this.dom.btnSortPairs) {
      this.dom.btnSortPairs.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.sortHandPairs();
      });
    }

    // Batak Card Sorting Button
    if (this.dom.btnSortCards) {
      this.dom.btnSortCards.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.sortBatakCards();
      });
    }

    // Single Player Menu Modal
    this.dom.btnMenu.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.dom.menuModal.classList.remove('hidden');
    });

    this.dom.btnCloseMenu.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.dom.menuModal.classList.add('hidden');
    });

    const selectOption = (type, el) => {
      soundFx.playButtonClick();
      this.currentGameType = type;
      [this.dom.optBatak, this.dom.optOkey101, this.dom.optOkey, this.dom.optPisti].forEach(btn => btn?.classList.remove('selected'));
      el.classList.add('selected');
    };

    this.dom.optBatak.addEventListener('click', () => selectOption('BATAK', this.dom.optBatak));
    this.dom.optOkey101.addEventListener('click', () => selectOption('OKEY101', this.dom.optOkey101));
    this.dom.optOkey.addEventListener('click', () => selectOption('OKEY', this.dom.optOkey));
    this.dom.optPisti.addEventListener('click', () => selectOption('PISTI', this.dom.optPisti));

    this.dom.btnStartGame.addEventListener('click', () => {
      soundFx.playButtonClick();
      networkManager.disconnect();
      this.dom.menuModal.classList.add('hidden');
      this.startActiveGameMode();
    });

    // Multiplayer Modal Toggles (Requires Membership)
    if (this.dom.btnMultiplayer) {
      this.dom.btnMultiplayer.addEventListener('click', () => {
        soundFx.playButtonClick();
        if (!this.currentUser) {
          this.openAuthModal('🌐 Çok oyunculu odalara katılabilmek ve oda kurabilmek için lütfen önce üye girişi yapın veya yeni üyelik oluşturun.');
          return;
        }
        if (this.dom.inputCreateName && !this.dom.inputCreateName.value) {
          this.dom.inputCreateName.value = this.currentUser.name || '';
        }
        if (this.dom.inputJoinName && !this.dom.inputJoinName.value) {
          this.dom.inputJoinName.value = this.currentUser.name || '';
        }
        this.dom.multiplayerModal.classList.remove('hidden');
      });
    }

    const closeMpModal = () => {
      soundFx.playButtonClick();
      this.dom.multiplayerModal.classList.add('hidden');
    };
    if (this.dom.btnCloseMpModal) this.dom.btnCloseMpModal.addEventListener('click', closeMpModal);
    if (this.dom.btnCloseMpModal2) this.dom.btnCloseMpModal2.addEventListener('click', closeMpModal);

    // Tab Switchers in Multiplayer
    if (this.dom.tabCreateRoom && this.dom.tabJoinRoom) {
      this.dom.tabCreateRoom.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.dom.tabCreateRoom.classList.add('active');
        this.dom.tabJoinRoom.classList.remove('active');
        this.dom.viewCreateRoom.classList.remove('hidden');
        this.dom.viewJoinRoom.classList.add('hidden');
      });

      this.dom.tabJoinRoom.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.dom.tabJoinRoom.classList.add('active');
        this.dom.tabCreateRoom.classList.remove('active');
        this.dom.viewJoinRoom.classList.remove('hidden');
        this.dom.viewCreateRoom.classList.add('hidden');
      });
    }

    // 3D Spatial Voice Chat Mic Toggle (Requires Membership)
    if (this.dom.btnVoice) {
      this.dom.btnVoice.addEventListener('click', async () => {
        soundFx.playButtonClick();
        if (!this.currentUser) {
          this.openAuthModal('🎙️ 3D Mekansal Sesli Sohbet özelliğini kullanabilmek için lütfen önce üye girişi yapın veya yeni üyelik oluşturun.');
          return;
        }
        if (!spatialVoice.isVoiceActive) {
          const success = await spatialVoice.initVoiceChat();
          if (success) {
            this.dom.btnVoice.classList.add('active');
            if (this.dom.voiceIcon) this.dom.voiceIcon.textContent = '🎤';
            if (this.dom.voiceLabel) this.dom.voiceLabel.textContent = 'Açık';
            this.appendLog('🎙️ 3D Mekansal Sesli Sohbet bağlandı! Masadakiler sesini duyabilir.');
          } else {
            alert('Mikrofon erişimi sağlanamadı. Lütfen tarayıcı mikrofon iznini kontrol edin.');
          }
        } else {
          const isMuted = spatialVoice.toggleMute();
          if (isMuted) {
            this.dom.btnVoice.classList.remove('active');
            if (this.dom.voiceIcon) this.dom.voiceIcon.textContent = '🔇';
            if (this.dom.voiceLabel) this.dom.voiceLabel.textContent = 'Sessiz';
          } else {
            this.dom.btnVoice.classList.add('active');
            if (this.dom.voiceIcon) this.dom.voiceIcon.textContent = '🎤';
            if (this.dom.voiceLabel) this.dom.voiceLabel.textContent = 'Açık';
          }
        }
      });
    }

    // PWA Service Worker & Install Handler
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
          console.warn('PWA Service Worker fallback:', err);
        });
      });
    }

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (this.dom.btnInstallPwa) {
        this.dom.btnInstallPwa.style.display = 'inline-flex';
      }
    });

    if (this.dom.btnInstallPwa) {
      this.dom.btnInstallPwa.addEventListener('click', async () => {
        soundFx.playButtonClick();
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            this.dom.btnInstallPwa.style.display = 'none';
          }
          deferredPrompt = null;
        }
      });
    }

    // Multiplayer Game Selectors
    document.querySelectorAll('.mp-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFx.playButtonClick();
        document.querySelectorAll('.mp-choice-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedCreateGame = btn.dataset.game;
      });
    });

    // Multiplayer Player Count Selectors (2, 3, 4)
    document.querySelectorAll('.mp-count-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        soundFx.playButtonClick();
        document.querySelectorAll('.mp-count-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedCreateCount = parseInt(btn.dataset.count, 10);
      });
    });

    // Submit Create Room
    if (this.dom.btnSubmitCreateRoom) {
      this.dom.btnSubmitCreateRoom.addEventListener('click', async () => {
        soundFx.playButtonClick();
        const playerName = this.dom.inputCreateName.value || 'Masa Sahibi';
        const password = this.dom.inputCreatePassword.value || '';
        try {
          this.dom.btnSubmitCreateRoom.textContent = 'Oda Kuruluyor...';
          await networkManager.createRoom({
            gameType: this.selectedCreateGame,
            maxPlayers: this.selectedCreateCount,
            password,
            playerName,
            avatarId: this.selectedCreateAvatar
          });
          this.dom.multiplayerModal.classList.add('hidden');
          this.showLobbyModal();
        } catch (err) {
          alert(`Oda oluşturulamadı: ${err.message}`);
        } finally {
          this.dom.btnSubmitCreateRoom.textContent = '🚀 Odayı Oluştur';
        }
      });
    }

    // Submit Join Room
    if (this.dom.btnSubmitJoinRoom) {
      this.dom.btnSubmitJoinRoom.addEventListener('click', async () => {
        soundFx.playButtonClick();
        const roomCode = this.dom.inputJoinCode.value.trim();
        const password = this.dom.inputJoinPassword.value.trim();
        const playerName = this.dom.inputJoinName.value.trim() || 'Misafir';

        if (!roomCode) {
          alert('Lütfen 4 haneli oda kodunu girin!');
          return;
        }

        try {
          this.dom.btnSubmitJoinRoom.textContent = 'Bağlanılıyor...';
          await networkManager.joinRoom({
            roomCode,
            password,
            playerName,
            avatarId: this.selectedJoinAvatar
          });
          this.dom.multiplayerModal.classList.add('hidden');
          this.showLobbyModal();
        } catch (err) {
          alert(`Odaya bağlanılamadı: ${err.message}`);
        } finally {
          this.dom.btnSubmitJoinRoom.textContent = '🔗 Odaya Bağlan';
        }
      });
    }

    // Copy Room Code
    if (this.dom.btnCopyCode) {
      this.dom.btnCopyCode.addEventListener('click', () => {
        soundFx.playButtonClick();
        if (networkManager.roomCode) {
          navigator.clipboard.writeText(networkManager.roomCode);
          this.dom.btnCopyCode.textContent = 'Kopyalandı!';
          setTimeout(() => {
            this.dom.btnCopyCode.textContent = 'Kopyala';
          }, 1500);
        }
      });
    }

    // Lobby Start Game (Host only)
    if (this.dom.btnLobbyStartGame) {
      this.dom.btnLobbyStartGame.addEventListener('click', () => {
        soundFx.playButtonClick();
        this.dom.lobbyModal.classList.add('hidden');
        this.currentGameType = networkManager.gameType;
        networkManager.broadcast({ type: 'START_GAME', gameType: networkManager.gameType });
        this.startActiveGameMode();
      });
    }

    // Lobby Leave
    if (this.dom.btnLobbyLeave) {
      this.dom.btnLobbyLeave.addEventListener('click', () => {
        soundFx.playButtonClick();
        networkManager.disconnect();
        this.dom.lobbyModal.classList.add('hidden');
        this.appendLog('Odadan ayrıldınız.');
      });
    }

    // Ambiance audio toggle
    this.dom.btnAmbiance.addEventListener('click', () => {
      const nextState = !soundFx.ambianceEnabled;
      soundFx.setAmbiance(nextState);
      this.dom.ambianceIcon.textContent = nextState ? '☕' : '🔇';
      soundFx.playButtonClick();
      this.appendLog(nextState ? 'Kıraathane çay ve zar sesleri açıldı.' : 'Kıraathane sesleri kapatıldı.');
    });

    // Sound toggle
    this.dom.btnSound.addEventListener('click', () => {
      soundFx.enabled = !soundFx.enabled;
      this.dom.soundIcon.textContent = soundFx.enabled ? '🔊' : '🔇';
      soundFx.playButtonClick();
    });

    // New Hand button
    this.dom.btnNewHand.addEventListener('click', () => {
      soundFx.playButtonClick();
      if (this.gameEngine) {
        this.gameEngine.startNewRound();
      }
    });
  }

  setupMultiplayerListeners() {
    networkManager.onEvent((event, data) => {
      if (event === 'player_joined') {
        soundFx.playCardDeal();
        this.appendLog(`🎉 ${data.name} masaya oturdu!`);
        this.renderLobbySlots();
      } else if (event === 'player_disconnected') {
        this.appendLog(`⚠️ Bir oyuncu masadan ayrıldı.`);
        this.renderLobbySlots();
      } else if (event === 'room_updated') {
        this.renderLobbySlots();
      } else if (event === 'game_started_by_host') {
        this.dom.lobbyModal.classList.add('hidden');
        this.currentGameType = data.gameType || networkManager.gameType;
        this.startActiveGameMode();
      }
    });
  }

  showLobbyModal() {
    this.dom.lobbyModal.classList.remove('hidden');
    this.dom.lobbyCodeDisplay.textContent = networkManager.roomCode;
    const gameTitles = { BATAK: 'İhaleli Batak', OKEY101: '101 Okey', OKEY: 'Klasik Okey', PISTI: 'Pişti' };
    this.dom.lobbyGameTag.textContent = `${gameTitles[networkManager.gameType] || networkManager.gameType} • ${networkManager.maxPlayers} Kişilik`;

    if (!networkManager.isHost) {
      this.dom.btnLobbyStartGame.style.display = 'none';
    } else {
      this.dom.btnLobbyStartGame.style.display = 'inline-flex';
    }

    this.renderLobbySlots();
  }

  renderLobbySlots() {
    if (!this.dom.lobbyPlayersGrid) return;
    this.dom.lobbyPlayersGrid.innerHTML = '';

    const max = networkManager.maxPlayers || 4;
    const players = networkManager.roomPlayers || [];

    for (let s = 0; s < max; s++) {
      const p = players.find(player => player.seat === s);
      const slot = document.createElement('div');

      if (p) {
        const avObj = AVAILABLE_AVATARS.find(a => a.id === p.avatarId) || AVAILABLE_AVATARS[0];
        slot.className = 'lobby-player-slot occupied';
        slot.innerHTML = `
          <div class="slot-avatar">${avObj.icon}</div>
          <div class="slot-details">
            <span class="slot-name">${p.name} ${p.isHost ? '⭐ (Kurucu)' : ''}</span>
            <span class="slot-status">✓ Hazır (${avObj.name})</span>
          </div>
        `;
      } else {
        slot.className = 'lobby-player-slot empty';
        slot.innerHTML = `
          <div class="slot-avatar">🤖</div>
          <div class="slot-details">
            <span class="slot-name">Koltuk ${s + 1} (Boş)</span>
            <span class="slot-status slot-bot-tag">Otomatik Bot Eklenecek</span>
          </div>
        `;
      }
      this.dom.lobbyPlayersGrid.appendChild(slot);
    }
  }

  startActiveGameMode() {
    if (this.currentGameType === 'BATAK') {
      this.startBatakGame();
    } else if (this.currentGameType === 'OKEY101') {
      this.startOkey101Game();
    } else if (this.currentGameType === 'OKEY') {
      this.startOkeyGame();
    } else {
      this.startPistiGame();
    }
  }

  // Get active seated players (syncs multiplayer players + fills remainder with bots)
  getActiveSeatedPlayers(count = 4) {
    const defaultBots = [
      { name: 'Ahmet Dayı', avatarId: 'kasketli' },
      { name: 'Mehmet Abi', avatarId: 'ekoseli' },
      { name: 'Ali Kaptan', avatarId: 'ali' },
      { name: 'Ayşe Hanım', avatarId: 'ayse' }
    ];

    const result = [];
    for (let i = 0; i < count; i++) {
      if (networkManager.isConnected && networkManager.roomPlayers) {
        const mpPlayer = networkManager.roomPlayers.find(p => p.seat === i);
        if (mpPlayer) {
          result.push({
            name: mpPlayer.name,
            avatarId: mpPlayer.avatarId,
            isBot: false,
            isLocal: i === networkManager.localPlayerId
          });
          continue;
        }
      }

      if (i === 0) {
        result.push({
          name: this.currentUser?.name || this.dom.inputCreateName?.value || 'Siz',
          avatarId: this.selectedCreateAvatar || 'kasketli',
          isBot: false,
          isLocal: true
        });
      } else {
        const bot = defaultBots[(i - 1) % defaultBots.length];
        result.push({
          name: bot.name,
          avatarId: bot.avatarId,
          isBot: true,
          isLocal: false
        });
      }
    }
    return result;
  }

  resetActiveEngine() {
    if (this.gameEngine) {
      this.gameEngine.gameState = 'IDLE';
      this.gameEngine.eventListeners = [];
      this.gameEngine = null;
    }
    this.hideActionPanel();
    if (this.scene) {
      this.scene.resetSceneObjects();
    }
    this.selectedTileIndex = -1;
  }

  // ==========================================
  // SECRET AI ADVISOR & ASSISTANT (VIP MASTER ONLY)
  // ==========================================
  updateAIAdvisor() {
    if (!this.isVIPUser() || !this.aiEnabled || !this.gameEngine) {
      if (this.dom.aiCoachPanel) this.dom.aiCoachPanel.style.display = 'none';
      if (this.scene) {
        if (this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') {
          if (this.gameEngine && this.gameEngine.players && this.gameEngine.players[0]) {
            this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand, -1);
          }
        } else if (this.currentGameType === 'BATAK') {
          if (this.gameEngine && this.gameEngine.players && this.gameEngine.players[0]) {
            const isMyTurn = this.gameEngine.currentTurn === 0;
            const playableCards = (isMyTurn && this.gameEngine.gameState === 'PLAYING')
              ? this.gameEngine.getLegalCards(0).map(c => c.id)
              : null;
            this.scene.renderPlayerHand(this.gameEngine.players[0].hand, playableCards, null);
          }
        } else if (this.currentGameType === 'PISTI') {
          if (this.gameEngine && this.gameEngine.players && this.gameEngine.players[0]) {
            this.scene.renderPlayerHand(this.gameEngine.players[0].hand, null, null);
          }
        }
      }
      return;
    }

    if (this.dom.aiCoachPanel) this.dom.aiCoachPanel.style.display = 'block';

    let advice = null;
    if (this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') {
      advice = aiAdvisor.getOkeyAdvice(this.gameEngine, this.currentGameType === 'OKEY101');
    } else if (this.currentGameType === 'PISTI') {
      advice = aiAdvisor.getPistiAdvice(this.gameEngine);
    } else if (this.currentGameType === 'BATAK') {
      advice = aiAdvisor.getBatakAdvice(this.gameEngine);
    }

    this.currentAdvice = advice;
    if (!advice) {
      if (this.dom.aiCoachContent) {
        this.dom.aiCoachContent.innerHTML = '<div class="ai-coach-tip">Oyun analiz ediliyor...</div>';
      }
      return;
    }

    // Render 2D AI Coach Content
    if (this.dom.aiCoachContent) {
      let html = '';
      if (advice.gameType === 'OKEY' || advice.gameType === 'OKEY101') {
        const { completePers, nearPers, orphanTiles } = advice.analysis;
        html += `<div style="margin-bottom:6px;"><strong>🎯 Istaka Durumu:</strong> ${completePers.length} Hazır Per • ${nearPers.length} Bekleyen Grup • ${orphanTiles.length} Boşta Taş</div>`;

        if (advice.info101) {
          html += `<div style="margin-bottom:6px; color:#38bdf8;"><strong>📊 101 Puanı:</strong> ${advice.info101.perPoints} Puan ${advice.info101.canOpen ? '🌟 <em>(El Açabilirsiniz!)</em>' : `(Gereken: ${advice.info101.pointsLeft})`}</div>`;
        }

        if (advice.drawAdvice && this.gameEngine.turnPhase === 'DRAW' && this.gameEngine.currentTurn === 0) {
          html += `<div style="margin-bottom:6px; color:#22c55e;"><strong>${advice.drawAdvice.title}:</strong> ${advice.drawAdvice.text}</div>`;
        }

        if (advice.bestDiscard && advice.bestDiscard.tile) {
          html += `<div style="color:#fde047;"><strong>💡 Tavsiye Atış:</strong> ${advice.bestDiscard.reason}</div>`;
        }
      } else if (advice.gameType === 'PISTI') {
        html = `<div>${advice.reason}</div>`;
      } else if (advice.gameType === 'BATAK') {
        html = `<div>${advice.reason}</div>`;
      }

      this.dom.aiCoachContent.innerHTML = html;
    }

    // Update 3D Highlights
    if (this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') {
      const recIdx = advice.bestDiscard ? advice.bestDiscard.index : -1;
      this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand, recIdx);
    } else if (this.currentGameType === 'PISTI') {
      const recCardId = advice.recommendedCard ? advice.recommendedCard.id : null;
      this.scene.renderPlayerHand(this.gameEngine.players[0].hand, null, recCardId);
    } else if (this.currentGameType === 'BATAK') {
      const isMyTurn = this.gameEngine.currentTurn === 0;
      const playableCards = (isMyTurn && this.gameEngine.gameState === 'PLAYING')
        ? this.gameEngine.getLegalCards(0).map(c => c.id)
        : null;
      const recCardId = advice.recommendedCard ? advice.recommendedCard.id : null;
      this.scene.renderPlayerHand(this.gameEngine.players[0].hand, playableCards, recCardId);
    }
  }

  applyAIRecommendation() {
    if (!this.currentAdvice || !this.gameEngine) return;

    if (this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') {
      if (this.gameEngine.currentTurn !== 0) return;

      if (this.gameEngine.turnPhase === 'DRAW') {
        if (this.currentAdvice.drawAdvice?.recommendedSource === 'DISCARD') {
          this.gameEngine.drawFromDiscard(0);
        } else {
          this.gameEngine.drawFromStack(0);
        }
        this.hideActionPanel();
      } else if (this.gameEngine.turnPhase === 'DISCARD') {
        if (this.currentAdvice.bestDiscard && this.currentAdvice.bestDiscard.tile) {
          this.gameEngine.discardTile(0, this.currentAdvice.bestDiscard.tile.id);
          this.hideActionPanel();
        }
      }
    } else if (this.currentGameType === 'PISTI') {
      if (this.gameEngine.currentTurn === 0 && this.currentAdvice.recommendedCard) {
        this.gameEngine.playCard(0, this.currentAdvice.recommendedCard.id);
      }
    } else if (this.currentGameType === 'BATAK') {
      if (this.gameEngine.gameState === 'BIDDING' && this.gameEngine.bidTurn === 0) {
        this.gameEngine.submitBid(0, this.currentAdvice.recommendedBid || 0);
        this.hideActionPanel();
      } else if (this.gameEngine.gameState === 'PLAYING' && this.gameEngine.currentTurn === 0) {
        if (this.currentAdvice.recommendedCard) {
          this.gameEngine.playCard(0, this.currentAdvice.recommendedCard.id);
        }
      }
    }
  }

  // --- 101 OKEY INTEGRATION ---
  startOkey101Game() {
    this.resetActiveEngine();
    this.currentGameType = 'OKEY101';
    this.dom.hudGameName.textContent = '101 Okey (Yüzbir)';
    this.dom.trumpContainer.style.display = 'flex';
    this.dom.trumpInfoLabel.textContent = 'Okey';
    this.updateGameControls('OKEY101');

    this.scene.setGameModeView('OKEY101');
    soundFx.playOkeyTilesShuffle();

    const seatedPlayers = this.getActiveSeatedPlayers(4);
    this.scene.updateTableAvatars(seatedPlayers);

    this.gameEngine = new Okey101GameEngine(3);
    this.gameEngine.initPlayers(seatedPlayers.map(p => p.name));

    this.gameEngine.onEvent((event, data) => {
      this.handleOkey101Event(event, data);
    });

    this.gameEngine.startNewMatch();
  }

  renderOkeyDiscardsHelper() {
    if (!this.gameEngine || !this.gameEngine.discardPiles) return;
    const canDrawLeft = (this.gameEngine.currentTurn === 0 && this.gameEngine.turnPhase === 'DRAW' && this.gameEngine.discardPiles[3]?.length > 0);
    this.scene.renderOkeyDiscards(this.gameEngine.discardPiles, canDrawLeft);
  }

  handleOkey101Event(event, data) {
    if (event === 'log') {
      this.appendLog(data.message);
    } else if (event === 'deal_complete') {
      const okey = data.okeyInfo;
      this.dom.hudTrump.innerHTML = `<span style="color:${okey.colorHex}">★ ${okey.colorName} ${okey.number}</span>`;

      this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand);
      this.scene.renderOpponentIstakas(this.gameEngine.players);
      this.scene.renderCenterOkeyStack(data.drawStackCount, data.gosterge);
      this.renderOkeyDiscardsHelper();
      this.scene.render101OpenedPers(this.gameEngine.tableOpenedPers);

      this.updateOkey101HUD('Taşlar Dağıtıldı (21 Taş)');
      soundFx.playOkeyTileClick(1.0);

      if (this.gameEngine.currentTurn === 0) {
        this.updateOkey101HUD('🌟 SIRA SİZDE! İstiyorsanız el açın veya taş atın.');
        this.showOkey101DrawUI(false);
      }
      this.updateAIAdvisor();
    } else if (event === 'tile_drawn') {
      soundFx.playOkeyTileSlide();
      this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand);
      this.scene.renderOpponentIstakas(this.gameEngine.players);
      this.scene.renderCenterOkeyStack(this.gameEngine.drawStack.length, this.gameEngine.gostergeTile);
      this.renderOkeyDiscardsHelper();

      if (data.playerIndex === 0) {
        const { totalPoints } = this.gameEngine.calculateHandPerPoints(this.gameEngine.players[0]);
        const canOpen = !this.gameEngine.players[0].hasOpened && totalPoints >= 101;
        this.updateOkey101HUD(`🌟 Taş çektiniz. Per Puanınız: ${totalPoints} ${canOpen ? '(Açabilirsiniz!)' : ''}`);
        this.showOkey101DiscardUI(canOpen);
      } else {
        this.updateOkey101HUD(`${this.gameEngine.players[data.playerIndex].name} taş çekti.`);
      }
      this.updateAIAdvisor();
    } else if (event === 'hand_opened') {
      soundFx.playTrumpFanfare();
      this.triggerVictoryCelebration(0.5);
      this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand);
      this.scene.render101OpenedPers(this.gameEngine.tableOpenedPers);
      this.updateOkey101HUD(`${this.gameEngine.players[data.playerIndex].name} ELİNİ AÇTI (${data.totalPoints} Puan)!`);
      this.updateAIAdvisor();
    } else if (event === 'tile_discarded') {
      this.scene.animateTileDiscard(data.tile, data.playerIndex, () => {
        this.renderOkeyDiscardsHelper();
      });
      this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand);
      this.scene.renderOpponentIstakas(this.gameEngine.players);
      this.updateAIAdvisor();
    } else if (event === 'turn_changed') {
      this.renderOkeyDiscardsHelper();
      const isMyTurn = data.currentTurn === 0;
      if (isMyTurn) {
        this.updateOkey101HUD('🌟 SIRA SİZDE! Ortadan veya yandan taş çekin.');
        this.showOkey101DrawUI(true);
      } else {
        this.updateOkey101HUD(`${this.gameEngine.players[data.currentTurn].name} düşünüyor...`);
        this.hideActionPanel();
        this.scene.clearVRButtons();
      }
      this.updateAIAdvisor();
    } else if (event === 'round_ended') {
      this.updateOkey101HUD('101 Eli Tamamlandı! Cezalar hesaplandı.');
      this.updateAIAdvisor();
    } else if (event === 'match_winner') {
      this.updateOkey101HUD(`👑 101 ŞAMPİYONU: ${data.winner.name}`);
      soundFx.playOkeyWinSlam();
      this.triggerVictoryCelebration(1.0);
    }
  }

  showOkey101DrawUI(canDraw) {
    const leftDiscard = this.gameEngine.discardPiles[3];
    const canDrawDiscard = leftDiscard.length > 0;
    const topTile = canDrawDiscard ? leftDiscard[leftDiscard.length - 1] : null;

    this.dom.actionTitle.textContent = '101 Okey Hamle Seçin:';
    this.dom.actionButtonsContainer.innerHTML = '';

    if (canDraw) {
      const drawStackBtn = document.createElement('button');
      drawStackBtn.className = 'action-chip';
      drawStackBtn.textContent = '🎲 Ortadan Taş Çek';
      drawStackBtn.onclick = () => {
        this.gameEngine.drawFromStack(0);
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(drawStackBtn);

      if (canDrawDiscard && topTile) {
        const drawDiscardBtn = document.createElement('button');
        drawDiscardBtn.className = 'action-chip';
        drawDiscardBtn.style.background = '#15803d';
        drawDiscardBtn.textContent = `📥 Yandan Al (${topTile.colorName} ${topTile.number || 'Sahte'})`;
        drawDiscardBtn.onclick = () => {
          this.gameEngine.drawFromDiscard(0);
          this.hideActionPanel();
        };
        this.dom.actionButtonsContainer.appendChild(drawDiscardBtn);
      }
    }

    const { totalPoints } = this.gameEngine.calculateHandPerPoints(this.gameEngine.players[0]);
    const canOpen = !this.gameEngine.players[0].hasOpened && totalPoints >= 101;

    if (canOpen) {
      const openHandBtn = document.createElement('button');
      openHandBtn.className = 'action-chip';
      openHandBtn.style.background = '#d97706';
      openHandBtn.textContent = `🌟 Elini Aç (${totalPoints} Puan)`;
      openHandBtn.onclick = () => {
        this.gameEngine.openHand(0);
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(openHandBtn);
    }

    this.dom.actionPanel.classList.add('show');

    this.scene.showOkey101DrawButtonsInVR(
      canDraw,
      canDrawDiscard,
      canOpen,
      () => this.gameEngine.drawFromStack(0),
      () => this.gameEngine.drawFromDiscard(0),
      () => this.gameEngine.openHand(0)
    );
  }

  showOkey101DiscardUI(canOpen) {
    this.dom.actionTitle.textContent = 'Istakadan Atılacak Taşı Seçin:';
    this.dom.actionButtonsContainer.innerHTML = '';

    if (canOpen) {
      const openHandBtn = document.createElement('button');
      openHandBtn.className = 'action-chip';
      openHandBtn.style.background = '#d97706';
      openHandBtn.textContent = '🌟 Elini Aç (101)';
      openHandBtn.onclick = () => {
        this.gameEngine.openHand(0);
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(openHandBtn);
    }

    const sortAiBtn = document.createElement('button');
    sortAiBtn.className = 'action-chip ai-btn';
    sortAiBtn.textContent = '🧠 AI Akıllı Diz';
    sortAiBtn.onclick = () => {
      this.sortHandAI();
    };
    this.dom.actionButtonsContainer.appendChild(sortAiBtn);

    const sortRunsBtn = document.createElement('button');
    sortRunsBtn.className = 'action-chip';
    sortRunsBtn.textContent = '📐 Seri Diz';
    sortRunsBtn.onclick = () => {
      this.sortHandRuns();
    };
    this.dom.actionButtonsContainer.appendChild(sortRunsBtn);

    this.dom.actionPanel.classList.add('show');
  }

  updateOkey101HUD(customStatus = null) {
    const p = this.gameEngine.players;
    const scores = p.map(player => ({
      name: player.name,
      opened: player.hasOpened,
      score: player.totalPenalty
    }));

    const status = customStatus || (this.gameEngine.currentTurn === 0 ? 'Sıra Sizde!' : `${p[this.gameEngine.currentTurn]?.name} Oynuyor`);
    this.dom.hudStatus.textContent = status;

    const advice = this.currentAdvice;
    this.scene.updateHUD({
      title: `101 OKEY (${this.gameEngine.currentHand}/${this.gameEngine.totalHands}. El)`,
      status,
      trump: null,
      okeyTile: this.gameEngine.okeyTileInfo,
      currentTurn: this.gameEngine.currentTurn,
      scores,
      aiAdvice: advice?.bestDiscard ? `Tavsiye: ${advice.bestDiscard.tile.colorName} ${advice.bestDiscard.tile.number} Atın` : (advice?.info101?.tip || null),
      aiDetail: advice?.bestDiscard?.reason || null
    });
  }

  // --- KLASIK OKEY INTEGRATION ---
  startOkeyGame() {
    this.resetActiveEngine();
    this.currentGameType = 'OKEY';
    this.dom.hudGameName.textContent = 'Klasik Okey';
    this.dom.trumpContainer.style.display = 'flex';
    this.dom.trumpInfoLabel.textContent = 'Okey';
    this.updateGameControls('OKEY');

    this.scene.setGameModeView('OKEY');
    soundFx.playOkeyTilesShuffle();

    const seatedPlayers = this.getActiveSeatedPlayers(4);
    this.scene.updateTableAvatars(seatedPlayers);

    this.gameEngine = new OkeyGameEngine('KLASIK', 20);
    this.gameEngine.initPlayers(seatedPlayers.map(p => p.name));

    this.gameEngine.onEvent((event, data) => {
      this.handleOkeyEvent(event, data);
    });

    this.gameEngine.startNewMatch();
  }

  handleOkeyEvent(event, data) {
    if (event === 'log') {
      this.appendLog(data.message);
    } else if (event === 'deal_complete') {
      const okey = data.okeyInfo;
      this.dom.hudTrump.innerHTML = `<span style="color:${okey.colorHex}">★ ${okey.colorName} ${okey.number}</span>`;

      this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand);
      this.scene.renderOpponentIstakas(this.gameEngine.players);
      this.scene.renderCenterOkeyStack(data.drawStackCount, data.gosterge);
      this.renderOkeyDiscardsHelper();

      this.updateOkeyHUD('Taşlar Dağıtıldı');
      soundFx.playOkeyTileClick(1.0);

      if (this.gameEngine.currentTurn === 0) {
        this.updateOkeyHUD('🌟 SIRA SİZDE! Istakanızdan atılacak taşı seçin.');
      }
      this.updateAIAdvisor();
    } else if (event === 'tile_drawn') {
      soundFx.playOkeyTileSlide();
      this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand);
      this.scene.renderOpponentIstakas(this.gameEngine.players);
      this.scene.renderCenterOkeyStack(this.gameEngine.drawStack.length, this.gameEngine.gostergeTile);
      this.renderOkeyDiscardsHelper();

      if (data.playerIndex === 0) {
        this.updateOkeyHUD('🌟 Taş çektiniz. Istakadan atılacak taşı seçin.');
        this.hideActionPanel();
        this.scene.clearVRButtons();
      } else {
        this.updateOkeyHUD(`${this.gameEngine.players[data.playerIndex].name} taş çekti.`);
      }
      this.updateAIAdvisor();
    } else if (event === 'tile_discarded') {
      this.scene.animateTileDiscard(data.tile, data.playerIndex, () => {
        this.renderOkeyDiscardsHelper();
      });
      this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand);
      this.scene.renderOpponentIstakas(this.gameEngine.players);
      this.updateAIAdvisor();
    } else if (event === 'turn_changed') {
      this.renderOkeyDiscardsHelper();
      const isMyTurn = data.currentTurn === 0;
      if (isMyTurn) {
        this.updateOkeyHUD('🌟 SIRA SİZDE! Ortadan veya yandan taş çekin.');
        this.showOkeyDrawUI();
      } else {
        this.updateOkeyHUD(`${this.gameEngine.players[data.currentTurn].name} düşünüyor...`);
        this.hideActionPanel();
        this.scene.clearVRButtons();
      }
      this.updateAIAdvisor();
    } else if (event === 'round_ended') {
      this.updateOkeyHUD('El Tamamlandı!');
      this.updateAIAdvisor();
    } else if (event === 'match_winner') {
      this.updateOkeyHUD(`👑 ŞAMPİYON: ${data.winner.name}`);
      soundFx.playOkeyWinSlam();
      this.triggerVictoryCelebration(1.0);
    }
  }

  showOkeyDrawUI() {
    const leftDiscard = this.gameEngine.discardPiles[3];
    const canDrawDiscard = leftDiscard.length > 0;
    const topTile = canDrawDiscard ? leftDiscard[leftDiscard.length - 1] : null;

    this.dom.actionTitle.textContent = 'Hamle Seçin:';
    this.dom.actionButtonsContainer.innerHTML = '';

    const drawStackBtn = document.createElement('button');
    drawStackBtn.className = 'action-chip';
    drawStackBtn.textContent = '🎲 Ortadan Taş Çek';
    drawStackBtn.onclick = () => {
      this.gameEngine.drawFromStack(0);
      this.hideActionPanel();
    };
    this.dom.actionButtonsContainer.appendChild(drawStackBtn);

    if (canDrawDiscard && topTile) {
      const drawDiscardBtn = document.createElement('button');
      drawDiscardBtn.className = 'action-chip';
      drawDiscardBtn.style.background = '#15803d';
      drawDiscardBtn.textContent = `📥 Yandan Al (${topTile.colorName} ${topTile.number || 'Sahte'})`;
      drawDiscardBtn.onclick = () => {
        this.gameEngine.drawFromDiscard(0);
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(drawDiscardBtn);
    }

    this.dom.actionPanel.classList.add('show');

    this.scene.showOkeyDrawButtonsInVR(
      canDrawDiscard,
      () => this.gameEngine.drawFromStack(0),
      () => this.gameEngine.drawFromDiscard(0)
    );
  }

  // Smart AI Istaka Sorting: Groups complete pers, near pers, and orphans on the right
  sortHandAI() {
    if (!this.gameEngine || !this.gameEngine.players || !this.gameEngine.players[0]) return;
    const player = this.gameEngine.players[0];
    const is101 = this.currentGameType === 'OKEY101';
    const advice = aiAdvisor.getOkeyAdvice(this.gameEngine, is101);
    if (!advice || !advice.analysis) return;

    const { completePers, nearPers, orphanTiles, okeys } = advice.analysis;
    const newHand = [];

    // 1. Okey stones first
    okeys.forEach(t => newHand.push(t));

    // 2. Complete Pers
    completePers.forEach(per => {
      per.tiles.forEach(t => {
        if (!newHand.some(h => h.id === t.id)) newHand.push(t);
      });
    });

    // 3. Near Pers (2-tile waiting)
    nearPers.forEach(np => {
      np.tiles.forEach(t => {
        if (!newHand.some(h => h.id === t.id)) newHand.push(t);
      });
    });

    // 4. Orphan / Dead tiles to the right
    orphanTiles.forEach(t => {
      if (!newHand.some(h => h.id === t.id)) newHand.push(t);
    });

    // Any leftover tiles
    player.hand.forEach(t => {
      if (!newHand.some(h => h.id === t.id)) newHand.push(t);
    });

    player.hand = newHand;
    soundFx.playOkeyTileSlide();
    soundFx.playOkeyStoneClack(0.8);
    this.updateAIAdvisor();
    this.appendLog('🧠 Yapay Zeka taşları hazır perler ve bekleyen gruplara göre akıllıca dizdi.');
  }

  sortHandRuns() {
    if (!this.gameEngine) return;
    const player = this.gameEngine.players[0];
    const colorOrder = { 'RED': 0, 'BLACK': 1, 'BLUE': 2, 'YELLOW': 3, 'FAKE': 4 };
    player.hand.sort((a, b) => {
      if (a.isRealOkey) return -1;
      if (b.isRealOkey) return 1;
      const cA = colorOrder[a.colorKey] ?? 0;
      const cB = colorOrder[b.colorKey] ?? 0;
      if (cA !== cB) return cA - cB;
      return a.number - b.number;
    });
    soundFx.playOkeyTileSlide();
    this.updateAIAdvisor();
    this.appendLog('Taşlar serilere göre dizildi.');
  }

  sortHandPairs() {
    if (!this.gameEngine) return;
    const player = this.gameEngine.players[0];
    player.hand.sort((a, b) => {
      if (a.isRealOkey) return -1;
      if (b.isRealOkey) return 1;
      if (a.number !== b.number) return a.number - b.number;
      return a.colorKey.localeCompare(b.colorKey);
    });
    soundFx.playOkeyTileSlide();
    this.updateAIAdvisor();
    this.appendLog('Taşlar sayılara/çiftlere göre dizildi.');
  }

  handleUserTileSelected(tile) {
    if (!this.gameEngine) return;
    const player = this.gameEngine.players[0];
    const tileIndex = player.hand.findIndex(t => t.id === tile.id);
    if (tileIndex === -1) return;

    if (this.selectedTileIndex === -1) {
      // 1. First Tile Click -> Elevate and highlight on rack
      this.selectedTileIndex = tileIndex;
      soundFx.playButtonClick();
      this.scene.highlightTileOnRack(tileIndex);
      this.showTileSelectionActions(tile);
    } else if (this.selectedTileIndex === tileIndex) {
      // 2. Clicked the SAME tile -> DISCARD IT if in discard phase
      if (this.gameEngine.turnPhase === 'DISCARD' && this.gameEngine.currentTurn === 0) {
        this.selectedTileIndex = -1;
        this.gameEngine.discardTile(0, tile.id);
        this.hideActionPanel();
      } else {
        this.selectedTileIndex = -1;
        this.scene.renderPlayerIstaka(player.hand);
        this.hideActionPanel();
      }
    } else {
      // 3. Clicked a DIFFERENT tile -> SWAP POSITIONS ON THE ISTAKA!
      const prevIdx = this.selectedTileIndex;
      const targetIdx = tileIndex;

      const temp = player.hand[prevIdx];
      player.hand[prevIdx] = player.hand[targetIdx];
      player.hand[targetIdx] = temp;

      this.selectedTileIndex = -1;
      soundFx.playOkeyTileSlide();
      soundFx.playOkeyStoneClack(0.7);
      this.updateAIAdvisor();
      this.appendLog(`Istakada taşların yeri değiştirildi.`);
      this.hideActionPanel();
    }
  }

  showTileSelectionActions(tile) {
    this.dom.actionTitle.textContent = `Seçilen Taş: ${tile.colorName} ${tile.number || 'Sahte Okey'}`;
    this.dom.actionButtonsContainer.innerHTML = '';

    if (this.gameEngine.turnPhase === 'DISCARD' && this.gameEngine.currentTurn === 0) {
      const discardBtn = document.createElement('button');
      discardBtn.className = 'action-chip pass';
      discardBtn.textContent = '🚀 Bu Taşı At';
      discardBtn.onclick = () => {
        this.selectedTileIndex = -1;
        this.gameEngine.discardTile(0, tile.id);
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(discardBtn);
    }

    const sortAiBtn = document.createElement('button');
    sortAiBtn.className = 'action-chip ai-btn';
    sortAiBtn.textContent = '🧠 AI Akıllı Diz';
    sortAiBtn.onclick = () => {
      this.selectedTileIndex = -1;
      this.sortHandAI();
      this.hideActionPanel();
    };
    this.dom.actionButtonsContainer.appendChild(sortAiBtn);

    const sortRunsBtn = document.createElement('button');
    sortRunsBtn.className = 'action-chip';
    sortRunsBtn.textContent = '📐 Seri Diz';
    sortRunsBtn.onclick = () => {
      this.selectedTileIndex = -1;
      this.sortHandRuns();
      this.hideActionPanel();
    };
    this.dom.actionButtonsContainer.appendChild(sortRunsBtn);

    const sortPairsBtn = document.createElement('button');
    sortPairsBtn.className = 'action-chip';
    sortPairsBtn.textContent = '👥 Çift Diz';
    sortPairsBtn.onclick = () => {
      this.selectedTileIndex = -1;
      this.sortHandPairs();
      this.hideActionPanel();
    };
    this.dom.actionButtonsContainer.appendChild(sortPairsBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'action-chip';
    cancelBtn.style.background = '#475569';
    cancelBtn.textContent = 'Vazgeç';
    cancelBtn.onclick = () => {
      this.selectedTileIndex = -1;
      this.scene.renderPlayerIstaka(this.gameEngine.players[0].hand);
      this.hideActionPanel();
    };
    this.dom.actionButtonsContainer.appendChild(cancelBtn);

    this.dom.actionPanel.classList.add('show');
  }

  handleCenterStackClick() {
    if ((this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') && this.gameEngine) {
      if (this.gameEngine.currentTurn === 0 && this.gameEngine.turnPhase === 'DRAW') {
        this.gameEngine.drawFromStack(0);
        this.hideActionPanel();
      }
    }
  }

  updateOkeyHUD(customStatus = null) {
    const p = this.gameEngine.players;
    const scores = p.map(player => ({
      name: player.name,
      score: player.score
    }));

    const status = customStatus || (this.gameEngine.currentTurn === 0 ? 'Sıra Sizde!' : `${p[this.gameEngine.currentTurn]?.name} Oynuyor`);
    this.dom.hudStatus.textContent = status;

    const advice = this.currentAdvice;
    this.scene.updateHUD({
      title: 'KLASİK OKEY (Kıraathane)',
      status,
      trump: null,
      okeyTile: this.gameEngine.okeyTileInfo,
      currentTurn: this.gameEngine.currentTurn,
      scores,
      aiAdvice: advice?.bestDiscard ? `Tavsiye: ${advice.bestDiscard.tile.colorName} ${advice.bestDiscard.tile.number} Atın` : null,
      aiDetail: advice?.bestDiscard?.reason || null
    });
  }

  // --- BATAK INTEGRATION ---
  startBatakGame() {
    this.resetActiveEngine();
    this.currentGameType = 'BATAK';
    this.dom.hudGameName.textContent = 'İhaleli Batak';
    this.dom.trumpContainer.style.display = 'flex';
    this.dom.trumpInfoLabel.textContent = 'Koz';
    this.updateGameControls('BATAK');

    this.scene.setGameModeView('BATAK');
    soundFx.playCardShuffle();

    const seatedPlayers = this.getActiveSeatedPlayers(4);
    this.scene.updateTableAvatars(seatedPlayers);

    this.gameEngine = new BatakGameEngine('IHALELI', 5);
    this.gameEngine.initPlayers(seatedPlayers.map(p => p.name));

    this.gameEngine.onEvent((event, data) => {
      this.handleBatakEvent(event, data);
    });

    this.gameEngine.startNewMatch();
  }

  handleBatakEvent(event, data) {
    if (event === 'log') {
      this.appendLog(data.message);
    } else if (event === 'deal_complete') {
      this.updateBatakHUD('Kartlar Dağıtıldı');
      this.sortBatakCards();
      this.scene.renderOpponentHands(this.gameEngine.players);
      soundFx.playCardDeal();
      this.updateAIAdvisor();
    } else if (event === 'bidding_started' || event === 'bid_turn_changed') {
      const isMyTurn = data.bidTurn === 0;
      const bidderName = this.gameEngine.players[data.bidTurn].name;
      this.updateBatakHUD(`İhale Sırası: ${bidderName}`);

      if (isMyTurn) {
        this.showBatakBiddingUI(data.highestBid);
        this.scene.showBiddingButtonsInVR(data.highestBid, (bid) => {
          this.gameEngine.submitBid(0, bid);
          this.hideActionPanel();
        });
      } else {
        this.hideActionPanel();
        this.scene.clearVRButtons();
      }
      this.updateAIAdvisor();
    } else if (event === 'choose_trump_phase') {
      if (data.playerIndex === 0) {
        this.updateBatakHUD('İhaleyi Aldınız! Lütfen Koz Seçin.');
        this.showTrumpSelectionUI();
        this.scene.showTrumpSelectionButtonsInVR((suit) => {
          this.gameEngine.setTrump(0, suit);
          this.hideActionPanel();
        });
      } else {
        this.updateBatakHUD(`${this.gameEngine.players[data.playerIndex].name} Koz Seçiyor...`);
      }
      this.updateAIAdvisor();
    } else if (event === 'trump_chosen') {
      const suit = SUITS[data.trumpSuit];
      this.dom.hudTrump.innerHTML = `<span style="color:${suit.isRed ? '#ef4444' : '#60a5fa'}">${suit.symbol} ${suit.name}</span>`;
      soundFx.playTrumpFanfare();
      this.updateAIAdvisor();
    } else if (event === 'playing_started' || event === 'turn_changed') {
      const isMyTurn = data.currentTurn === 0;
      const turnPlayer = this.gameEngine.players[data.currentTurn];
      this.updateBatakHUD(isMyTurn ? '🌟 SIRA SİZDE! Kart seçin.' : `${turnPlayer.name} oynuyor...`);
      this.updateAIAdvisor();
    } else if (event === 'card_played') {
      this.scene.animateCardPlay(data.card, data.playerIndex, null, () => {
        this.scene.renderTableCards(this.gameEngine.currentTrick);
      });
      this.updateAIAdvisor();
    } else if (event === 'trick_completed') {
      const winner = this.gameEngine.players[data.winnerIndex];
      this.updateBatakHUD(`Eli ${winner.name} aldı!`);
      setTimeout(() => {
        this.scene.animateTrickCollection(data.winnerIndex, () => {
          this.updateBatakHUD();
          this.updateAIAdvisor();
        });
      }, 700);
    } else if (event === 'round_ended') {
      this.updateBatakHUD('El Tamamlandı!');
      this.updateAIAdvisor();
    } else if (event === 'match_winner') {
      this.updateBatakHUD(`🏆 OYUN BİTTİ! Kazanan: ${data.winner.name}`);
      this.triggerVictoryCelebration();
    }
  }

  showBatakBiddingUI(highestBid) {
    this.dom.actionTitle.textContent = `İhale Teklifi Verin (En Yüksek: ${highestBid || 0}):`;
    this.dom.actionButtonsContainer.innerHTML = '';

    const passBtn = document.createElement('button');
    passBtn.className = 'action-chip pass';
    passBtn.textContent = 'Pas';
    passBtn.onclick = () => {
      this.gameEngine.submitBid(0, 0);
      this.hideActionPanel();
    };
    this.dom.actionButtonsContainer.appendChild(passBtn);

    const minBid = Math.max(5, highestBid + 1);
    for (let b = minBid; b <= 13; b++) {
      const bidBtn = document.createElement('button');
      bidBtn.className = 'action-chip';
      bidBtn.textContent = `${b} Batak`;
      bidBtn.onclick = () => {
        this.gameEngine.submitBid(0, b);
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(bidBtn);
    }

    this.dom.actionPanel.classList.add('show');
  }

  showTrumpSelectionUI() {
    this.dom.actionTitle.textContent = 'Koz Rengini Seçin:';
    this.dom.actionButtonsContainer.innerHTML = '';

    const suits = [
      { key: 'S', name: 'Maça ♠', color: '#60a5fa' },
      { key: 'H', name: 'Kupa ♥', color: '#ef4444' },
      { key: 'D', name: 'Karo ♦', color: '#ef4444' },
      { key: 'C', name: 'Sinek ♣', color: '#60a5fa' }
    ];

    suits.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'action-chip';
      btn.style.borderColor = s.color;
      btn.innerHTML = `<span style="color:${s.color}; font-size:1.2rem;">${s.name}</span>`;
      btn.onclick = () => {
        this.gameEngine.setTrump(0, s.key);
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(btn);
    });

    this.dom.actionPanel.classList.add('show');
  }

  updateBatakHUD(customStatus = null) {
    const p = this.gameEngine.players;
    const scores = p.map(player => ({
      name: player.name,
      bid: player.bid,
      tricks: player.tricksWon,
      score: player.totalScore
    }));

    const status = customStatus || (this.gameEngine.currentTurn === 0 ? 'Sıra Sizde!' : `${p[this.gameEngine.currentTurn]?.name} Oynuyor`);
    this.dom.hudStatus.textContent = status;

    const advice = this.currentAdvice;
    this.scene.updateHUD({
      title: `İHALELİ BATAK (${this.gameEngine.currentHand}/${this.gameEngine.totalHands}. El)`,
      status,
      trump: this.gameEngine.trumpSuit,
      currentTurn: this.gameEngine.currentTurn,
      scores,
      aiAdvice: advice?.recommendedCard ? `Tavsiye: ${advice.recommendedCard.suitName} ${advice.recommendedCard.rank}` : (advice?.summary || null),
      aiDetail: advice?.reason || null
    });
  }

  // --- PISTI INTEGRATION ---
  startPistiGame() {
    this.resetActiveEngine();
    this.currentGameType = 'PISTI';
    this.dom.hudGameName.textContent = 'Pişti';
    this.dom.trumpContainer.style.display = 'none';
    this.updateGameControls('PISTI');

    this.scene.setGameModeView('PISTI');
    soundFx.playCardShuffle();

    const maxP = (networkManager.isConnected && networkManager.maxPlayers) ? networkManager.maxPlayers : 2;
    const seatedPlayers = this.getActiveSeatedPlayers(maxP);
    this.scene.updateTableAvatars(seatedPlayers);

    this.gameEngine = new PistiGameEngine(maxP, 101);
    this.gameEngine.initPlayers(seatedPlayers.map(p => p.name));

    this.gameEngine.onEvent((event, data) => {
      this.handlePistiEvent(event, data);
    });

    this.gameEngine.startNewMatch();
  }

  handlePistiEvent(event, data) {
    if (event === 'log') {
      this.appendLog(data.message);
    } else if (event === 'table_deal') {
      this.scene.renderTableCards(data.tableCards);
      soundFx.playCardDeal();
    } else if (event === 'deal_complete') {
      this.updatePistiHUD('Kartlar Dağıtıldı');
      this.scene.renderPlayerHand(this.gameEngine.players[0].hand);
      this.scene.renderOpponentHands(this.gameEngine.players);
      this.updateAIAdvisor();
    } else if (event === 'turn_changed') {
      const isMyTurn = data.currentTurn === 0;
      this.updatePistiHUD(isMyTurn ? '🌟 SIRA SİZDE! Kart atın.' : 'Bot düşünüyor...');
      this.updateAIAdvisor();
    } else if (event === 'card_played') {
      this.scene.animateCardPlay(data.card, data.playerIndex, null, () => {
        this.scene.renderTableCards(this.gameEngine.tableCards);
      });
      this.updateAIAdvisor();
    } else if (event === 'pisti_event') {
      soundFx.playPistiChime();
      this.triggerVictoryCelebration(0.5);
      this.updatePistiHUD(`⚡ ${data.isJackPisti ? 'ÇİFT PİŞTİ (+20)' : 'PİŞTİ (+10)'}!`);
    } else if (event === 'pile_captured') {
      setTimeout(() => {
        this.scene.animateTrickCollection(data.playerIndex, () => {
          this.updatePistiHUD();
          this.updateAIAdvisor();
        });
      }, 600);
    } else if (event === 'round_ended') {
      this.updatePistiHUD('El Bitti! Skorlar güncellendi.');
      this.updateAIAdvisor();
    } else if (event === 'match_winner') {
      this.updatePistiHUD(`🏆 ŞAMPİYON: ${data.winner.name} (${data.winner.totalScore} Puan)`);
      this.triggerVictoryCelebration(1.0);
    }
  }

  updatePistiHUD(customStatus = null) {
    const p = this.gameEngine.players;
    const scores = p.map(player => ({
      name: player.name,
      pistis: player.pistis,
      tricks: player.captured.length,
      score: player.totalScore
    }));

    const status = customStatus || (this.gameEngine.currentTurn === 0 ? 'Sıra Sizde!' : `${p[this.gameEngine.currentTurn]?.name} Oynuyor`);
    this.dom.hudStatus.textContent = status;

    const advice = this.currentAdvice;
    this.scene.updateHUD({
      title: `PİŞTİ (Hedef 101 Puan)`,
      status,
      trump: null,
      currentTurn: this.gameEngine.currentTurn,
      scores,
      aiAdvice: advice?.recommendedCard ? `Tavsiye: ${advice.recommendedCard.suitName} ${advice.recommendedCard.rank}` : (advice?.summary || null),
      aiDetail: advice?.reason || null
    });
  }

  handleUserCardSelected(card) {
    if (!this.gameEngine || this.gameEngine.gameState !== 'PLAYING') return;
    if (this.gameEngine.currentTurn !== 0) return;

    if (this.currentGameType === 'BATAK') {
      const isPlayable = this.gameEngine.isCardPlayable(0, card.id);
      if (!isPlayable) {
        soundFx.playButtonClick();
        this.appendLog('⚠️ Kural ihlali: Bu kartı oynayamazsınız!');
        return;
      }
      this.gameEngine.playCard(0, card.id);
    } else if (this.currentGameType === 'PISTI') {
      this.gameEngine.playCard(0, card.id);
    }
  }

  appendLog(msg) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = msg;
    this.dom.gameLogBox.prepend(entry);

    while (this.dom.gameLogBox.children.length > 20) {
      this.dom.gameLogBox.removeChild(this.dom.gameLogBox.lastChild);
    }
  }

  hideActionPanel() {
    this.dom.actionPanel.classList.remove('show');
  }

  triggerVictoryCelebration(intensity = 1.0) {
    const count = Math.floor(100 * intensity);
    confetti({
      particleCount: count,
      spread: 80,
      origin: { y: 0.6 }
    });
  }

  // --- VIP DEVELOPER AUTHENTICATION (MÜCAHİT KORKMAZ) ---
  isVIPUser() {
    return Boolean(
      this.currentUser &&
      this.currentUser.email &&
      this.currentUser.email.trim().toLowerCase() === 'mchtkrkmz@gmail.com'
    );
  }

  updateVIPState() {
    const isVIP = this.isVIPUser();
    const isUserLoggedIn = Boolean(this.currentUser);

    if (this.dom.btnProfile) {
      if (isVIP) {
        if (this.dom.profileIcon) this.dom.profileIcon.textContent = '👑';
        if (this.dom.profileLabel) this.dom.profileLabel.textContent = 'Mücahit (VIP)';
        this.dom.btnProfile.style.borderColor = 'var(--border-gold)';
        this.dom.btnProfile.style.color = 'var(--accent-gold)';
      } else if (isUserLoggedIn) {
        if (this.dom.profileIcon) this.dom.profileIcon.textContent = '👤';
        if (this.dom.profileLabel) this.dom.profileLabel.textContent = this.currentUser.name || 'Oyuncu';
        this.dom.btnProfile.style.borderColor = 'rgba(148, 163, 184, 0.35)';
        this.dom.btnProfile.style.color = 'var(--text-main)';
      } else {
        if (this.dom.profileIcon) this.dom.profileIcon.textContent = '👤';
        if (this.dom.profileLabel) this.dom.profileLabel.textContent = 'Giriş Yap';
        this.dom.btnProfile.style.borderColor = 'rgba(148, 163, 184, 0.25)';
        this.dom.btnProfile.style.color = 'var(--text-main)';
      }
    }

    // Secret AI Features: Strictly locked to mchtkrkmz@gmail.com
    if (this.dom.btnToggleAI) {
      this.dom.btnToggleAI.style.display = isVIP ? 'inline-flex' : 'none';
    }
    if (this.dom.aiCoachPanel) {
      this.dom.aiCoachPanel.style.display = (isVIP && this.aiEnabled) ? 'block' : 'none';
    }
    if (this.dom.btnAISort) {
      const isOkeyType = this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101';
      this.dom.btnAISort.style.display = (isVIP && isOkeyType) ? 'inline-flex' : 'none';
    }

    if (!isVIP) {
      this.aiEnabled = false;
      this.currentAdvice = null;
    }

    this.updateGameControls(this.currentGameType);
  }

  updateGameControls(gameType) {
    const isOkeyType = gameType === 'OKEY' || gameType === 'OKEY101';
    const isBatak = gameType === 'BATAK';
    const isVIP = this.isVIPUser();

    if (this.dom.okeyRackControls) {
      this.dom.okeyRackControls.style.display = isOkeyType ? 'inline-flex' : 'none';
    }

    if (this.dom.btnAISort) {
      this.dom.btnAISort.style.display = (isOkeyType && isVIP) ? 'inline-flex' : 'none';
    }

    if (this.dom.batakControls) {
      this.dom.batakControls.style.display = isBatak ? 'inline-flex' : 'none';
    }
  }

  sortBatakCards() {
    if (!this.gameEngine || this.currentGameType !== 'BATAK') return;
    const player = this.gameEngine.players[0];
    if (!player || !player.hand) return;

    const suitOrder = { 'S': 0, 'H': 1, 'C': 2, 'D': 3 };
    const rankOrder = { 'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };

    player.hand.sort((a, b) => {
      const sA = suitOrder[a.suit] ?? 0;
      const sB = suitOrder[b.suit] ?? 0;
      if (sA !== sB) return sA - sB;
      const rA = rankOrder[a.rank] ?? 0;
      const rB = rankOrder[b.rank] ?? 0;
      return rB - rA;
    });

    soundFx.playCardShuffle();
    const isMyTurn = this.gameEngine.currentTurn === 0;
    const playableCards = (isMyTurn && this.gameEngine.gameState === 'PLAYING')
      ? this.gameEngine.getLegalCards(0).map(c => c.id)
      : null;
    const recCardId = this.currentAdvice?.recommendedCard ? this.currentAdvice.recommendedCard.id : null;
    this.scene.renderPlayerHand(player.hand, playableCards, recCardId);
    this.appendLog('♠️ Kartlar renklere ve büyüklüklerine göre sıralandı.');
  }

  openAuthModal(customNotice = null) {
    this.dom.authModal.classList.remove('hidden');

    if (this.currentUser) {
      // User is logged in: Show Profile Card ONLY
      this.dom.authLoggedInView.classList.remove('hidden');
      this.dom.authFormsContainer.classList.add('hidden');

      const isVIP = this.isVIPUser();
      if (this.dom.authUserName) this.dom.authUserName.textContent = this.currentUser.name || 'Oyuncu';
      if (this.dom.authUserEmailDisplay) this.dom.authUserEmailDisplay.textContent = this.currentUser.email || '';
      if (this.dom.authAvatarIcon) this.dom.authAvatarIcon.textContent = isVIP ? '👑' : '👤';
      if (this.dom.authVipBadge) this.dom.authVipBadge.style.display = isVIP ? 'inline-block' : 'none';
      if (this.dom.authRegularBadge) this.dom.authRegularBadge.classList.toggle('hidden', isVIP);
    } else {
      // User is not logged in: Show Register / Login Tabs ONLY
      this.dom.authLoggedInView.classList.add('hidden');
      this.dom.authFormsContainer.classList.remove('hidden');

      this.dom.tabAuthLogin.classList.add('active');
      this.dom.tabAuthRegister.classList.remove('active');
      this.dom.viewAuthLogin.classList.remove('hidden');
      this.dom.viewAuthRegister.classList.add('hidden');

      if (this.dom.inputLoginEmail) this.dom.inputLoginEmail.value = '';
      if (this.dom.inputLoginPassword) this.dom.inputLoginPassword.value = '';
      
      if (customNotice) {
        this.showAuthMsg(customNotice, 'info');
      } else if (this.dom.authMsg) {
        this.dom.authMsg.style.display = 'none';
      }
    }
  }

  showAuthMsg(msg, type = 'info') {
    if (!this.dom.authMsg) return;
    this.dom.authMsg.textContent = msg;
    this.dom.authMsg.style.display = 'block';
    if (type === 'error') {
      this.dom.authMsg.style.background = 'rgba(239, 68, 68, 0.2)';
      this.dom.authMsg.style.border = '1px solid rgba(239, 68, 68, 0.5)';
      this.dom.authMsg.style.color = '#f87171';
    } else if (type === 'success') {
      this.dom.authMsg.style.background = 'rgba(34, 197, 94, 0.2)';
      this.dom.authMsg.style.border = '1px solid rgba(34, 197, 94, 0.5)';
      this.dom.authMsg.style.color = '#4ade80';
    } else {
      this.dom.authMsg.style.background = 'rgba(56, 189, 248, 0.2)';
      this.dom.authMsg.style.border = '1px solid rgba(56, 189, 248, 0.5)';
      this.dom.authMsg.style.color = '#38bdf8';
    }
  }

  sortHandRuns() {
    if (!this.gameEngine || !this.gameEngine.players || !this.gameEngine.players[0]) return;
    const hand = this.gameEngine.players[0].hand;
    const colorOrder = { RED: 1, BLUE: 2, BLACK: 3, YELLOW: 4 };
    hand.sort((a, b) => {
      const ca = colorOrder[a.colorKey] || 99;
      const cb = colorOrder[b.colorKey] || 99;
      if (ca !== cb) return ca - cb;
      return a.number - b.number;
    });
    this.scene.renderPlayerIstaka(hand);
    soundFx.playOkeyTileClick();
  }

  sortHandPairs() {
    if (!this.gameEngine || !this.gameEngine.players || !this.gameEngine.players[0]) return;
    const hand = this.gameEngine.players[0].hand;
    hand.sort((a, b) => {
      if (a.number !== b.number) return a.number - b.number;
      return (a.colorKey || '').localeCompare(b.colorKey || '');
    });
    this.scene.renderPlayerIstaka(hand);
    soundFx.playOkeyTileClick();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AppManager();
});
