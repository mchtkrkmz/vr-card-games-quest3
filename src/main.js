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
import { userDb, ADMIN_EMAIL } from './engine/db/userDatabase.js';
import {
  arrangeHandTilesOnIstaka,
  assignRawIstakaSlots,
  createPhotoDemoHand,
  moveTileToIstakaSlot,
  syncHandIstakaSlots,
  ISTAKA_SLOTS_PER_TIER,
} from './engine/okey/tiles.js';

const CARD_SUIT_SVG_PATHS = {
  S: 'M12 2C9 6.5 3.5 10.2 3.5 14.5c0 2.6 2 4.5 4.4 4.5 1.4 0 2.5-.6 3.1-1.5-.1 1.6-.6 3-1.8 4.5h5.6c-1.2-1.5-1.7-2.9-1.8-4.5.6.9 1.7 1.5 3.1 1.5 2.4 0 4.4-1.9 4.4-4.5C20.5 10.2 15 6.5 12 2z',
  H: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  D: 'M12 2L4.5 12 12 22l7.5-10L12 2z',
  C: 'M12 2.5a4.2 4.2 0 0 0-4.2 4.2c0 1.2.5 2.3 1.3 3a4.3 4.3 0 0 0-5.6 4.1A4.3 4.3 0 0 0 7.8 18c1.3 0 2.4-.5 3.2-1.4-.1 1.8-.7 3.4-2 4.9h6c-1.3-1.5-1.9-3.1-2-4.9.8.9 1.9 1.4 3.2 1.4a4.3 4.3 0 0 0 4.3-4.2 4.3 4.3 0 0 0-5.6-4.1c.8-.7 1.3-1.8 1.3-3A4.2 4.2 0 0 0 12 2.5z',
};

function getCardMeta(card) {
  const idStr = typeof card?.id === 'string' ? card.id : '';
  const inferredSuit = idStr.includes('_') ? idStr.split('_')[1] : '';
  const suitObj = SUITS[card?.suit] || SUITS[inferredSuit] || SUITS.S;
  const rank = String(card?.rank ?? card?.label ?? (idStr.includes('_') ? idStr.split('_')[0] : '?'));
  const courtMap = { J: 'Vale', Q: 'Kız', K: 'Papaz', A: 'As' };
  return {
    suitId: suitObj.id,
    symbol: card?.symbol || suitObj.symbol,
    suitName: card?.suitName || suitObj.name,
    isRed: typeof card?.isRed === 'boolean' ? card.isRed : suitObj.isRed,
    rank,
    court: card?.court || courtMap[rank] || null,
  };
}

function getSuitSvg(suitId, className = '') {
  const pathD = CARD_SUIT_SVG_PATHS[suitId] || CARD_SUIT_SVG_PATHS.S;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="${className}"><path fill="currentColor" d="${pathD}"/></svg>`;
}

class AppManager {
  constructor() {
    this.scene = null;
    this.currentGameType = 'BATAK'; // 'BATAK', 'PISTI', 'OKEY', 'OKEY101'
    this.gameEngine = null;
    this.aiEnabled = false;
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
      btnOrderTea: document.getElementById('btn-order-tea'),
      btnMobileMenu: document.getElementById('btn-mobile-menu'),
      secondaryControls: document.getElementById('secondary-controls'),
      btnToggleLog: document.getElementById('btn-toggle-log'),
      btnSound: document.getElementById('btn-sound'),
      soundIcon: document.getElementById('sound-icon'),
      soundPct: document.getElementById('sound-pct'),
      audioPopover: document.getElementById('audio-settings-popover'),
      btnToggleSpeakerMute: document.getElementById('btn-toggle-speaker-mute'),
      sliderSpeakerVolume: document.getElementById('slider-speaker-volume'),
      btnTestMic: document.getElementById('btn-test-mic'),
      micMeterFill: document.getElementById('mic-meter-fill'),
      btnToggleAI: document.getElementById('btn-toggle-ai'),
      aiToggleLabel: document.getElementById('ai-toggle-label'),
      aiCoachPanel: document.getElementById('ai-coach-panel'),
      aiCoachContent: document.getElementById('ai-coach-content'),
      btnApplyAI: document.getElementById('btn-apply-ai'),
      btnNewHand: document.getElementById('btn-new-hand'),
      btnScoreboard: document.getElementById('btn-scoreboard'),
      btnLeaveGame: document.getElementById('btn-leave-game'),
      scoreboardPanel: document.getElementById('scoreboard-panel'),
      scoreboardTitleText: document.getElementById('scoreboard-title-text'),
      scoreboardRoundBadge: document.getElementById('scoreboard-round-badge'),
      scoreboardLiveBar: document.getElementById('scoreboard-live-bar'),
      scoreboardThead: document.getElementById('scoreboard-thead'),
      scoreboardTbody: document.getElementById('scoreboard-tbody'),
      scoreboardTfoot: document.getElementById('scoreboard-tfoot'),
      btnCloseScoreboard: document.getElementById('btn-close-scoreboard'),
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
      btnMeldTiles: document.getElementById('btn-meld-tiles'),
      btnSortRuns: document.getElementById('btn-sort-runs'),
      btnSortPairs: document.getElementById('btn-sort-pairs'),
      btnSortColor: document.getElementById('btn-sort-color'),
      btnPhotoDemo: document.getElementById('btn-photo-demo'),
      mobileHandDock: document.getElementById('mobile-hand-dock'),
      mobileHandToolbar: document.getElementById('mobile-hand-toolbar'),
      mobileCardsTray: document.getElementById('mobile-cards-tray'),
      mobileIstakaTray: document.getElementById('mobile-istaka-tray'),
      mobileIstakaRow0: document.getElementById('mobile-istaka-row-0'),
      mobileIstakaRow1: document.getElementById('mobile-istaka-row-1'),

      // Game Over Elements
      gameOverModal: document.getElementById('game-over-modal'),
      gameOverTitle: document.getElementById('game-over-title'),
      gameOverWinner: document.getElementById('game-over-winner'),
      gameOverSummary: document.getElementById('game-over-summary'),
      btnGameOverRestart: document.getElementById('btn-game-over-restart'),
      btnGameOverExitVR: document.getElementById('btn-game-over-exit-vr'),
      btnGameOverMenu: document.getElementById('btn-game-over-menu'),

      // Multiplayer Elements
      multiplayerModal: document.getElementById('multiplayer-modal'),
      mpServerStatus: document.getElementById('mp-server-status'),
      inputServerUrl: document.getElementById('input-server-url'),
      btnReconnectServer: document.getElementById('btn-reconnect-server'),
      mpPublicRoomsList: document.getElementById('mp-public-rooms-list'),
      btnRefreshRooms: document.getElementById('btn-refresh-rooms'),
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
      btnLobbyMic: document.getElementById('btn-lobby-mic'),
      lobbyMicIcon: document.getElementById('lobby-mic-icon'),
      lobbyMicLabel: document.getElementById('lobby-mic-label'),
      playedCardsFeed: document.getElementById('played-cards-feed'),

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
      authAiGrantedBadge: document.getElementById('auth-ai-granted-badge'),
      authRegularBadge: document.getElementById('auth-regular-badge'),
      adminAiPanel: document.getElementById('admin-ai-panel'),
      adminUsersList: document.getElementById('admin-users-list'),
      btnRefreshAdminUsers: document.getElementById('btn-refresh-admin-users'),
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
      authMsg: document.getElementById('auth-msg'),
    };

    this.currentUser = userDb.getActiveSession();
    this.aiEnabled = this.hasAIAccess();

    this.selectedTileIndex = -1;
    this.selectedCardId = null;
    this.init();
  }

  // --- PERSPECTIVE / MULTIPLAYER SEAT HELPERS ---
  getMySeat() {
    if (networkManager.isConnected) {
      return networkManager.localPlayerId ?? 0;
    }
    return 0;
  }

  isMultiplayerGuest() {
    return networkManager.isConnected && !networkManager.isHost;
  }

  isMultiplayerHost() {
    return networkManager.isConnected && networkManager.isHost;
  }

  getTotalPlayersCount() {
    return this.gameEngine?.players?.length || 4;
  }

  toVisualSeat(engineSeat, totalPlayers = this.getTotalPlayersCount()) {
    const mySeat = this.getMySeat();
    if (totalPlayers === 2) {
      return engineSeat === mySeat ? 0 : 2;
    }
    return (engineSeat - mySeat + totalPlayers) % totalPlayers;
  }

  toVisualArray(arr = []) {
    const total = this.getTotalPlayersCount();
    const out = [null, null, null, null];
    for (let s = 0; s < arr.length; s++) {
      const vSeat = this.toVisualSeat(s, total);
      out[vSeat] = arr[s];
    }
    return out;
  }

  getMyPlayer() {
    return this.gameEngine?.players?.[this.getMySeat()] || null;
  }

  getLeftEngineSeat() {
    const total = this.getTotalPlayersCount();
    return (this.getMySeat() + total - 1) % total;
  }

  setSelectedTile(idx) {
    this.selectedTileIndex = idx;
    if (this.scene) this.scene.setSelectedTileIndex(idx);
    this.renderMobileHandDock();
  }

  isMobileHandMode() {
    if (typeof window === 'undefined') return false;
    if (this.scene?.isVRActive) return false;
    return window.innerWidth <= 960 || window.innerHeight <= 540;
  }

  syncMobileHandMode() {
    const active = this.isMobileHandMode();
    this.scene?.setMobileHandDockActive?.(active);
    this.renderMobileHandDock();
  }

  renderMobileHandDock() {
    const dock = this.dom.mobileHandDock;
    if (!dock) return;
    if (!this.isMobileHandMode() || !this.gameEngine) {
      dock.style.display = 'none';
      return;
    }

    dock.style.display = 'flex';
    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();
    const hand = Array.isArray(myPlayer?.hand) ? myPlayer.hand : [];
    const isOkeyType = this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101';
    const hasAI = this.hasAIAccess();
    const canSort = this.canAutoSort();
    const advice = hasAI && this.aiEnabled ? this.currentAdvice : null;

    if (this.selectedCardId && !hand.some((c) => c.id === this.selectedCardId)) {
      this.selectedCardId = null;
    }

    const isPlayingState = isOkeyType
      ? this.gameEngine.gameState !== 'GAME_OVER'
      : this.gameEngine.gameState === 'PLAYING';
    const isMyTurn = this.gameEngine.currentTurn === mySeat && isPlayingState;

    const prevCardScroll = this.dom.mobileCardsTray?.scrollLeft || 0;
    const prevIstakaScroll = this.dom.mobileIstakaTray?.scrollLeft || 0;

    // 1. Build compact mobile dock toolbar
    const toolbar = this.dom.mobileHandToolbar;
    if (toolbar) {
      toolbar.innerHTML = '';

      const statusPill = document.createElement('span');
      statusPill.className = `m-toolbar-pill${isMyTurn ? ' turn' : ''}`;
      if (isOkeyType) {
        const phaseTxt = isMyTurn
          ? this.gameEngine.turnPhase === 'DRAW'
            ? '🟢 Taş Çek'
            : '🟢 Taş At'
          : '⏳ Rakip';
        let extra = '';
        if (this.currentGameType === 'OKEY101' && this.gameEngine.calculateHandPerPoints && myPlayer) {
          const pts = this.gameEngine.calculateHandPerPoints(myPlayer)?.totalPoints || 0;
          extra = ` • ${pts}p`;
        }
        statusPill.textContent = `${phaseTxt}${extra}`;
      } else {
        const phaseTxt =
          this.currentGameType === 'BATAK' && this.gameEngine.gameState === 'BIDDING'
            ? '🔔 İhale'
            : this.currentGameType === 'BATAK' && this.gameEngine.gameState === 'CHOOSE_TRUMP'
              ? '👑 Koz'
              : isMyTurn
                ? '🟢 Sıranız'
                : '⏳ Rakip';
        statusPill.textContent = `${phaseTxt} • ${hand.length} Kart`;
      }
      toolbar.appendChild(statusPill);

      if (this.currentGameType === 'BATAK' && this.gameEngine.trumpSuit && this.gameEngine.gameState === 'PLAYING') {
        const trumpSuit = SUITS[this.gameEngine.trumpSuit] || SUITS.S;
        const trumpPill = document.createElement('span');
        trumpPill.className = 'm-toolbar-pill';
        trumpPill.innerHTML = `Koz: <strong style="color:${trumpSuit.isRed ? '#f87171' : '#93c5fd'}">${trumpSuit.symbol} ${trumpSuit.name}</strong>`;
        toolbar.appendChild(trumpPill);
      } else if (this.currentGameType === 'PISTI') {
        const tableCards = this.gameEngine.tableCards || [];
        const tablePill = document.createElement('span');
        tablePill.className = 'm-toolbar-pill';
        if (tableCards.length > 0) {
          const topMeta = getCardMeta(tableCards[tableCards.length - 1]);
          tablePill.innerHTML = `Masa (${tableCards.length}): <strong style="color:${topMeta.isRed ? '#f87171' : '#f8fafc'}">${topMeta.symbol} ${topMeta.rank}</strong>`;
        } else {
          tablePill.textContent = 'Masa: Boş';
        }
        toolbar.appendChild(tablePill);
      }

      const addToolBtn = (label, cls, onClick) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `m-toolbar-btn ${cls || ''}`.trim();
        btn.textContent = label;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          soundFx.playButtonClick();
          onClick();
        });
        toolbar.appendChild(btn);
      };

      if (isOkeyType) {
        const isMyDiscardTurn = isMyTurn && this.gameEngine.turnPhase === 'DISCARD';
        const highlights = this.getOkeyTileHighlights();
        const meldables =
          this.currentGameType === 'OKEY101' && isMyDiscardTurn && myPlayer?.hasOpened && this.gameEngine.findMeldableTiles
            ? this.gameEngine.findMeldableTiles(mySeat)
            : [];

        if (isMyTurn && this.gameEngine.turnPhase === 'DRAW') {
          addToolBtn('➕ Deste', 'primary', () => this.dispatchOkeyDrawStack());
          const leftSeat = this.getLeftEngineSeat();
          const leftPile = this.gameEngine.discardPiles?.[leftSeat];
          if (leftPile && leftPile.length > 0) {
            const topTile = leftPile[leftPile.length - 1];
            addToolBtn(`↩️ Yandan (${topTile.isFakeOkey ? 'Sahte' : topTile.number})`, 'warn', () => this.dispatchOkeyDrawDiscard());
          }
        } else if (isMyDiscardTurn) {
          const selTile = this.selectedTileIndex >= 0 ? hand[this.selectedTileIndex] : null;
          if (this.currentGameType === 'OKEY101' && meldables.length > 0) {
            if (selTile && highlights.meldIds.has(selTile.id)) {
              addToolBtn(`✨ İşle (${selTile.isFakeOkey ? 'Sahte' : selTile.number})`, 'primary', () =>
                this.dispatchOkey101Meld(selTile.id)
              );
            } else {
              addToolBtn(`✨ İşle (${meldables.length})`, 'primary', () => this.dispatchOkey101Meld(null));
            }
          } else if (this.currentGameType === 'OKEY' && highlights.winIds.size > 0) {
            const winId =
              selTile && highlights.winIds.has(selTile.id) ? selTile.id : Array.from(highlights.winIds)[0];
            addToolBtn('🏆 Eli Bitir', 'primary', () => this.dispatchOkeyDiscard(winId));
          }
          if (selTile) {
            const penInfo = highlights.penaltyMap.get(selTile.id) || { willPenalize: false };
            if (penInfo.willPenalize) {
              addToolBtn(`🚨 At (+${penInfo.penaltyPoints} CEZA)`, 'danger', () =>
                this.dispatchOkeyDiscard(selTile.id)
              );
              const warnPill = document.createElement('span');
              warnPill.className = 'm-toolbar-pill';
              warnPill.style.background = 'rgba(220, 38, 38, 0.25)';
              warnPill.style.borderColor = 'rgba(248, 113, 113, 0.7)';
              warnPill.style.color = '#fecaca';
              warnPill.textContent = `⚠️ ${penInfo.reason}`;
              toolbar.appendChild(warnPill);
            } else {
              addToolBtn(`🗑️ At (${selTile.isFakeOkey ? 'Sahte' : selTile.number})`, 'warn', () =>
                this.dispatchOkeyDiscard(selTile.id)
              );
            }
          }
          if (this.currentGameType === 'OKEY101' && myPlayer && !myPlayer.hasOpened && this.gameEngine.calculateHandPerPoints) {
            const pts = this.gameEngine.calculateHandPerPoints(myPlayer)?.totalPoints || 0;
            if (pts >= 101) {
              addToolBtn(`✨ 101 Aç (${pts})`, 'primary', () => this.dispatchOkey101Open());
            }
          }
        }

        if (canSort) {
          addToolBtn('📐 Seri', '', () => this.sortHandRuns());
          addToolBtn('👥 Çift', '', () => this.sortHandPairs());
          addToolBtn('🎨 Renk', '', () => this.sortHandByColor());
        }
        if (hasAI) {
          addToolBtn('🧠 AI Diz', 'ai', () => this.sortHandAI());
          if (advice) {
            addToolBtn('⚡ AI Hamle', 'ai', () => this.applyAIRecommendation());
          }
        }
        const legendEl = document.createElement('span');
        legendEl.className = 'okey-legend-pill';
        legendEl.textContent =
          this.currentGameType === 'OKEY101' ? '🟢 İşle  🔴 Ceza  🔵 Per' : '🟢 Bitir  🔴 Ceza  🔵 Per';
        toolbar.appendChild(legendEl);
      } else {
        const selCard = this.selectedCardId ? hand.find((c) => c.id === this.selectedCardId) : null;
        if (selCard) {
          const selIdx = hand.findIndex((c) => c.id === selCard.id);
          const selMeta = getCardMeta(selCard);
          const isPlayable =
            isMyTurn &&
            (this.currentGameType !== 'BATAK' || this.gameEngine.isCardPlayable(mySeat, selCard.id));
          if (isPlayable) {
            addToolBtn(`🃏 Oyna: ${selMeta.symbol} ${selMeta.suitName} ${selMeta.court || selMeta.rank}`, 'primary', () => {
              this.selectedCardId = null;
              this.dispatchPlayCard(selCard.id);
            });
          }
          if (selIdx > 0) {
            addToolBtn('◀', '', () => this.handleUserCardReorder(selCard, selIdx - 1));
          }
          if (selIdx >= 0 && selIdx < hand.length - 1) {
            addToolBtn('▶', '', () => this.handleUserCardReorder(selCard, selIdx + 1));
          }
        }

        if (canSort) {
          addToolBtn('🃏 Sırala', '', () => this.sortBatakCards());
        }
        if (hasAI && advice) {
          addToolBtn('⚡ AI Öneri', 'ai', () => this.applyAIRecommendation());
        }
      }
    }

    // 2. Render Card Tray (Batak & Pişti) or 2-Row Okey Istaka Tray (Okey & 101)
    const cardsTray = this.dom.mobileCardsTray;
    const istakaTray = this.dom.mobileIstakaTray;
    if (!cardsTray || !istakaTray) return;

    if (!isOkeyType) {
      cardsTray.style.display = 'flex';
      istakaTray.style.display = 'none';
      const isCompact = hand.length <= 6;
      cardsTray.classList.toggle('compact-hand', isCompact);
      cardsTray.classList.toggle('fanned-hand', !isCompact);
      cardsTray.innerHTML = '';

      const legalSet =
        this.currentGameType === 'BATAK' && isMyTurn
          ? new Set(this.gameEngine.getLegalCards(mySeat).map((c) => c.id))
          : null;
      const recCardId = advice?.recommendedCard?.id || null;

      hand.forEach((card) => {
        const meta = getCardMeta(card);
        const el = document.createElement('button');
        el.type = 'button';
        const isDisabled = Boolean(isMyTurn && legalSet && !legalSet.has(card.id));
        const isSelected = this.selectedCardId === card.id;
        const isRec = recCardId === card.id;

        el.className = `m-card ${meta.isRed ? 'red' : 'black'}${isDisabled ? ' disabled' : ''}${isSelected ? ' selected' : ''}${isRec ? ' recommended' : ''}`;
        el.setAttribute('aria-label', `${meta.suitName} ${meta.court || meta.rank}`);

        el.innerHTML = `
          ${isRec ? '<span class="m-card-ai-badge">AI</span>' : ''}
          <div class="m-card-face">
            <div class="m-card-corner top">
              <span class="m-card-rank">${meta.rank}</span>
              ${getSuitSvg(meta.suitId, 'm-card-suit-svg')}
            </div>
            <div class="m-card-center">
              ${getSuitSvg(meta.suitId, 'm-card-center-svg')}
              ${meta.court ? `<span class="m-card-court">${meta.court.toUpperCase()}</span>` : ''}
            </div>
            <div class="m-card-corner bottom">
              <span class="m-card-rank">${meta.rank}</span>
              ${getSuitSvg(meta.suitId, 'm-card-suit-svg')}
            </div>
          </div>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.selectedCardId === card.id) {
            if (isMyTurn) {
              if (this.currentGameType === 'BATAK' && !this.gameEngine.isCardPlayable(mySeat, card.id)) {
                soundFx.playButtonClick();
                this.appendLog('⚠️ Kural ihlali: Bu kartı oynayamazsınız!');
                return;
              }
              this.selectedCardId = null;
              this.dispatchPlayCard(card.id);
            } else {
              soundFx.playButtonClick();
              this.selectedCardId = null;
              this.renderMobileHandDock();
            }
          } else {
            soundFx.playButtonClick();
            this.selectedCardId = card.id;
            this.renderMobileHandDock();
          }
        });

        cardsTray.appendChild(el);
      });
      cardsTray.scrollLeft = prevCardScroll;
    } else {
      cardsTray.style.display = 'none';
      istakaTray.style.display = 'flex';
      syncHandIstakaSlots(hand);

      const tiers = [
        new Array(ISTAKA_SLOTS_PER_TIER).fill(null),
        new Array(ISTAKA_SLOTS_PER_TIER).fill(null),
      ];
      hand.forEach((tile, idx) => {
        const tier = tile._istakaTier === 1 ? 1 : 0;
        const slot = Math.max(0, Math.min(ISTAKA_SLOTS_PER_TIER - 1, tile._istakaSlot ?? 0));
        if (!tiers[tier][slot]) {
          tiers[tier][slot] = { tile, idx };
        }
      });

      const recTileId = advice?.bestDiscard?.tile?.id || null;
      const colorClassFor = (tile) => {
        const key = (tile.colorKey || tile.colorName || '').toString().toUpperCase();
        if (key === 'RED' || key === 'KIRMIZI') return 'color-red';
        if (key === 'BLACK' || key === 'SİYAH' || key === 'SIYAH') return 'color-black';
        if (key === 'BLUE' || key === 'MAVİ' || key === 'MAVI') return 'color-blue';
        return 'color-gold';
      };

      const rowEls = [this.dom.mobileIstakaRow0, this.dom.mobileIstakaRow1];
      const highlights = this.getOkeyTileHighlights();
      const meldActionLabel = this.currentGameType === 'OKEY101' ? 'İŞLE' : 'BİTİR';

      rowEls.forEach((rowEl, tier) => {
        if (!rowEl) return;
        rowEl.innerHTML = '';

        for (let slot = 0; slot < ISTAKA_SLOTS_PER_TIER; slot++) {
          const entry = tiers[tier][slot];
          if (entry) {
            const { tile, idx } = entry;
            const tileBtn = document.createElement('button');
            tileBtn.type = 'button';
            const isSelected = this.selectedTileIndex === idx;
            const isRec = recTileId === tile.id;
            const isRealOkey = Boolean(tile.isRealOkey);
            const isMeldable = highlights.meldIds.has(tile.id);
            const isPenaltyWarn = highlights.penaltyIds.has(tile.id);
            const isInPer = !isMeldable && !isPenaltyWarn && highlights.perIds.has(tile.id);

            tileBtn.className = `m-tile ${colorClassFor(tile)}${tile.isFakeOkey ? ' joker' : ''}${isRealOkey ? ' okey-wild' : ''}${isInPer ? ' in-per' : ''}${isMeldable ? ' meldable' : ''}${isPenaltyWarn ? ' penalty-warn' : ''}${isSelected ? ' selected' : ''}${isRec ? ' recommended' : ''}`;
            tileBtn.setAttribute(
              'aria-label',
              `${tile.colorName || ''} ${tile.isFakeOkey ? 'Sahte Okey' : tile.number}${isMeldable ? ` (${meldActionLabel})` : ''}${isPenaltyWarn ? ' (Ceza Riski)' : ''}${isInPer ? ' (Hazır Per)' : ''}`
            );
            tileBtn.innerHTML = `
              ${isRec ? '<span class="m-tile-ai-badge">AT</span>' : isRealOkey ? '<span class="m-tile-okey-badge">★</span>' : ''}
              ${isPenaltyWarn ? '<span class="m-tile-penalty-badge">CEZA</span>' : isInPer ? '<span class="m-tile-per-dot" title="Hazır Per"></span>' : ''}
              ${isMeldable ? `<span class="m-tile-meld-badge">${meldActionLabel}</span>` : ''}
              <span class="m-tile-num">${tile.isFakeOkey ? '★' : tile.number}</span>
              <span class="m-tile-dot"></span>
            `;
            tileBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.handleUserTileSelected(tile);
            });
            rowEl.appendChild(tileBtn);
          } else {
            const emptyEl = document.createElement('button');
            emptyEl.type = 'button';
            emptyEl.className = `m-slot-empty${this.selectedTileIndex !== -1 ? ' drop-ready' : ''}`;
            emptyEl.setAttribute('aria-label', `Boş slot ${tier + 1}-${slot + 1}`);
            emptyEl.addEventListener('click', (e) => {
              e.stopPropagation();
              if (this.selectedTileIndex !== -1) {
                this.handleTileDropToSlot(null, tier, slot);
              }
            });
            rowEl.appendChild(emptyEl);
          }
        }
      });
      istakaTray.scrollLeft = prevIstakaScroll;
    }
  }

  init() {
    this.scene = new VRCardScene(this.dom.container);
    this.scene.onCardSelectedCallback = this.handleUserCardSelected.bind(this);
    this.scene.onCardReorderCallback = this.handleUserCardReorder.bind(this);
    this.scene.onTileSelectedCallback = this.handleUserTileSelected.bind(this);
    this.scene.onTileDropToSlotCallback = this.handleTileDropToSlot.bind(this);
    this.scene.onTileDropToDiscardCallback = this.handleTileDropToDiscard.bind(this);
    this.scene.onCenterStackClickCallback = this.handleCenterStackClick.bind(this);
    this.scene.onSortAiCallback = () => this.sortHandAI();
    this.scene.onSortRunsCallback = () => this.sortHandRuns();
    this.scene.onSortPairsCallback = () => this.sortHandPairs();
    this.scene.onSortPhotoDemoCallback = () => this.loadPhotoDemoIstaka();
    this.scene.onSortCardsCallback = () => this.sortBatakCards();
    this.scene.onDrawDiscardCallback = () => this.dispatchOkeyDrawDiscard();
    this.scene.onAiAdviceClickCallback = () => this.applyAIRecommendation();
    this.scene.onVRMicToggleCallback = () => this.toggleMicrophone();
    this.scene.onVRSpeakerToggleCallback = () => this.toggleSpeakerMute();

    spatialVoice.attachNetwork(networkManager, (remoteClientId) => {
      const p = (networkManager.roomPlayers || []).find((x) => x.clientId === remoteClientId);
      if (!p) return 1;
      return this.toVisualSeat(p.seatIndex ?? p.seat ?? 1, networkManager.maxPlayers || 4);
    });

    spatialVoice.onMicLevel((level) => {
      if (this.dom.micMeterFill) {
        this.dom.micMeterFill.style.width = `${Math.round(level * 100)}%`;
      }
    });

    this.renderAvatarPickers();
    this.renderThemeSelector();
    this.updateVIPState();
    this.setupUIEventListeners();
    this.setupMultiplayerListeners();
    this.syncAudioUI();

    // Auto-connect WebSocket in background if server is running
    networkManager.connect().then(() => {
      if (this.currentUser?.token) networkManager.identifyUser(this.currentUser.token);
    }).catch(() => {});

    // Validate active session & sync admin-granted AI access from server
    userDb.refreshSession().then((refreshed) => {
      this.currentUser = refreshed;
      this.aiEnabled = this.hasAIAccess();
      this.updateVIPState();
      this.refreshCurrentGameViews();
      if (refreshed?.token && networkManager.serverConnected) {
        networkManager.identifyUser(refreshed.token);
      }
    }).catch(() => {});

    this.startBatakGame();
    window.addEventListener('resize', () => this.syncMobileHandMode());
    window.addEventListener('orientationchange', () => setTimeout(() => this.syncMobileHandMode(), 180));
    this.syncMobileHandMode();
  }

  // --- AUDIO / MICROPHONE / SPEAKER CONTROLS ---
  syncAudioUI() {
    const micActive = spatialVoice.isVoiceActive;
    const micMuted = spatialVoice.isMuted;
    const spMuted = spatialVoice.speakerMuted;
    const spPct = Math.round(spatialVoice.speakerVolume * 100);

    if (this.dom.btnVoice) {
      this.dom.btnVoice.classList.toggle('active', micActive && !micMuted);
    }
    if (this.dom.voiceIcon) {
      this.dom.voiceIcon.textContent = !micActive ? '🎙️' : micMuted ? '🔇' : '🎤';
    }
    if (this.dom.voiceLabel) {
      this.dom.voiceLabel.textContent = !micActive ? 'Mikrofon' : micMuted ? 'Mik Kapalı' : 'Mik Açık';
    }
    if (this.dom.btnLobbyMic) {
      this.dom.btnLobbyMic.classList.toggle('active', micActive && !micMuted);
    }
    if (this.dom.lobbyMicIcon) {
      this.dom.lobbyMicIcon.textContent = !micActive ? '🎙️' : micMuted ? '🔇' : '🎤';
    }
    if (this.dom.lobbyMicLabel) {
      this.dom.lobbyMicLabel.textContent = !micActive ? 'Mikrofonu Aç' : micMuted ? 'Mikrofon Kapalı' : 'Mikrofon Açık';
    }

    if (this.dom.soundIcon) {
      this.dom.soundIcon.textContent = spMuted || spPct === 0 ? '🔇' : '🔊';
    }
    if (this.dom.soundPct) {
      this.dom.soundPct.textContent = spMuted ? 'Sessiz' : `${spPct}%`;
    }
    if (this.dom.btnToggleSpeakerMute) {
      this.dom.btnToggleSpeakerMute.textContent = spMuted ? 'Sessiz' : 'Açık';
      this.dom.btnToggleSpeakerMute.classList.toggle('pass', spMuted);
    }
    if (this.dom.sliderSpeakerVolume) {
      this.dom.sliderSpeakerVolume.value = String(spPct);
    }
    if (this.dom.btnTestMic) {
      this.dom.btnTestMic.textContent = spatialVoice.isMicTesting ? 'Testi Durdur' : 'Test Et';
      this.dom.btnTestMic.classList.toggle('pass', spatialVoice.isMicTesting);
    }
    if (this.scene) {
      this.scene.updateVRDockAudioLabels(micActive, micMuted, spMuted);
    }
  }

  async toggleMicrophone() {
    soundFx.unlockAudio();
    if (!spatialVoice.isVoiceActive) {
      const ok = await spatialVoice.initVoiceChat();
      if (ok) {
        this.appendLog('🎙️ Mikrofon açıldı! Masadaki oyuncular sesinizi 3D olarak duyabilir.');
      } else {
        const msg = spatialVoice.lastError || 'Mikrofon erişimi sağlanamadı.';
        this.appendLog(`⚠️ ${msg}`);
        if (
          typeof window !== 'undefined' &&
          !window.isSecureContext &&
          location.hostname !== 'localhost' &&
          location.hostname !== '127.0.0.1'
        ) {
          const httpsUrl = `https://${location.hostname}:3443${location.pathname}`;
          if (confirm(`${msg}\n\nMobil cihazda mikrofonun çalışması için güvenli HTTPS adresine (${httpsUrl}) geçmek ister misiniz?`)) {
            location.href = httpsUrl;
          }
        } else if (!this.scene?.isVRActive) {
          alert(msg);
        }
      }
    } else {
      const muted = spatialVoice.toggleMute();
      this.appendLog(muted ? '🔇 Mikrofon sessize alındı.' : '🎤 Mikrofon tekrar açıldı.');
    }
    this.syncAudioUI();
  }

  toggleSpeakerMute() {
    const muted = spatialVoice.toggleSpeakerMute();
    this.appendLog(muted ? '🔇 Hoparlör sessize alındı.' : '🔊 Hoparlör açıldı.');
    this.syncAudioUI();
  }

  renderThemeSelector() {
    if (!this.dom.themeGridContainer) return;
    this.dom.themeGridContainer.innerHTML = '';
    const currentThemeId = this.scene ? this.scene.currentThemeId : 'balat';

    KIRAATHANE_THEMES.forEach((theme) => {
      const card = document.createElement('div');
      const isActive = theme.id === currentThemeId;
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
        if (this.scene) this.scene.setKiraathaneEnvironment(theme.id);
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
      AVAILABLE_AVATARS.forEach((av) => {
        const card = document.createElement('div');
        const isSelected = isCreate ? av.id === this.selectedCreateAvatar : av.id === this.selectedJoinAvatar;
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
          if (isCreate) this.selectedCreateAvatar = av.id;
          else this.selectedJoinAvatar = av.id;
          createPicker(container, isCreate);
        };
        container.appendChild(card);
      });
    };

    createPicker(this.dom.avatarPickerCreate, true);
    createPicker(this.dom.avatarPickerJoin, false);
  }

  setupUIEventListeners() {
    // Theme Modal
    this.dom.btnThemeModal?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.renderThemeSelector();
      this.dom.themeModal.classList.remove('hidden');
    });
    this.dom.btnCloseThemeModal?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.dom.themeModal.classList.add('hidden');
    });

    // User Profile / VIP Auth Modal
    this.dom.btnProfile?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.openAuthModal();
    });
    this.dom.btnCloseAuthModal?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.dom.authModal.classList.add('hidden');
    });

    this.dom.tabAuthLogin?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.dom.tabAuthLogin.classList.add('active');
      this.dom.tabAuthRegister.classList.remove('active');
      this.dom.viewAuthLogin.classList.remove('hidden');
      this.dom.viewAuthRegister.classList.add('hidden');
      if (this.dom.authMsg) this.dom.authMsg.style.display = 'none';
    });

    this.dom.tabAuthRegister?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.dom.tabAuthRegister.classList.add('active');
      this.dom.tabAuthLogin.classList.remove('active');
      this.dom.viewAuthRegister.classList.remove('hidden');
      this.dom.viewAuthLogin.classList.add('hidden');
      if (this.dom.authMsg) this.dom.authMsg.style.display = 'none';
    });

    this.dom.btnLoginSubmit?.addEventListener('click', async () => {
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
        this.aiEnabled = this.hasAIAccess();
        if (user?.token && networkManager.serverConnected) {
          networkManager.identifyUser(user.token);
        }
        this.updateVIPState();
        this.refreshCurrentGameViews();
        const notice = this.isAdminUser()
          ? '👑 Yönetici Mücahit Korkmaz girişi başarılı! Tüm oyunlarda AI Asistan ve yetki yönetimi aktif.'
          : this.hasAIAccess()
            ? '🤖 Yapay Zeka destekli üye girişi başarılı!'
            : `Hoş geldiniz ${user.name}! Giriş başarılı.`;
        this.showAuthMsg(notice, 'success');
        setTimeout(() => {
          if (this.isAdminUser()) {
            this.renderAdminUsersList();
          } else {
            this.dom.authModal.classList.add('hidden');
          }
          this.updateAIAdvisor();
        }, 700);
      } catch (err) {
        this.showAuthMsg(err.message || 'Giriş başarısız oldu.', 'error');
      } finally {
        this.dom.btnLoginSubmit.textContent = '🔐 Giriş Yap';
      }
    });

    this.dom.btnRegSubmit?.addEventListener('click', async () => {
      soundFx.playButtonClick();
      const name = (this.dom.inputRegName.value || '').trim();
      const email = (this.dom.inputRegEmail.value || '').trim();
      const pass = (this.dom.inputRegPassword.value || '').trim();
      if (!name) return this.showAuthMsg('Lütfen adınızı ve soyadınızı girin.', 'error');
      if (!email || !email.includes('@')) return this.showAuthMsg('Geçerli e-posta girin.', 'error');
      if (pass.length < 3) return this.showAuthMsg('Şifre en az 3 karakter olmalıdır.', 'error');
      try {
        this.dom.btnRegSubmit.textContent = 'Kaydediliyor...';
        const user = await userDb.registerUser(name, email, pass, 'dayi');
        this.currentUser = user;
        this.aiEnabled = this.hasAIAccess();
        if (user?.token && networkManager.serverConnected) {
          networkManager.identifyUser(user.token);
        }
        this.updateVIPState();
        this.refreshCurrentGameViews();
        const regNotice = this.isAdminUser()
          ? '👑 Yönetici üyeliği oluşturuldu! Tüm oyunlarda Yapay Zeka desteği açık.'
          : `✨ Hoş geldiniz ${name}! Üyeliğiniz oluşturuldu (otomatik dizme açık).`;
        this.showAuthMsg(regNotice, 'success');
        setTimeout(() => {
          if (this.isAdminUser()) {
            this.renderAdminUsersList();
          } else {
            this.dom.authModal.classList.add('hidden');
          }
          this.updateAIAdvisor();
        }, 700);
      } catch (err) {
        this.showAuthMsg(err.message || 'Kayıt başarısız oldu.', 'error');
      } finally {
        this.dom.btnRegSubmit.textContent = '✨ Üyeliği Oluştur ve Başla';
      }
    });

    this.dom.btnAuthLogout?.addEventListener('click', () => {
      soundFx.playButtonClick();
      userDb.clearSession();
      this.currentUser = null;
      this.aiEnabled = false;
      this.currentAdvice = null;
      this.updateVIPState();
      this.refreshCurrentGameViews();
      this.openAuthModal();
    });

    this.dom.btnRefreshAdminUsers?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.renderAdminUsersList();
    });

    this.dom.btnToggleAI?.addEventListener('click', () => {
      if (!this.isVIPUser()) return;
      soundFx.playButtonClick();
      this.aiEnabled = !this.aiEnabled;
      this.dom.btnToggleAI.classList.toggle('active', this.aiEnabled);
      this.dom.aiToggleLabel.textContent = this.aiEnabled ? 'AI Asistan' : 'AI Kapalı';
      if (this.dom.aiCoachPanel) this.dom.aiCoachPanel.style.display = this.aiEnabled ? 'block' : 'none';
      this.updateAIAdvisor();
    });

    this.dom.btnApplyAI?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.applyAIRecommendation();
    });

    this.dom.btnAISort?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.sortHandAI();
    });
    this.dom.btnMeldTiles?.addEventListener('click', () => {
      soundFx.playButtonClick();
      if (this.currentGameType === 'OKEY101') {
        this.dispatchOkey101Meld(null);
      } else if (this.currentGameType === 'OKEY') {
        const hl = this.getOkeyTileHighlights();
        const winId = Array.from(hl.winIds)[0];
        if (winId) this.dispatchOkeyDiscard(winId);
      }
    });
    this.dom.btnSortRuns?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.sortHandRuns();
    });
    this.dom.btnSortPairs?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.sortHandPairs();
    });
    this.dom.btnSortColor?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.sortHandByColor();
    });
    this.dom.btnPhotoDemo?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.loadPhotoDemoIstaka();
    });
    this.dom.btnSortCards?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.sortBatakCards();
    });

    // Game Over Actions
    this.dom.btnGameOverRestart?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.hideGameOverModal();
      if (this.isMultiplayerGuest()) {
        this.appendLog('ℹ️ Yeni oyunu masa sahibi başlatabilir.');
        return;
      }
      if (this.isMultiplayerHost()) {
        networkManager.startGame(this.currentGameType, networkManager.maxPlayers);
      }
      this.startActiveGameMode();
    });
    this.dom.btnGameOverExitVR?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.hideGameOverModal();
      this.scene.exitVR();
    });
    this.dom.btnGameOverMenu?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.hideGameOverModal();
      this.dom.menuModal.classList.remove('hidden');
    });

    // Single Player Menu
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
      [this.dom.optBatak, this.dom.optOkey101, this.dom.optOkey, this.dom.optPisti].forEach((b) =>
        b?.classList.remove('selected')
      );
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

    // Multiplayer Modal (Direct Guest & Registered Play!)
    this.dom.btnMultiplayer?.addEventListener('click', () => {
      soundFx.playButtonClick();
      const savedGuest = localStorage.getItem('vr52_guest_name');
      const fallbackName = this.currentUser?.name || savedGuest || `Oyuncu_${Math.floor(100 + Math.random() * 899)}`;
      if (this.dom.inputCreateName && (!this.dom.inputCreateName.value || this.dom.inputCreateName.value === 'Masa Sahibi')) {
        this.dom.inputCreateName.value = fallbackName;
      }
      if (this.dom.inputJoinName && (!this.dom.inputJoinName.value || this.dom.inputJoinName.value === 'Misafir Oyuncu')) {
        this.dom.inputJoinName.value = fallbackName;
      }
      if (this.dom.inputServerUrl && networkManager.customServerUrl) {
        this.dom.inputServerUrl.value = networkManager.customServerUrl;
      }
      this.dom.multiplayerModal.classList.remove('hidden');
      this.updateServerStatusBadge();
      networkManager.listRooms().then(() => this.renderPublicRoomsList()).catch(() => this.renderPublicRoomsList());
    });

    const closeMpModal = () => {
      soundFx.playButtonClick();
      this.dom.multiplayerModal.classList.add('hidden');
    };
    this.dom.btnCloseMpModal?.addEventListener('click', closeMpModal);
    this.dom.btnCloseMpModal2?.addEventListener('click', closeMpModal);

    this.dom.btnReconnectServer?.addEventListener('click', async () => {
      soundFx.playButtonClick();
      const custom = this.dom.inputServerUrl?.value || '';
      try {
        await networkManager.setServerUrl(custom);
        await networkManager.listRooms();
        this.renderPublicRoomsList();
      } catch (err) {
        this.updateServerStatusBadge(err.message);
      }
    });

    this.dom.btnRefreshRooms?.addEventListener('click', async () => {
      soundFx.playButtonClick();
      try {
        await networkManager.listRooms();
        this.renderPublicRoomsList();
      } catch {}
    });

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
        networkManager.listRooms().then(() => this.renderPublicRoomsList()).catch(() => {});
      });
    }

    // Voice / Mic & Audio Popover Controls (Works without forced login!)
    this.dom.btnVoice?.addEventListener('click', () => this.toggleMicrophone());

    this.dom.btnSound?.addEventListener('click', (e) => {
      e.stopPropagation();
      soundFx.unlockAudio();
      this.dom.audioPopover?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (this.dom.audioPopover && !this.dom.audioPopover.classList.contains('hidden')) {
        if (!e.target.closest('.audio-popover-wrap')) {
          this.dom.audioPopover.classList.add('hidden');
        }
      }
    });

    this.dom.btnToggleSpeakerMute?.addEventListener('click', () => this.toggleSpeakerMute());

    this.dom.sliderSpeakerVolume?.addEventListener('input', (e) => {
      const val = Number(e.target.value) / 100;
      spatialVoice.setSpeakerVolume(val);
      this.syncAudioUI();
    });

    this.dom.btnTestMic?.addEventListener('click', async () => {
      soundFx.unlockAudio();
      const testing = await spatialVoice.toggleMicTest();
      if (!testing && spatialVoice.lastError) {
        alert(spatialVoice.lastError);
      } else {
        this.appendLog(testing ? '🔊 Mikrofon testi açık (kendi sesinizi hoparlörden duyuyorsunuz).' : '⏹️ Mikrofon testi durduruldu.');
      }
      this.syncAudioUI();
    });

    // PWA Install Handler
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      });
    }

    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (this.dom.btnInstallPwa) this.dom.btnInstallPwa.style.display = 'inline-flex';
    });

    this.dom.btnInstallPwa?.addEventListener('click', async () => {
      soundFx.playButtonClick();
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') this.dom.btnInstallPwa.style.display = 'none';
        deferredPrompt = null;
      }
    });

    // Multiplayer Game & Player Count Selectors
    document.querySelectorAll('.mp-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        soundFx.playButtonClick();
        document.querySelectorAll('.mp-choice-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedCreateGame = btn.dataset.game;
      });
    });

    document.querySelectorAll('.mp-count-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        soundFx.playButtonClick();
        document.querySelectorAll('.mp-count-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedCreateCount = parseInt(btn.dataset.count, 10);
      });
    });

    this.dom.btnSubmitCreateRoom?.addEventListener('click', async () => {
      soundFx.playButtonClick();
      const playerName = (this.dom.inputCreateName.value || '').trim() || 'Masa Sahibi';
      localStorage.setItem('vr52_guest_name', playerName);
      const password = this.dom.inputCreatePassword.value || '';
      try {
        this.dom.btnSubmitCreateRoom.textContent = 'Oda Kuruluyor...';
        await networkManager.createRoom({
          gameType: this.selectedCreateGame,
          maxPlayers: this.selectedCreateCount,
          password,
          playerName,
          avatarId: this.selectedCreateAvatar,
          isVip: this.isVIPUser(),
        });
        this.dom.multiplayerModal.classList.add('hidden');
        this.showLobbyModal();
        spatialVoice.syncPeersWithRoom(networkManager.roomPlayers);
        if (typeof window !== 'undefined' && window.isSecureContext && !spatialVoice.isVoiceActive) {
          spatialVoice.initVoiceChat().then(() => this.syncAudioUI()).catch(() => {});
        }
      } catch (err) {
        alert(`Oda oluşturulamadı: ${err.message}`);
      } finally {
        this.dom.btnSubmitCreateRoom.textContent = '🚀 Odayı Oluştur';
      }
    });

    this.dom.btnSubmitJoinRoom?.addEventListener('click', async () => {
      soundFx.playButtonClick();
      const roomCode = this.dom.inputJoinCode.value.trim();
      const password = this.dom.inputJoinPassword.value.trim();
      const playerName = (this.dom.inputJoinName.value || '').trim() || 'Misafir';
      localStorage.setItem('vr52_guest_name', playerName);

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
          avatarId: this.selectedJoinAvatar,
          isVip: this.isVIPUser(),
        });
        this.dom.multiplayerModal.classList.add('hidden');
        this.showLobbyModal();
        spatialVoice.syncPeersWithRoom(networkManager.roomPlayers);
        if (typeof window !== 'undefined' && window.isSecureContext && !spatialVoice.isVoiceActive) {
          spatialVoice.initVoiceChat().then(() => this.syncAudioUI()).catch(() => {});
        }
      } catch (err) {
        alert(`Odaya bağlanılamadı: ${err.message}`);
      } finally {
        this.dom.btnSubmitJoinRoom.textContent = '🔗 Odaya Bağlan';
      }
    });

    this.dom.btnCopyCode?.addEventListener('click', () => {
      soundFx.playButtonClick();
      if (networkManager.roomCode) {
        navigator.clipboard?.writeText(networkManager.roomCode).catch(() => {});
        this.dom.btnCopyCode.textContent = 'Kopyalandı!';
        setTimeout(() => {
          this.dom.btnCopyCode.textContent = 'Kopyala';
        }, 1500);
      }
    });

    // Lobby Start Game (Host only)
    this.dom.btnLobbyStartGame?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.dom.lobbyModal.classList.add('hidden');
      this.currentGameType = networkManager.gameType;
      networkManager.startGame(networkManager.gameType, networkManager.maxPlayers);
      this.startActiveGameMode();
    });

    // Lobby Mic & Leave
    this.dom.btnLobbyMic?.addEventListener('click', () => this.toggleMicrophone());
    this.dom.btnLobbyLeave?.addEventListener('click', () => {
      soundFx.playButtonClick();
      networkManager.leaveRoom();
      spatialVoice.closeAllPeers();
      this.dom.lobbyModal.classList.add('hidden');
      this.appendLog('Odadan ayrıldınız.');
    });

    // Ambiance toggle
    this.dom.btnAmbiance.addEventListener('click', () => {
      const nextState = !soundFx.ambianceEnabled;
      soundFx.setAmbiance(nextState);
      this.dom.ambianceIcon.textContent = nextState ? '☕' : '🔇';
      soundFx.playButtonClick();
    });

    // Summon walking Çaycı Hüseyin ("Çaylarrrrrrr!")
    this.dom.btnOrderTea?.addEventListener('click', () => {
      soundFx.unlockAudio();
      soundFx.playButtonClick();
      this.scene?.summonCayciForTea();
    });

    // Mobile hamburger drawer & log visibility toggle
    this.dom.btnMobileMenu?.addEventListener('click', (e) => {
      e.stopPropagation();
      soundFx.playButtonClick();
      this.dom.audioPopover?.classList.add('hidden');
      this.dom.secondaryControls?.classList.toggle('open');
    });

    this.dom.btnToggleLog?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.dom.gameLogBox?.classList.toggle('mobile-open');
    });

    document.addEventListener('click', (e) => {
      if (this.dom.secondaryControls?.classList.contains('open')) {
        if (!e.target.closest('.top-controls')) {
          this.dom.secondaryControls.classList.remove('open');
        }
      }
    });

    this.dom.secondaryControls?.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.dom.secondaryControls?.classList.remove('open');
      });
    });

    // Scoreboard toggle & Leave game before completion
    this.dom.btnScoreboard?.addEventListener('click', () => {
      soundFx.playButtonClick();
      if (!this.dom.scoreboardPanel) return;
      const willShow = this.dom.scoreboardPanel.classList.contains('hidden');
      this.dom.scoreboardPanel.classList.toggle('hidden', !willShow);
      if (willShow) this.renderScoreboard();
    });

    this.dom.btnCloseScoreboard?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.dom.scoreboardPanel?.classList.add('hidden');
    });

    this.dom.btnLeaveGame?.addEventListener('click', () => {
      soundFx.playButtonClick();
      this.leaveCurrentGame();
    });

    // New Hand button
    this.dom.btnNewHand.addEventListener('click', () => {
      soundFx.playButtonClick();
      if (this.isMultiplayerGuest()) {
        this.appendLog('ℹ️ Yeni eli sadece masa sahibi başlatabilir.');
        return;
      }
      if (this.gameEngine) {
        this.hideActionPanel();
        this.gameEngine.startNewRound();
      }
    });
  }

  updateServerStatusBadge(errorHint = null) {
    if (!this.dom.mpServerStatus) return;
    if (networkManager.serverStatus === 'connected' && networkManager.transportMode === 'p2p') {
      this.dom.mpServerStatus.textContent = '🟢 Bulut P2P Bağlı (Mobil & Quest 3 Sunucusuz Oda Hazır)';
      this.dom.mpServerStatus.style.color = '#4ade80';
    } else if (networkManager.serverStatus === 'connected') {
      this.dom.mpServerStatus.textContent = `🟢 Sunucu Bağlı (${networkManager.clientId})`;
      this.dom.mpServerStatus.style.color = '#4ade80';
    } else if (networkManager.serverStatus === 'connecting') {
      this.dom.mpServerStatus.textContent = '🟡 Bağlanılıyor...';
      this.dom.mpServerStatus.style.color = '#facc15';
    } else {
      this.dom.mpServerStatus.textContent = errorHint
        ? `🔴 Bağlantı Yok (${errorHint})`
        : '🔴 Özel Sunucuya Ulaşılamadı (Boş bırakıp Bağlan derseniz Bulut P2P açılır)';
      this.dom.mpServerStatus.style.color = '#f87171';
    }
  }

  renderPublicRoomsList() {
    if (!this.dom.mpPublicRoomsList) return;
    const rooms = networkManager.publicRooms || [];
    if (rooms.length === 0) {
      if (networkManager.transportMode === 'p2p') {
        this.dom.mpPublicRoomsList.innerHTML =
          '<div style="color:#93c5fd; font-size:0.82rem; padding:8px; line-height:1.45;">🌐 <strong>Bulut P2P Modu Aktif:</strong> Ek sunucu gerekmeden <strong>Oda Kur</strong> sekmesinden 4 haneli kod oluşturup arkadaşınıza verebilir veya size verilen kodu aşağıya yazarak Mobil / Quest 3\'ten katılabilirsiniz.</div>';
      } else {
        this.dom.mpPublicRoomsList.innerHTML =
          '<div style="color:#94a3b8; font-size:0.82rem; padding:8px;">Şu anda açık masa yok. Oda Kur sekmesinden yeni masa açabilirsiniz.</div>';
      }
      return;
    }

    const gameNames = { BATAK: '♠️ Batak', OKEY101: '💯 101', OKEY: '🀄 Okey', PISTI: '🃏 Pişti' };
    this.dom.mpPublicRoomsList.innerHTML = '';
    rooms.forEach((r) => {
      const row = document.createElement('div');
      row.className = 'mp-room-item';
      row.innerHTML = `
        <span><strong>${r.code}</strong> • ${gameNames[r.gameType] || r.gameType} • ${r.hostName}</span>
        <span style="color:${r.started ? '#f87171' : '#4ade80'}; font-weight:700;">
          ${r.hasPassword ? '🔒 ' : ''}${r.playerCount}/${r.maxPlayers} ${r.started ? '(Başladı)' : 'Katıl'}
        </span>
      `;
      row.onclick = () => {
        soundFx.playButtonClick();
        if (this.dom.inputJoinCode) this.dom.inputJoinCode.value = r.code;
      };
      this.dom.mpPublicRoomsList.appendChild(row);
    });
  }

  setupMultiplayerListeners() {
    networkManager.onEvent((event, data) => {
      if (event === 'connection_status') {
        this.updateServerStatusBadge(data.error);
        if (data.status === 'connected' && this.currentUser?.token) {
          networkManager.identifyUser(this.currentUser.token);
        }
      } else if (event === 'ai_access_updated') {
        if (data.email && this.currentUser?.email?.toLowerCase() === data.email.toLowerCase()) {
          this.currentUser.aiAccess = Boolean(data.aiAccess);
          userDb.saveSession(this.currentUser);
          this.aiEnabled = this.hasAIAccess();
          this.updateVIPState();
          this.refreshCurrentGameViews();
          this.appendLog(
            this.hasAIAccess()
              ? '🤖 Yönetici tarafından hesabınıza Yapay Zeka desteği yetkisi tanımlandı!'
              : '🔒 Hesabınızdaki Yapay Zeka desteği yetkisi yönetici tarafından kaldırıldı.'
          );
        }
      } else if (event === 'rooms_list') {
        this.renderPublicRoomsList();
      } else if (event === 'room_updated') {
        this.renderLobbySlots();
        spatialVoice.syncPeersWithRoom(data.players);
      } else if (event === 'host_changed') {
        if (data.isMeHost) {
          this.appendLog('👑 Önceki masa sahibi ayrıldığı için masa yönetimi size geçti!');
          if (this.gameEngine) {
            this.syncHostStateToGuests({ type: 'host_sync' });
          }
        }
        this.renderLobbySlots();
      } else if (event === 'player_disconnected') {
        this.appendLog(`⚠️ ${data.playerName || 'Bir oyuncu'} masadan ayrıldı. Koltuğu bot devraldı.`);
        if (this.isMultiplayerHost() && this.gameEngine && typeof data.seatIndex === 'number') {
          const p = this.gameEngine.players[data.seatIndex];
          if (p) {
            p.isBot = true;
            p.name = `${p.name} (Bot)`;
            if (this.gameEngine.gameState === 'BIDDING' && this.gameEngine.bidTurn === p.id) {
              this.gameEngine.checkBidTurn?.();
            } else {
              this.gameEngine.checkTurnAction?.();
            }
            this.syncHostStateToGuests({ type: 'player_bot_takeover', seatIndex: p.id });
            this.refreshCurrentGameViews();
          }
        }
        this.renderLobbySlots();
      } else if (event === 'host_disconnected') {
        this.appendLog(`⚠️ ${data.message || 'Sunucu bağlantısı kesildi.'}`);
      } else if (event === 'game_started_by_host') {
        this.dom.lobbyModal.classList.add('hidden');
        this.currentGameType = data.gameType || networkManager.gameType;
        if (!networkManager.isHost) {
          this.prepareGuestGameView(this.currentGameType);
        }
      } else if (event === 'network_action') {
        this.handleHostIncomingPlayerAction(data);
      } else if (event === 'game_state') {
        if (!networkManager.isHost) {
          this.applyRemoteGameSnapshot(data.snapshot, data.event);
        }
      }
    });
  }

  // --- HOST RECEIVES ACTION FROM REMOTE GUEST ---
  handleHostIncomingPlayerAction(pkt) {
    if (!this.isMultiplayerHost() || !this.gameEngine) return;
    const seat = pkt.fromSeat;
    const action = pkt.actionType;
    const payload = pkt.payload || {};

    switch (action) {
      case 'BATAK_BID':
        this.gameEngine.submitBid?.(seat, Number(payload.bid) || 0);
        break;
      case 'BATAK_TRUMP':
        this.gameEngine.setTrump?.(seat, payload.suit);
        break;
      case 'PLAY_CARD':
        this.gameEngine.playCard?.(seat, payload.cardId);
        break;
      case 'DRAW_STACK':
        this.gameEngine.drawFromStack?.(seat);
        break;
      case 'DRAW_DISCARD':
        this.gameEngine.drawFromDiscard?.(seat);
        break;
      case 'DISCARD_TILE':
        this.gameEngine.discardTile?.(seat, payload.tileId);
        break;
      case 'OPEN_101':
        this.gameEngine.openHand?.(seat);
        break;
      case 'MELD_TILE':
        if (payload.tileId) {
          this.gameEngine.meldTile?.(seat, payload.tileId, payload.perIndex);
        } else {
          this.gameEngine.meldAllPossible?.(seat);
        }
        break;
    }
  }

  syncHostStateToGuests(eventMeta = null) {
    if (!this.isMultiplayerHost() || !this.gameEngine?.getSnapshot) return;
    networkManager.broadcastGameState(this.gameEngine.getSnapshot(), eventMeta);
  }

  // --- GUEST INITIALIZES LOCAL VIEW BEFORE RECEIVING FIRST SNAPSHOT ---
  prepareGuestGameView(gameType) {
    this.resetActiveEngine();
    this.currentGameType = gameType;
    this.scene.setGameModeView(gameType);

    if (gameType === 'BATAK') {
      this.dom.hudGameName.textContent = 'İhaleli Batak (Çok Oyunculu)';
      this.dom.trumpContainer.style.display = 'flex';
      this.dom.trumpInfoLabel.textContent = 'Koz';
      this.gameEngine = new BatakGameEngine('IHALELI', 10);
      if (this.dom.scoreboardPanel && window.innerWidth > 960) {
        this.dom.scoreboardPanel.classList.remove('hidden');
      }
    } else if (gameType === 'OKEY101') {
      this.dom.hudGameName.textContent = '101 Okey (Çok Oyunculu)';
      this.dom.trumpContainer.style.display = 'flex';
      this.dom.trumpInfoLabel.textContent = 'Okey';
      this.gameEngine = new Okey101GameEngine(3);
    } else if (gameType === 'OKEY') {
      this.dom.hudGameName.textContent = 'Klasik Okey (Çok Oyunculu)';
      this.dom.trumpContainer.style.display = 'flex';
      this.dom.trumpInfoLabel.textContent = 'Okey';
      this.gameEngine = new OkeyGameEngine('KLASIK', 20);
    } else {
      this.dom.hudGameName.textContent = 'Pişti (Çok Oyunculu)';
      this.dom.trumpContainer.style.display = 'none';
      const maxP = networkManager.maxPlayers || 2;
      this.gameEngine = new PistiGameEngine(maxP, 101);
    }

    this.updateGameControls(gameType);
    this.dom.hudStatus.textContent = 'Masa sahibinden veri bekleniyor...';
  }

  // --- GUEST APPLIES AUTHORITATIVE STATE FROM HOST ---
  applyRemoteGameSnapshot(snapshot, evt = null) {
    if (!snapshot) return;
    if (!this.gameEngine || this.currentGameType !== snapshot.gameType) {
      this.prepareGuestGameView(snapshot.gameType);
    }

    const prevMyHand = this.getMyPlayer()?.hand ? [...this.getMyPlayer().hand] : [];
    const wasRoundWinnerShown = this.gameEngine.gameState === 'GAME_OVER';

    this.gameEngine.applySnapshot(snapshot);

    // Preserve guest's manual Istaka slot positions!
    if (this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') {
      const myPlayer = this.getMyPlayer();
      if (myPlayer) {
        syncHandIstakaSlots(myPlayer.hand, prevMyHand);
      }
    }

    // Visual avatars mapped relative to guest's seated viewpoint
    const visualPlayers = this.toVisualArray(this.gameEngine.players).map((p, i) =>
      p || { name: `Oyuncu ${i + 1}`, avatarId: 'dayi' }
    );
    this.scene.updateTableAvatars(visualPlayers);
    spatialVoice.syncPeersWithRoom(networkManager.roomPlayers);

    // Trigger remote animations / sounds cleanly
    if (evt?.type === 'deal_complete' || evt?.type === 'table_deal') {
      this.clearPlayedFeed();
      if (evt?.type === 'table_deal' && this.currentGameType === 'PISTI' && this.gameEngine.tableCards?.length > 0) {
        const topTable = this.gameEngine.tableCards[this.gameEngine.tableCards.length - 1];
        this.recordPlayedMove(0, topTable.card || topTable, 'card', 'Ortada');
      }
    } else if (evt?.type === 'card_played' && evt.card) {
      this.recordPlayedMove(evt.playerIndex, evt.card, 'card');
    } else if (evt?.type === 'tile_discarded' && evt.tile) {
      this.recordPlayedMove(evt.playerIndex, evt.tile, 'tile');
    }
    if (evt?.type === 'deal_complete') {
      soundFx.playCardShuffle();
      this.hideGameOverModal();
    } else if (evt?.type === 'trump_chosen') {
      soundFx.playTrumpFanfare();
    } else if (evt?.type === 'pisti_event') {
      soundFx.playPistiChime();
      this.triggerVictoryCelebration(0.5);
    } else if (evt?.type === 'tile_drawn') {
      soundFx.playOkeyTileSlide();
    } else if (evt?.type === 'hand_opened' || evt?.type === 'tile_melded') {
      if (evt.type === 'hand_opened') soundFx.playTrumpFanfare();
      else soundFx.playOkeyTileSlide();
    } else if (evt?.type === 'penalty_incurred') {
      soundFx.playButtonClick();
      if (evt.playerIndex === this.getMySeat()) {
        this.appendLog(`🚨 CEZA (+${evt.points} Puan): ${evt.reason}`);
      }
    } else if (evt?.type === 'card_played' && evt.card) {
      const vSeat = this.toVisualSeat(evt.playerIndex);
      if (vSeat !== 0) {
        this.scene.animateCardPlay(evt.card, vSeat, null, () => this.refreshCurrentGameViews());
      }
    } else if (evt?.type === 'tile_discarded' && evt.tile) {
      const vSeat = this.toVisualSeat(evt.playerIndex);
      if (vSeat !== 0) {
        this.scene.animateTileDiscard(evt.tile, vSeat, () => this.renderOkeyDiscardsHelper());
      }
    } else if (evt?.type === 'match_winner' && evt.winner && !wasRoundWinnerShown) {
      soundFx.playOkeyWinSlam();
      this.triggerVictoryCelebration(1.0);
      this.showGameOverModal({
        winnerName: evt.winner.name,
        details: `${this.currentGameType} karşılaşması tamamlandı! Şampiyon: ${evt.winner.name}`,
        gameType: this.currentGameType,
      });
    }

    this.refreshCurrentGameViews();
  }

  refreshCurrentGameViews() {
    if (!this.gameEngine) return;
    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();

    if (this.currentGameType === 'BATAK') {
      const suit = SUITS[this.gameEngine.trumpSuit] || SUITS.S;
      this.dom.hudTrump.innerHTML = `<span style="color:${suit.isRed ? '#ef4444' : '#60a5fa'}">${suit.symbol} ${suit.name}</span>`;
      const isMyTurn = this.gameEngine.gameState === 'PLAYING' && this.gameEngine.currentTurn === mySeat;
      const legalIds = isMyTurn ? this.gameEngine.getLegalCards(mySeat).map((c) => c.id) : null;
      const recId = this.hasAIAccess() && this.aiEnabled ? this.currentAdvice?.recommendedCard?.id || null : null;
      this.scene.renderPlayerHand(myPlayer?.hand || [], legalIds, recId);
      this.scene.renderOpponentHands(this.toVisualArray(this.gameEngine.players));
      const visualTrick = (this.gameEngine.currentTrick || []).map((tc) => ({
        ...tc,
        playerIndex: this.toVisualSeat(tc.playerIndex, 4),
      }));
      this.scene.renderTableCards(visualTrick);
      this.updateBatakHUD();

      if (this.gameEngine.gameState === 'BIDDING' && this.gameEngine.bidTurn === mySeat) {
        this.showBatakBiddingUI(this.gameEngine.highestBid);
        this.scene.showBiddingButtonsInVR(this.gameEngine.highestBid, (bid) => {
          this.dispatchBatakBid(bid);
          this.hideActionPanel();
        });
      } else if (this.gameEngine.gameState === 'CHOOSE_TRUMP' && this.gameEngine.highestBidderIndex === mySeat) {
        this.showTrumpSelectionUI();
        this.scene.showTrumpSelectionButtonsInVR((s) => {
          this.dispatchBatakTrump(s);
          this.hideActionPanel();
        });
      } else if (this.gameEngine.gameState === 'ROUND_OVER') {
        this.showBatakRoundEndUI();
      } else {
        this.hideActionPanel();
        this.scene.clearVRButtons();
      }
    } else if (this.currentGameType === 'PISTI') {
      const total = this.getTotalPlayersCount();
      const recId = this.hasAIAccess() && this.aiEnabled ? this.currentAdvice?.recommendedCard?.id || null : null;
      this.scene.renderPlayerHand(myPlayer?.hand || [], null, recId);
      this.scene.renderOpponentHands(this.toVisualArray(this.gameEngine.players));
      const visualTable = (this.gameEngine.tableCards || []).map((tc) => ({
        ...tc,
        playerIndex: tc.playerIndex !== undefined ? this.toVisualSeat(tc.playerIndex, total) : undefined,
      }));
      this.scene.renderTableCards(visualTable);
      this.updatePistiHUD();
    } else if (this.currentGameType === 'OKEY') {
      const okey = this.gameEngine.okeyTileInfo;
      if (okey) {
        this.dom.hudTrump.innerHTML = `<span style="color:${okey.colorHex}">★ ${okey.colorName} ${okey.number}</span>`;
      }
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.renderOpponentIstakas(this.toVisualArray(this.gameEngine.players));
      this.scene.renderCenterOkeyStack(this.gameEngine.drawStack.length, this.gameEngine.gostergeTile);
      this.renderOkeyDiscardsHelper();
      this.updateOkeyHUD();

      if (this.gameEngine.currentTurn === mySeat && this.gameEngine.turnPhase === 'DRAW') {
        this.showOkeyDrawUI();
      } else {
        this.hideActionPanel();
        this.scene.clearVRButtons();
      }
    } else if (this.currentGameType === 'OKEY101') {
      const okey = this.gameEngine.okeyTileInfo;
      if (okey) {
        this.dom.hudTrump.innerHTML = `<span style="color:${okey.colorHex}">★ ${okey.colorName} ${okey.number}</span>`;
      }
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.renderOpponentIstakas(this.toVisualArray(this.gameEngine.players));
      this.scene.renderCenterOkeyStack(this.gameEngine.drawStack.length, this.gameEngine.gostergeTile);
      this.renderOkeyDiscardsHelper();
      this.scene.render101OpenedPers(this.gameEngine.tableOpenedPers || []);
      this.updateOkey101HUD();

      if (this.gameEngine.currentTurn === mySeat && this.gameEngine.turnPhase === 'DRAW') {
        this.showOkey101DrawUI(true);
      } else if (this.gameEngine.currentTurn === mySeat && this.gameEngine.turnPhase === 'DISCARD') {
        const { totalPoints } = this.gameEngine.calculateHandPerPoints(myPlayer);
        this.showOkey101DiscardUI(!myPlayer.hasOpened && totalPoints >= 101);
      } else {
        this.hideActionPanel();
        this.scene.clearVRButtons();
      }
    }

    this.updateAIAdvisor();
  }

  // --- DISPATCHERS (Works identically for Solo, Multiplayer Host, and Multiplayer Guest) ---
  dispatchBatakBid(bidVal) {
    const mySeat = this.getMySeat();
    if (this.isMultiplayerGuest()) {
      networkManager.sendPlayerAction('BATAK_BID', { bid: bidVal });
    } else {
      this.gameEngine?.submitBid(mySeat, bidVal);
    }
  }

  dispatchBatakTrump(suit) {
    const mySeat = this.getMySeat();
    if (this.isMultiplayerGuest()) {
      networkManager.sendPlayerAction('BATAK_TRUMP', { suit });
    } else {
      this.gameEngine?.setTrump(mySeat, suit);
    }
  }

  dispatchPlayCard(cardId) {
    const mySeat = this.getMySeat();
    if (this.isMultiplayerGuest()) {
      networkManager.sendPlayerAction('PLAY_CARD', { cardId });
    } else {
      this.gameEngine?.playCard(mySeat, cardId);
    }
  }

  dispatchOkeyDrawStack() {
    const mySeat = this.getMySeat();
    if (this.isMultiplayerGuest()) {
      networkManager.sendPlayerAction('DRAW_STACK', {});
    } else {
      this.gameEngine?.drawFromStack(mySeat);
    }
    this.hideActionPanel();
  }

  dispatchOkeyDrawDiscard() {
    const mySeat = this.getMySeat();
    if (this.isMultiplayerGuest()) {
      networkManager.sendPlayerAction('DRAW_DISCARD', {});
    } else {
      this.gameEngine?.drawFromDiscard(mySeat);
    }
    this.hideActionPanel();
  }

  dispatchOkeyDiscard(tileId) {
    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();
    const tileObj = myPlayer?.hand?.find((t) => t.id === tileId);
    if (
      (this.currentGameType === 'OKEY101' || this.currentGameType === 'OKEY') &&
      tileObj &&
      this.gameEngine?.getDiscardPenaltyInfo &&
      !this.scene?.isVRActive
    ) {
      const info = this.gameEngine.getDiscardPenaltyInfo(mySeat, tileObj);
      if (info?.willPenalize) {
        const proceed = confirm(
          `⚠️ DİKKAT (+${info.penaltyPoints} CEZA): ${info.reason}\n\nYine de bu taşı atmak istiyor musunuz?`
        );
        if (!proceed) return;
      }
    }
    this.setSelectedTile(-1);
    if (this.isMultiplayerGuest()) {
      networkManager.sendPlayerAction('DISCARD_TILE', { tileId });
    } else {
      this.gameEngine?.discardTile(mySeat, tileId);
    }
    this.hideActionPanel();
  }

  dispatchOkey101Open() {
    const mySeat = this.getMySeat();
    if (this.isMultiplayerGuest()) {
      networkManager.sendPlayerAction('OPEN_101', {});
    } else {
      this.gameEngine?.openHand(mySeat);
    }
    this.hideActionPanel();
  }

  dispatchOkey101Meld(tileId = null, perIndex = null) {
    if (this.currentGameType !== 'OKEY101' || !this.gameEngine) return;
    const mySeat = this.getMySeat();
    this.setSelectedTile(-1);
    if (this.isMultiplayerGuest()) {
      networkManager.sendPlayerAction('MELD_TILE', { tileId, perIndex });
    } else if (tileId) {
      this.gameEngine.meldTile?.(mySeat, tileId, perIndex);
    } else {
      this.gameEngine.meldAllPossible?.(mySeat);
    }
    this.hideActionPanel();
  }

  showLobbyModal() {
    this.dom.lobbyModal.classList.remove('hidden');
    this.dom.lobbyCodeDisplay.textContent = networkManager.roomCode;
    const gameTitles = { BATAK: 'İhaleli Batak', OKEY101: '101 Okey', OKEY: 'Klasik Okey', PISTI: 'Pişti' };
    this.dom.lobbyGameTag.textContent = `${gameTitles[networkManager.gameType] || networkManager.gameType} • ${networkManager.maxPlayers} Kişilik`;

    if (this.dom.btnLobbyStartGame) {
      this.dom.btnLobbyStartGame.style.display = networkManager.isHost ? 'inline-flex' : 'none';
    }
    this.renderLobbySlots();
  }

  renderLobbySlots() {
    if (!this.dom.lobbyPlayersGrid) return;
    this.dom.lobbyPlayersGrid.innerHTML = '';

    const max = networkManager.maxPlayers || 4;
    const players = networkManager.roomPlayers || [];

    for (let s = 0; s < max; s++) {
      const p = players.find((player) => (player.seatIndex ?? player.seat) === s);
      const slot = document.createElement('div');

      if (p) {
        const avObj = AVAILABLE_AVATARS.find((a) => a.id === p.avatarId) || AVAILABLE_AVATARS[0];
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
    this.hideGameOverModal();
    if (this.currentGameType === 'BATAK') this.startBatakGame();
    else if (this.currentGameType === 'OKEY101') this.startOkey101Game();
    else if (this.currentGameType === 'OKEY') this.startOkeyGame();
    else this.startPistiGame();
  }

  getActiveSeatedPlayers(count = 4) {
    const defaultBots = [
      { name: 'Ahmet Dayı', avatarId: 'dayi' },
      { name: 'Hayrettin Abi', avatarId: 'hayrettin' },
      { name: 'Serdar Bey', avatarId: 'serdar' },
      { name: 'Ayşe Hanım', avatarId: 'ayse' },
    ];

    const result = [];
    for (let i = 0; i < count; i++) {
      if (networkManager.isConnected && networkManager.roomPlayers) {
        const mpPlayer = networkManager.roomPlayers.find((p) => (p.seatIndex ?? p.seat) === i);
        if (mpPlayer) {
          result.push({
            name: mpPlayer.name,
            avatarId: mpPlayer.avatarId || 'dayi',
            isBot: false,
            clientId: mpPlayer.clientId,
            isLocal: i === networkManager.localPlayerId,
          });
          continue;
        }
        // Empty multiplayer seat -> Bot
        const bot = defaultBots[i % defaultBots.length];
        result.push({
          name: `${bot.name} (Bot)`,
          avatarId: bot.avatarId,
          isBot: true,
          isLocal: false,
        });
        continue;
      }

      if (i === 0) {
        result.push({
          name: this.currentUser?.name || localStorage.getItem('vr52_guest_name') || 'Siz',
          avatarId: this.selectedCreateAvatar || 'dayi',
          isBot: false,
          isLocal: true,
        });
      } else {
        const bot = defaultBots[(i - 1) % defaultBots.length];
        result.push({
          name: bot.name,
          avatarId: bot.avatarId,
          isBot: true,
          isLocal: false,
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
    if (this.scene) this.scene.resetSceneObjects();
    this.setSelectedTile(-1);
    this.clearPlayedFeed();
  }

  // --- LIVE PLAYED CARDS / TILES FEED (Web, Mobile & VR HUD) ---
  clearPlayedFeed() {
    this.playedFeed = [];
    this.renderPlayedCardsFeed();
  }

  recordPlayedMove(playerIndex, item, kind = 'card', overrideName = null) {
    if (!item) return;
    if (!Array.isArray(this.playedFeed)) this.playedFeed = [];
    if (this.currentGameType === 'BATAK' && this.playedFeed.length >= 4) {
      this.playedFeed = [];
    }
    const isMe = !overrideName && playerIndex === this.getMySeat();
    const rawName = this.gameEngine?.players?.[playerIndex]?.name || `Oyuncu ${Number(playerIndex) + 1}`;
    const name = overrideName || (isMe ? 'Siz' : String(rawName).replace(/\s*\(Bot\)/i, ''));

    let label = '';
    let colorCls = 'black';
    let suitId = null;
    if (kind === 'card') {
      const meta = getCardMeta(item);
      label = `${meta.suitName} ${meta.court || meta.rank}`;
      colorCls = meta.isRed ? 'red' : 'black';
      suitId = meta.suitId;
    } else {
      const key = String(item.colorKey || '').toUpperCase();
      colorCls = key === 'RED' ? 'red' : key === 'BLUE' ? 'blue' : key === 'BLACK' ? 'black' : 'gold';
      label = `${item.colorName || ''} ${item.isFakeOkey ? 'Sahte Okey' : item.number}`.trim();
    }

    this.playedFeed.push({ name, label, colorCls, suitId });
    const maxItems = this.currentGameType === 'PISTI' ? 3 : 4;
    while (this.playedFeed.length > maxItems) this.playedFeed.shift();
    this.renderPlayedCardsFeed();
  }

  renderPlayedCardsFeed() {
    const feed = this.dom.playedCardsFeed;
    const items = Array.isArray(this.playedFeed) ? this.playedFeed : [];
    const summary = items.map((m) => `${m.name}: ${m.label}`).join('  •  ');
    if (this.scene?.setPlayedSummary) this.scene.setPlayedSummary(summary);
    if (!feed) return;
    if (items.length === 0) {
      feed.style.display = 'none';
      feed.innerHTML = '';
      return;
    }
    const isOkey = this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101';
    const title = isOkey ? 'Son Atılan Taşlar' : 'Son Atılan Kartlar';
    feed.innerHTML =
      `<span class="played-feed-title">${title}:</span>` +
      items
        .map((m, idx) => {
          const svg = m.suitId ? getSuitSvg(m.suitId, 'played-chip-svg') : '';
          const latest = idx === items.length - 1 ? ' latest' : '';
          return `<span class="played-card-chip${latest}"><span class="played-chip-player">${m.name}</span><span class="played-chip-badge ${m.colorCls}">${svg}${m.label}</span></span>`;
        })
        .join('');
    feed.style.display = 'flex';
  }

  getOkeyTileHighlights() {
    const meldIds = new Set();
    const penaltyIds = new Set();
    const perIds = new Set();
    const winIds = new Set();
    const penaltyMap = new Map();

    if (!this.gameEngine || (this.currentGameType !== 'OKEY' && this.currentGameType !== 'OKEY101')) {
      return { meldIds, penaltyIds, perIds, winIds, penaltyMap };
    }

    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();
    if (!myPlayer || !Array.isArray(myPlayer.hand)) {
      return { meldIds, penaltyIds, perIds, winIds, penaltyMap };
    }

    if (typeof this.gameEngine.findPerTileIds === 'function') {
      const pSet = this.gameEngine.findPerTileIds(mySeat);
      if (pSet) pSet.forEach((id) => perIds.add(id));
    }

    if (this.currentGameType === 'OKEY101') {
      if (myPlayer.hasOpened && typeof this.gameEngine.findMeldableTiles === 'function') {
        this.gameEngine.findMeldableTiles(mySeat).forEach((m) => meldIds.add(m.tile.id));
      }
    } else if (this.currentGameType === 'OKEY' && typeof this.gameEngine.findWinningDiscardTiles === 'function') {
      this.gameEngine.findWinningDiscardTiles(mySeat).forEach((t) => {
        winIds.add(t.id);
        meldIds.add(t.id);
      });
    }

    if (typeof this.gameEngine.getDiscardPenaltyInfo === 'function') {
      for (const tile of myPlayer.hand) {
        const info = this.gameEngine.getDiscardPenaltyInfo(mySeat, tile);
        if (info?.willPenalize) {
          penaltyIds.add(tile.id);
          penaltyMap.set(tile.id, info);
        }
      }
    }

    return { meldIds, penaltyIds, perIds, winIds, penaltyMap };
  }

  renderMyOkeyIstaka(recIdx = -1, allowAutoSort = this.canAutoSort()) {
    const myPlayer = this.getMyPlayer();
    const highlights = this.getOkeyTileHighlights();
    if (this.scene && myPlayer) {
      this.scene.renderPlayerIstaka(myPlayer.hand || [], recIdx, allowAutoSort, highlights);
    }

    if (this.dom.btnMeldTiles) {
      const mySeat = this.getMySeat();
      const isMyTurn =
        this.gameEngine?.gameState === 'PLAYING' &&
        this.gameEngine?.currentTurn === mySeat &&
        this.gameEngine?.turnPhase === 'DISCARD';
      if (this.currentGameType === 'OKEY101' && myPlayer?.hasOpened && isMyTurn && highlights.meldIds.size > 0) {
        this.dom.btnMeldTiles.style.display = 'inline-flex';
        this.dom.btnMeldTiles.innerHTML = `<span>✨</span> Taş İşle (${highlights.meldIds.size})`;
      } else if (this.currentGameType === 'OKEY' && isMyTurn && highlights.winIds.size > 0) {
        this.dom.btnMeldTiles.style.display = 'inline-flex';
        this.dom.btnMeldTiles.innerHTML = '<span>🏆</span> Eli Bitir';
      } else {
        this.dom.btnMeldTiles.style.display = 'none';
      }
    }
    return highlights;
  }

  // --- ADMIN / AUTHORIZED AI ADVISOR (Strictly mchtkrkmz@gmail.com or admin-granted member) ---
  updateAIAdvisor() {
    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();

    if (!this.hasAIAccess() || !this.aiEnabled || !this.gameEngine) {
      this.currentAdvice = null;
      if (this.dom.aiCoachPanel) this.dom.aiCoachPanel.style.display = 'none';
      if (this.scene && myPlayer) {
        if (this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') {
          this.renderMyOkeyIstaka(-1, this.canAutoSort());
        } else if (this.currentGameType === 'BATAK') {
          const isMyTurn = this.gameEngine.currentTurn === mySeat;
          const playableCards =
            isMyTurn && this.gameEngine.gameState === 'PLAYING'
              ? this.gameEngine.getLegalCards(mySeat).map((c) => c.id)
              : null;
          this.scene.renderPlayerHand(myPlayer.hand, playableCards, null);
        } else if (this.currentGameType === 'PISTI') {
          this.scene.renderPlayerHand(myPlayer.hand, null, null);
        }
      }
      this.renderMobileHandDock();
      return;
    }

    if (this.dom.aiCoachPanel) this.dom.aiCoachPanel.style.display = 'block';

    let advice = null;
    if (this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') {
      advice = aiAdvisor.getOkeyAdvice(this.gameEngine, this.currentGameType === 'OKEY101', mySeat);
    } else if (this.currentGameType === 'PISTI') {
      advice = aiAdvisor.getPistiAdvice(this.gameEngine, mySeat);
    } else if (this.currentGameType === 'BATAK') {
      advice = aiAdvisor.getBatakAdvice(this.gameEngine, mySeat);
    }

    this.currentAdvice = advice;
    if (!advice) {
      if (this.dom.aiCoachContent) {
        this.dom.aiCoachContent.innerHTML = '<div class="ai-coach-tip">Oyun analiz ediliyor...</div>';
      }
      this.renderMobileHandDock();
      return;
    }

    if (this.dom.aiCoachContent) {
      let html = '';
      if (advice.gameType === 'OKEY' || advice.gameType === 'OKEY101') {
        const { completePers, nearPers, orphanTiles } = advice.analysis;
        html += `<div style="margin-bottom:6px;"><strong>🎯 Istaka Durumu:</strong> ${completePers.length} Hazır Per • ${nearPers.length} Bekleyen Grup • ${orphanTiles.length} Boşta Taş</div>`;
        if (advice.info101) {
          html += `<div style="margin-bottom:6px; color:#38bdf8;"><strong>📊 101 Puanı:</strong> ${advice.info101.perPoints} Puan ${advice.info101.canOpen ? '🌟 <em>(El Açabilirsiniz!)</em>' : `(Gereken: ${advice.info101.pointsLeft})`}</div>`;
        }
        if (advice.drawAdvice && this.gameEngine.turnPhase === 'DRAW' && this.gameEngine.currentTurn === mySeat) {
          html += `<div style="margin-bottom:6px; color:#22c55e;"><strong>${advice.drawAdvice.title}:</strong> ${advice.drawAdvice.text}</div>`;
        }
        if (advice.bestDiscard?.tile) {
          html += `<div style="color:#fde047;"><strong>💡 Tavsiye Atış:</strong> ${advice.bestDiscard.reason}</div>`;
        }
      } else {
        html = `<div>${advice.reason}</div>`;
      }
      this.dom.aiCoachContent.innerHTML = html;
    }

    if (myPlayer) {
      if (this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') {
        const recIdx = advice.bestDiscard ? advice.bestDiscard.index : -1;
        this.renderMyOkeyIstaka(recIdx, this.canAutoSort());
      } else if (this.currentGameType === 'PISTI') {
        this.scene.renderPlayerHand(myPlayer.hand, null, advice.recommendedCard?.id || null);
      } else if (this.currentGameType === 'BATAK') {
        const isMyTurn = this.gameEngine.currentTurn === mySeat;
        const playableCards =
          isMyTurn && this.gameEngine.gameState === 'PLAYING'
            ? this.gameEngine.getLegalCards(mySeat).map((c) => c.id)
            : null;
        this.scene.renderPlayerHand(myPlayer.hand, playableCards, advice.recommendedCard?.id || null);
      }
    }
    this.renderMobileHandDock();
  }

  applyAIRecommendation() {
    if (!this.hasAIAccess() || !this.currentAdvice || !this.gameEngine) return;
    const mySeat = this.getMySeat();

    if (this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') {
      if (this.gameEngine.currentTurn !== mySeat) return;
      if (this.gameEngine.turnPhase === 'DRAW') {
        if (this.currentAdvice.drawAdvice?.recommendedSource === 'DISCARD') {
          this.dispatchOkeyDrawDiscard();
        } else {
          this.dispatchOkeyDrawStack();
        }
      } else if (this.gameEngine.turnPhase === 'DISCARD' && this.currentAdvice.bestDiscard?.tile) {
        this.dispatchOkeyDiscard(this.currentAdvice.bestDiscard.tile.id);
      }
    } else if (this.currentGameType === 'PISTI') {
      if (this.gameEngine.currentTurn === mySeat && this.currentAdvice.recommendedCard) {
        this.dispatchPlayCard(this.currentAdvice.recommendedCard.id);
      }
    } else if (this.currentGameType === 'BATAK') {
      if (this.gameEngine.gameState === 'BIDDING' && this.gameEngine.bidTurn === mySeat) {
        this.dispatchBatakBid(this.currentAdvice.recommendedBid || 0);
        this.hideActionPanel();
      } else if (this.gameEngine.gameState === 'PLAYING' && this.gameEngine.currentTurn === mySeat) {
        if (this.currentAdvice.recommendedCard) {
          this.dispatchPlayCard(this.currentAdvice.recommendedCard.id);
        }
      }
    }
  }

  // --- OKEY DISCARDS HELPER (PERSPECTIVE ROTATED) ---
  renderOkeyDiscardsHelper() {
    if (!this.gameEngine || !this.gameEngine.discardPiles) return;
    const mySeat = this.getMySeat();
    const leftEngineSeat = this.getLeftEngineSeat();
    const canDrawLeft =
      this.gameEngine.currentTurn === mySeat &&
      this.gameEngine.turnPhase === 'DRAW' &&
      this.gameEngine.discardPiles[leftEngineSeat]?.length > 0;
    const visualDiscards = this.toVisualArray(this.gameEngine.discardPiles).map((p) => p || []);
    this.scene.renderOkeyDiscards(visualDiscards, canDrawLeft);
  }

  // --- 101 OKEY ---
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
    this.scene.updateTableAvatars(this.toVisualArray(seatedPlayers));

    this.gameEngine = new Okey101GameEngine(3);
    this.gameEngine.initPlayers(seatedPlayers);
    this.gameEngine.onEvent((event, data) => this.handleOkey101Event(event, data));
    this.gameEngine.startNewMatch();
  }

  handleOkey101Event(event, data) {
    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();

    if (event === 'log') {
      this.appendLog(data.message);
    } else if (event === 'deal_complete') {
      this.clearPlayedFeed();
      const okey = data.okeyInfo;
      this.dom.hudTrump.innerHTML = `<span style="color:${okey.colorHex}">★ ${okey.colorName} ${okey.number}</span>`;
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.renderOpponentIstakas(this.toVisualArray(this.gameEngine.players));
      this.scene.renderCenterOkeyStack(data.drawStackCount, data.gosterge);
      this.renderOkeyDiscardsHelper();
      this.scene.render101OpenedPers(this.gameEngine.tableOpenedPers);
      this.updateOkey101HUD('Taşlar Dağıtıldı (21 Taş)');
      soundFx.playOkeyTileClick(1.0);
      if (this.gameEngine.currentTurn === mySeat) {
        this.updateOkey101HUD('🌟 SIRA SİZDE! İstiyorsanız el açın veya taş atın.');
        this.showOkey101DrawUI(false);
      }
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'deal_complete' });
    } else if (event === 'tile_drawn') {
      soundFx.playOkeyTileSlide();
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.renderOpponentIstakas(this.toVisualArray(this.gameEngine.players));
      this.scene.renderCenterOkeyStack(this.gameEngine.drawStack.length, this.gameEngine.gostergeTile);
      this.renderOkeyDiscardsHelper();

      if (data.playerIndex === mySeat && myPlayer) {
        const { totalPoints } = this.gameEngine.calculateHandPerPoints(myPlayer);
        const canOpen = !myPlayer.hasOpened && totalPoints >= 101;
        this.updateOkey101HUD(`🌟 Taş çektiniz. Per Puanınız: ${totalPoints} ${canOpen ? '(Açabilirsiniz!)' : ''}`);
        this.showOkey101DiscardUI(canOpen);
      } else {
        this.updateOkey101HUD(`${this.gameEngine.players[data.playerIndex]?.name} taş çekti.`);
      }
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'tile_drawn', playerIndex: data.playerIndex });
    } else if (event === 'hand_opened') {
      soundFx.playTrumpFanfare();
      this.triggerVictoryCelebration(0.5);
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.render101OpenedPers(this.gameEngine.tableOpenedPers);
      this.updateOkey101HUD(`${this.gameEngine.players[data.playerIndex]?.name} ELİNİ AÇTI (${data.totalPoints} Puan)!`);
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'hand_opened', playerIndex: data.playerIndex });
    } else if (event === 'tile_melded') {
      soundFx.playOkeyTileSlide();
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.renderOpponentIstakas(this.toVisualArray(this.gameEngine.players));
      this.scene.render101OpenedPers(this.gameEngine.tableOpenedPers);
      this.updateOkey101HUD(`${this.gameEngine.players[data.playerIndex]?.name} pere taş işledi!`);
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'tile_melded', playerIndex: data.playerIndex, tile: data.tile });
    } else if (event === 'penalty_incurred') {
      soundFx.playButtonClick();
      this.updateOkey101HUD(`🚨 ${this.gameEngine.players[data.playerIndex]?.name}: +${data.points} Ceza!`);
      if (data.playerIndex === mySeat && !this.scene?.isVRActive) {
        this.appendLog(`🚨 CEZA (+${data.points} Puan): ${data.reason}`);
      }
      this.updateOkey101HUD();
      this.syncHostStateToGuests({
        type: 'penalty_incurred',
        playerIndex: data.playerIndex,
        points: data.points,
        reason: data.reason,
      });
    } else if (event === 'tile_discarded') {
      this.recordPlayedMove(data.playerIndex, data.tile, 'tile');
      const vSeat = this.toVisualSeat(data.playerIndex, 4);
      this.scene.animateTileDiscard(data.tile, vSeat, () => this.renderOkeyDiscardsHelper());
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.renderOpponentIstakas(this.toVisualArray(this.gameEngine.players));
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'tile_discarded', playerIndex: data.playerIndex, tile: data.tile });
    } else if (event === 'turn_changed') {
      this.renderOkeyDiscardsHelper();
      const isMyTurn = data.currentTurn === mySeat;
      if (isMyTurn) {
        this.updateOkey101HUD('🌟 SIRA SİZDE! Ortadan veya yandan taş çekin.');
        this.showOkey101DrawUI(true);
      } else {
        this.updateOkey101HUD(`${this.gameEngine.players[data.currentTurn]?.name} düşünüyor...`);
        this.hideActionPanel();
        this.scene.clearVRButtons();
      }
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'turn_changed', currentTurn: data.currentTurn });
    } else if (event === 'round_ended') {
      this.updateOkey101HUD('101 Eli Tamamlandı! Cezalar hesaplandı.');
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'round_ended' });
    } else if (event === 'match_winner') {
      this.updateOkey101HUD(`👑 101 ŞAMPİYONU: ${data.winner.name}`);
      soundFx.playOkeyWinSlam();
      this.triggerVictoryCelebration(1.0);
      this.showGameOverModal({
        winnerName: data.winner.name,
        details: `101 Okey Karşılaşması Tamamlandı! Şampiyon: ${data.winner.name} (Ceza Puanı: ${data.winner.totalPenalty ?? 0})`,
        gameType: 'OKEY101',
      });
      this.syncHostStateToGuests({ type: 'match_winner', winner: data.winner });
    }
  }

  showOkey101DrawUI(canDraw) {
    const myPlayer = this.getMyPlayer();
    const leftSeat = this.getLeftEngineSeat();
    const leftDiscard = this.gameEngine.discardPiles[leftSeat] || [];
    const canDrawDiscard = canDraw && leftDiscard.length > 0;
    const topTile = canDrawDiscard ? leftDiscard[leftDiscard.length - 1] : null;
    const topTileName = topTile ? `${topTile.colorName} ${topTile.number || 'Sahte'}` : '';

    this.dom.actionTitle.textContent = '101 Okey Hamle Seçin:';
    this.dom.actionButtonsContainer.innerHTML = '';

    if (canDraw) {
      const drawStackBtn = document.createElement('button');
      drawStackBtn.className = 'action-chip';
      drawStackBtn.textContent = '🎲 Ortadan Taş Çek';
      drawStackBtn.onclick = () => this.dispatchOkeyDrawStack();
      this.dom.actionButtonsContainer.appendChild(drawStackBtn);

      if (canDrawDiscard && topTile) {
        const drawDiscardBtn = document.createElement('button');
        drawDiscardBtn.className = 'action-chip';
        drawDiscardBtn.style.background = '#15803d';
        drawDiscardBtn.textContent = `📥 Yandan Al (${topTileName})`;
        drawDiscardBtn.onclick = () => this.dispatchOkeyDrawDiscard();
        this.dom.actionButtonsContainer.appendChild(drawDiscardBtn);
      }
    }

    const { totalPoints } = myPlayer ? this.gameEngine.calculateHandPerPoints(myPlayer) : { totalPoints: 0 };
    const canOpen = myPlayer ? !myPlayer.hasOpened && totalPoints >= 101 : false;

    if (canOpen) {
      const openHandBtn = document.createElement('button');
      openHandBtn.className = 'action-chip';
      openHandBtn.style.background = '#d97706';
      openHandBtn.textContent = `🌟 Elini Aç (${totalPoints} Puan)`;
      openHandBtn.onclick = () => this.dispatchOkey101Open();
      this.dom.actionButtonsContainer.appendChild(openHandBtn);
    }

    if (this.dom.actionButtonsContainer.children.length > 0) {
      this.dom.actionPanel.classList.add('show');
    }

    // Exact signature match with scene.js!
    if (canDraw) {
      this.scene.showOkey101DrawButtonsInVR(
        canDrawDiscard,
        topTileName,
        () => this.dispatchOkeyDrawStack(),
        () => this.dispatchOkeyDrawDiscard(),
        canOpen,
        totalPoints,
        () => this.dispatchOkey101Open()
      );
    }
  }

  showOkey101DiscardUI(canOpen) {
    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();
    const meldables =
      myPlayer?.hasOpened && this.gameEngine?.findMeldableTiles
        ? this.gameEngine.findMeldableTiles(mySeat)
        : [];
    this.dom.actionTitle.textContent =
      meldables.length > 0
        ? `Istakadan ${meldables.length} taş işlenebilir veya atılacak taşı seçin:`
        : 'Istakadan Atılacak Taşı Seçin (veya sağdaki tepsiye sürükleyin):';
    this.dom.actionButtonsContainer.innerHTML = '';

    if (canOpen) {
      const openHandBtn = document.createElement('button');
      openHandBtn.className = 'action-chip';
      openHandBtn.style.background = '#d97706';
      openHandBtn.textContent = '🌟 Elini Aç (101)';
      openHandBtn.onclick = () => this.dispatchOkey101Open();
      this.dom.actionButtonsContainer.appendChild(openHandBtn);
    }

    if (meldables.length > 0) {
      const meldBtn = document.createElement('button');
      meldBtn.className = 'action-chip';
      meldBtn.style.background = '#059669';
      meldBtn.textContent = `✨ İşlenecek Taşları İşle (${meldables.length})`;
      meldBtn.onclick = () => this.dispatchOkey101Meld(null);
      this.dom.actionButtonsContainer.appendChild(meldBtn);
    }

    if (this.hasAIAccess()) {
      const sortAiBtn = document.createElement('button');
      sortAiBtn.className = 'action-chip ai-btn';
      sortAiBtn.textContent = '🧠 AI Akıllı Diz';
      sortAiBtn.onclick = () => this.sortHandAI();
      this.dom.actionButtonsContainer.appendChild(sortAiBtn);
    }

    if (this.canAutoSort()) {
      const sortRunsBtn = document.createElement('button');
      sortRunsBtn.className = 'action-chip';
      sortRunsBtn.textContent = '📐 Seri Diz';
      sortRunsBtn.onclick = () => this.sortHandRuns();
      this.dom.actionButtonsContainer.appendChild(sortRunsBtn);
    }

    if (this.dom.actionButtonsContainer.children.length > 0) {
      this.dom.actionPanel.classList.add('show');
    } else {
      this.dom.actionPanel.classList.remove('show');
    }
  }

  updateOkey101HUD(customStatus = null) {
    const p = this.gameEngine.players;
    const mySeat = this.getMySeat();
    const scores = p.map((player) => ({
      name: player.name,
      opened: player.hasOpened,
      score: player.totalPenalty,
    }));

    const status =
      customStatus || (this.gameEngine.currentTurn === mySeat ? 'Sıra Sizde!' : `${p[this.gameEngine.currentTurn]?.name} Oynuyor`);
    this.dom.hudStatus.textContent = status;

    const advice = this.hasAIAccess() && this.aiEnabled ? this.currentAdvice : null;
    this.scene.updateHUD({
      title: `101 OKEY (${this.gameEngine.currentHand}/${this.gameEngine.totalHands}. El)`,
      status,
      trump: null,
      okeyTile: this.gameEngine.okeyTileInfo,
      currentTurn: this.toVisualSeat(this.gameEngine.currentTurn, 4),
      scores,
      aiAdvice: advice?.bestDiscard
        ? `Tavsiye: ${advice.bestDiscard.tile.colorName} ${advice.bestDiscard.tile.number} Atın`
        : advice?.info101?.tip || null,
      aiDetail: advice?.bestDiscard?.reason || null,
    });
    this.renderScoreboard();
  }

  // --- KLASİK OKEY ---
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
    this.scene.updateTableAvatars(this.toVisualArray(seatedPlayers));

    this.gameEngine = new OkeyGameEngine('KLASIK', 20);
    this.gameEngine.initPlayers(seatedPlayers);
    this.gameEngine.onEvent((event, data) => this.handleOkeyEvent(event, data));
    this.gameEngine.startNewMatch();
  }

  handleOkeyEvent(event, data) {
    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();

    if (event === 'log') {
      this.appendLog(data.message);
    } else if (event === 'deal_complete') {
      this.clearPlayedFeed();
      const okey = data.okeyInfo;
      this.dom.hudTrump.innerHTML = `<span style="color:${okey.colorHex}">★ ${okey.colorName} ${okey.number}</span>`;
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.renderOpponentIstakas(this.toVisualArray(this.gameEngine.players));
      this.scene.renderCenterOkeyStack(data.drawStackCount, data.gosterge);
      this.renderOkeyDiscardsHelper();
      this.updateOkeyHUD('Taşlar Dağıtıldı');
      soundFx.playOkeyTileClick(1.0);
      if (this.gameEngine.currentTurn === mySeat) {
        this.updateOkeyHUD('🌟 SIRA SİZDE! Istakanızdan atılacak taşı seçin veya sağa sürükleyin.');
      }
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'deal_complete' });
    } else if (event === 'tile_drawn') {
      soundFx.playOkeyTileSlide();
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.renderOpponentIstakas(this.toVisualArray(this.gameEngine.players));
      this.scene.renderCenterOkeyStack(this.gameEngine.drawStack.length, this.gameEngine.gostergeTile);
      this.renderOkeyDiscardsHelper();

      if (data.playerIndex === mySeat) {
        this.updateOkeyHUD('🌟 Taş çektiniz. Istakadan atılacak taşı seçin veya sağa sürükleyin.');
        this.hideActionPanel();
        this.scene.clearVRButtons();
      } else {
        this.updateOkeyHUD(`${this.gameEngine.players[data.playerIndex]?.name} taş çekti.`);
      }
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'tile_drawn', playerIndex: data.playerIndex });
    } else if (event === 'penalty_incurred') {
      soundFx.playButtonClick();
      this.updateOkeyHUD(`🚨 ${this.gameEngine.players[data.playerIndex]?.name}: +${data.points} Ceza!`);
      if (data.playerIndex === mySeat && !this.scene?.isVRActive) {
        this.appendLog(`🚨 CEZA (+${data.points} Puan): ${data.reason}`);
      }
      this.syncHostStateToGuests({
        type: 'penalty_incurred',
        playerIndex: data.playerIndex,
        points: data.points,
        reason: data.reason,
      });
    } else if (event === 'tile_discarded') {
      this.recordPlayedMove(data.playerIndex, data.tile, 'tile');
      const vSeat = this.toVisualSeat(data.playerIndex, 4);
      this.scene.animateTileDiscard(data.tile, vSeat, () => this.renderOkeyDiscardsHelper());
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.scene.renderOpponentIstakas(this.toVisualArray(this.gameEngine.players));
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'tile_discarded', playerIndex: data.playerIndex, tile: data.tile });
    } else if (event === 'turn_changed') {
      this.renderOkeyDiscardsHelper();
      const isMyTurn = data.currentTurn === mySeat;
      if (isMyTurn) {
        this.updateOkeyHUD('🌟 SIRA SİZDE! Ortadan veya yandan taş çekin.');
        this.showOkeyDrawUI();
      } else {
        this.updateOkeyHUD(`${this.gameEngine.players[data.currentTurn]?.name} düşünüyor...`);
        this.hideActionPanel();
        this.scene.clearVRButtons();
      }
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'turn_changed', currentTurn: data.currentTurn });
    } else if (event === 'round_ended') {
      this.updateOkeyHUD('El Tamamlandı!');
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'round_ended' });
    } else if (event === 'match_winner') {
      this.updateOkeyHUD(`👑 ŞAMPİYON: ${data.winner.name}`);
      soundFx.playOkeyWinSlam();
      this.triggerVictoryCelebration(1.0);
      this.showGameOverModal({
        winnerName: data.winner.name,
        details: `Klasik Okey Karşılaşması Tamamlandı! Şampiyon: ${data.winner.name}`,
        gameType: 'OKEY',
      });
      this.syncHostStateToGuests({ type: 'match_winner', winner: data.winner });
    }
  }

  showOkeyDrawUI() {
    const leftSeat = this.getLeftEngineSeat();
    const leftDiscard = this.gameEngine.discardPiles[leftSeat] || [];
    const canDrawDiscard = leftDiscard.length > 0;
    const topTile = canDrawDiscard ? leftDiscard[leftDiscard.length - 1] : null;

    this.dom.actionTitle.textContent = 'Hamle Seçin:';
    this.dom.actionButtonsContainer.innerHTML = '';

    const drawStackBtn = document.createElement('button');
    drawStackBtn.className = 'action-chip';
    drawStackBtn.textContent = '🎲 Ortadan Taş Çek';
    drawStackBtn.onclick = () => this.dispatchOkeyDrawStack();
    this.dom.actionButtonsContainer.appendChild(drawStackBtn);

    if (canDrawDiscard && topTile) {
      const drawDiscardBtn = document.createElement('button');
      drawDiscardBtn.className = 'action-chip';
      drawDiscardBtn.style.background = '#15803d';
      drawDiscardBtn.textContent = `📥 Yandan Al (${topTile.colorName} ${topTile.number || 'Sahte'})`;
      drawDiscardBtn.onclick = () => this.dispatchOkeyDrawDiscard();
      this.dom.actionButtonsContainer.appendChild(drawDiscardBtn);
    }

    this.dom.actionPanel.classList.add('show');

    this.scene.showOkeyDrawButtonsInVR(
      canDrawDiscard,
      () => this.dispatchOkeyDrawStack(),
      () => this.dispatchOkeyDrawDiscard()
    );
  }

  // --- ISTAKA ARRANGEMENT & REAL-LIFE DRAG-DROP ---
  sortHandAI() {
    if (!this.hasAIAccess()) return;
    const player = this.getMyPlayer();
    if (!player) return;
    const is101 = this.currentGameType === 'OKEY101';
    const advice = aiAdvisor.getOkeyAdvice(this.gameEngine, is101, this.getMySeat());
    if (!advice?.analysis) return;

    const { completePers, nearPers, orphanTiles, okeys } = advice.analysis;
    const newHand = [];
    okeys.forEach((t) => newHand.push(t));
    completePers.forEach((per) =>
      per.tiles.forEach((t) => {
        if (!newHand.some((h) => h.id === t.id)) newHand.push(t);
      })
    );
    nearPers.forEach((np) =>
      np.tiles.forEach((t) => {
        if (!newHand.some((h) => h.id === t.id)) newHand.push(t);
      })
    );
    orphanTiles.forEach((t) => {
      if (!newHand.some((h) => h.id === t.id)) newHand.push(t);
    });
    player.hand.forEach((t) => {
      if (!newHand.some((h) => h.id === t.id)) newHand.push(t);
    });

    player.hand = newHand;
    arrangeHandTilesOnIstaka(player.hand, true);
    this.setSelectedTile(-1);
    this.renderMyOkeyIstaka(-1, true);
    soundFx.playOkeyTileSlide();
    soundFx.playOkeyStoneClack(0.8);
    this.updateAIAdvisor();
    this.appendLog('🧠 Yapay Zeka taşları hazır perler ve bekleyen gruplara göre akıllıca dizdi.');
  }

  loadPhotoDemoIstaka() {
    if (!this.hasAIAccess()) return;
    const player = this.getMyPlayer();
    if (!player) return;
    const demoHand = createPhotoDemoHand();
    player.hand = demoHand;
    this.setSelectedTile(-1);
    this.renderMyOkeyIstaka(-1, true);
    soundFx.playOkeyTilesShuffle();
    this.appendLog('📸 Örnek ıstaka dizilimi yüklendi!');
    this.updateAIAdvisor();
  }

  sortHandRuns() {
    if (!this.canAutoSort()) return;
    const player = this.getMyPlayer();
    if (!player) return;
    arrangeHandTilesOnIstaka(player.hand, true);
    this.setSelectedTile(-1);
    this.renderMyOkeyIstaka(-1, true);
    soundFx.playOkeyTileSlide();
    soundFx.playOkeyStoneClack(0.8);
    this.updateAIAdvisor();
    this.appendLog('📐 Taşlar serilere ve perlere göre düzenli olarak dizildi.');
  }

  sortHandByColor() {
    if (!this.canAutoSort()) return;
    const player = this.getMyPlayer();
    if (!player || !Array.isArray(player.hand) || player.hand.length === 0) return;

    const colorOrder = { RED: 0, BLACK: 1, BLUE: 2, YELLOW: 3, FAKE: 4 };
    player.hand.sort((a, b) => {
      if (a.isRealOkey && !b.isRealOkey) return -1;
      if (b.isRealOkey && !a.isRealOkey) return 1;
      const cA = colorOrder[a.colorKey] ?? 4;
      const cB = colorOrder[b.colorKey] ?? 4;
      if (cA !== cB) return cA - cB;
      return (a.number || 0) - (b.number || 0);
    });

    // Place by color blocks across top and bottom tiers cleanly (keep 1-slot gaps when space permits)
    const groups = [];
    let currentKey = null;
    player.hand.forEach((tile) => {
      const k = tile.isRealOkey ? 'OKEY' : tile.colorKey || 'FAKE';
      if (k !== currentKey) {
        groups.push([]);
        currentKey = k;
      }
      groups[groups.length - 1].push(tile);
    });

    let tier = 0;
    let slot = 0;
    const totalWithGaps = player.hand.length + Math.max(0, groups.length - 1);
    const useGaps = totalWithGaps <= ISTAKA_SLOTS_PER_TIER * 2;
    groups.forEach((grp, gIdx) => {
      if (useGaps && gIdx > 0 && slot > 0 && slot + grp.length > ISTAKA_SLOTS_PER_TIER && tier === 0) {
        tier = 1;
        slot = 0;
      }
      grp.forEach((t) => {
        if (slot >= ISTAKA_SLOTS_PER_TIER && tier === 0) {
          tier = 1;
          slot = 0;
        }
        t._istakaTier = tier;
        t._istakaSlot = Math.min(ISTAKA_SLOTS_PER_TIER - 1, slot++);
      });
      if (useGaps && gIdx < groups.length - 1 && slot < ISTAKA_SLOTS_PER_TIER) {
        slot++;
      }
    });

    this.setSelectedTile(-1);
    this.renderMyOkeyIstaka(-1, false);
    soundFx.playOkeyTileSlide();
    soundFx.playOkeyStoneClack(0.8);
    this.renderMobileHandDock();
    this.appendLog('🎨 Taşlar renk ve sayı sırasına göre dizildi.');
  }

  sortHandPairs() {
    if (!this.canAutoSort()) return;
    const player = this.getMyPlayer();
    if (!player) return;
    player.hand.sort((a, b) => {
      if (a.isRealOkey) return -1;
      if (b.isRealOkey) return 1;
      if (a.number !== b.number) return a.number - b.number;
      return (a.colorKey || '').localeCompare(b.colorKey || '');
    });

    const pairs = [];
    const singles = [];
    const used = new Set();
    for (let i = 0; i < player.hand.length; i++) {
      if (used.has(i)) continue;
      if (i + 1 < player.hand.length && !used.has(i + 1) && player.hand[i].number === player.hand[i + 1].number) {
        pairs.push([player.hand[i], player.hand[i + 1]]);
        used.add(i);
        used.add(i + 1);
      } else {
        singles.push(player.hand[i]);
        used.add(i);
      }
    }

    let t0 = 0;
    let t1 = 0;
    pairs.forEach((pair, pIdx) => {
      const preferTop = pIdx % 2 === 0;
      if (preferTop && t0 + 2 <= ISTAKA_SLOTS_PER_TIER) {
        pair[0]._istakaTier = 0;
        pair[0]._istakaSlot = t0++;
        pair[1]._istakaTier = 0;
        pair[1]._istakaSlot = t0++;
        if (t0 < ISTAKA_SLOTS_PER_TIER) t0++;
      } else if (t1 + 2 <= ISTAKA_SLOTS_PER_TIER) {
        pair[0]._istakaTier = 1;
        pair[0]._istakaSlot = t1++;
        pair[1]._istakaTier = 1;
        pair[1]._istakaSlot = t1++;
        if (t1 < ISTAKA_SLOTS_PER_TIER) t1++;
      } else {
        singles.push(pair[0], pair[1]);
      }
    });

    singles.forEach((t) => {
      if (t0 < ISTAKA_SLOTS_PER_TIER) {
        t._istakaTier = 0;
        t._istakaSlot = t0++;
      } else {
        t._istakaTier = 1;
        t._istakaSlot = Math.min(ISTAKA_SLOTS_PER_TIER - 1, t1++);
      }
    });

    this.setSelectedTile(-1);
    this.renderMyOkeyIstaka(-1, true);
    soundFx.playOkeyTileSlide();
    this.updateAIAdvisor();
    this.appendLog('👥 Taşlar sayılara ve çiftlere göre aralıklı dizildi.');
  }

  handleTileDropToSlot(draggedTile, targetTier, targetSlot) {
    const player = this.getMyPlayer();
    if (!player) return;
    const tileObj = draggedTile || player.hand[this.selectedTileIndex];
    if (!tileObj) return;

    const moved = moveTileToIstakaSlot(player.hand, tileObj.id, targetTier, targetSlot);
    if (moved) {
      this.setSelectedTile(-1);
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      soundFx.playOkeyTileSlide();
      soundFx.playOkeyStoneClack(0.7);
      this.hideActionPanel();
      this.updateAIAdvisor();
    }
  }

  handleTileDropToDiscard(draggedTile) {
    const player = this.getMyPlayer();
    if (!player) return;
    const tileObj = draggedTile || player.hand[this.selectedTileIndex];
    if (!tileObj) return;

    const mySeat = this.getMySeat();
    if (this.gameEngine.currentTurn === mySeat && this.gameEngine.turnPhase === 'DISCARD') {
      this.dispatchOkeyDiscard(tileObj.id);
    } else {
      soundFx.playButtonClick();
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.appendLog('ℹ️ Taş atmak için sıranızda ve taş atma aşamasında olmalısınız.');
    }
  }

  handleUserTileSelected(tile) {
    const player = this.getMyPlayer();
    if (!this.gameEngine || !player) return;
    const tileIndex = player.hand.findIndex((t) => t.id === tile.id);
    if (tileIndex === -1) return;

    const mySeat = this.getMySeat();

    if (this.selectedTileIndex === -1) {
      this.setSelectedTile(tileIndex);
      soundFx.playButtonClick();
      this.scene.highlightTileOnRack(tileIndex);
      this.showTileSelectionActions(tile);
    } else if (this.selectedTileIndex === tileIndex) {
      if (this.gameEngine.turnPhase === 'DISCARD' && this.gameEngine.currentTurn === mySeat) {
        this.dispatchOkeyDiscard(tile.id);
      } else {
        this.setSelectedTile(-1);
        this.renderMyOkeyIstaka(-1, this.canAutoSort());
        this.hideActionPanel();
      }
    } else {
      const prevIdx = this.selectedTileIndex;
      const targetIdx = tileIndex;

      const temp = player.hand[prevIdx];
      player.hand[prevIdx] = player.hand[targetIdx];
      player.hand[targetIdx] = temp;

      const tSlot = player.hand[prevIdx]._istakaSlot;
      const tTier = player.hand[prevIdx]._istakaTier;
      player.hand[prevIdx]._istakaSlot = player.hand[targetIdx]._istakaSlot;
      player.hand[prevIdx]._istakaTier = player.hand[targetIdx]._istakaTier;
      player.hand[targetIdx]._istakaSlot = tSlot;
      player.hand[targetIdx]._istakaTier = tTier;

      this.setSelectedTile(-1);
      this.renderMyOkeyIstaka(-1, this.canAutoSort());
      soundFx.playOkeyTileSlide();
      soundFx.playOkeyStoneClack(0.7);
      this.updateAIAdvisor();
      this.hideActionPanel();
    }
  }

  showTileSelectionActions(tile) {
    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();
    const isMyDiscardTurn =
      this.gameEngine.turnPhase === 'DISCARD' && this.gameEngine.currentTurn === mySeat;
    const is101 = this.currentGameType === 'OKEY101';
    const meldTargets =
      is101 && isMyDiscardTurn && myPlayer?.hasOpened && this.gameEngine.findMeldTargetsForTile
        ? this.gameEngine.findMeldTargetsForTile(tile)
        : [];
    const highlights = this.getOkeyTileHighlights();
    const isWinningKlasik = !is101 && isMyDiscardTurn && highlights.winIds.has(tile.id);
    const penaltyInfo =
      isMyDiscardTurn && this.gameEngine.getDiscardPenaltyInfo
        ? this.gameEngine.getDiscardPenaltyInfo(mySeat, tile)
        : highlights.penaltyMap.get(tile.id) || { willPenalize: false };

    const tileDesc = `${tile.colorName} ${tile.isFakeOkey ? 'Sahte Okey' : tile.number}`;
    this.dom.actionTitle.textContent = penaltyInfo.willPenalize
      ? `⚠️ ${tileDesc} — DİKKAT: ${penaltyInfo.reason}`
      : isWinningKlasik
        ? `🏆 ${tileDesc} — Bu taşı atarsanız ELİ BİTİRİRSİNİZ!`
        : `Seçilen Taş: ${tileDesc}`;
    this.dom.actionButtonsContainer.innerHTML = '';

    if (meldTargets.length > 0) {
      const meldBtn = document.createElement('button');
      meldBtn.className = 'action-chip';
      meldBtn.style.background = '#059669';
      meldBtn.textContent = '✨ Masadaki Pere İşle';
      meldBtn.onclick = () => this.dispatchOkey101Meld(tile.id, meldTargets[0].perIndex);
      this.dom.actionButtonsContainer.appendChild(meldBtn);
    }

    if (isMyDiscardTurn) {
      const discardBtn = document.createElement('button');
      discardBtn.className = isWinningKlasik ? 'action-chip' : 'action-chip pass';
      if (isWinningKlasik) discardBtn.style.background = '#059669';
      discardBtn.textContent = penaltyInfo.willPenalize
        ? `🚨 Yine de At (+${penaltyInfo.penaltyPoints} CEZA!)`
        : isWinningKlasik
          ? '🏆 Bu Taşı At & Eli Bitir!'
          : '🚀 Bu Taşı At';
      discardBtn.onclick = () => this.dispatchOkeyDiscard(tile.id);
      this.dom.actionButtonsContainer.appendChild(discardBtn);
    }

    if (this.hasAIAccess()) {
      const sortAiBtn = document.createElement('button');
      sortAiBtn.className = 'action-chip ai-btn';
      sortAiBtn.textContent = '🧠 AI Akıllı Diz';
      sortAiBtn.onclick = () => {
        this.sortHandAI();
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(sortAiBtn);
    }

    if (this.canAutoSort()) {
      const sortRunsBtn = document.createElement('button');
      sortRunsBtn.className = 'action-chip';
      sortRunsBtn.textContent = '📐 Seri Diz';
      sortRunsBtn.onclick = () => {
        this.sortHandRuns();
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(sortRunsBtn);

      const sortPairsBtn = document.createElement('button');
      sortPairsBtn.className = 'action-chip';
      sortPairsBtn.textContent = '👥 Çift Diz';
      sortPairsBtn.onclick = () => {
        this.sortHandPairs();
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(sortPairsBtn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'action-chip';
    cancelBtn.style.background = '#475569';
    cancelBtn.textContent = 'Vazgeç';
    cancelBtn.onclick = () => {
      this.setSelectedTile(-1);
      const player = this.getMyPlayer();
      if (player) this.renderMyOkeyIstaka(-1, this.canAutoSort());
      this.hideActionPanel();
    };
    this.dom.actionButtonsContainer.appendChild(cancelBtn);

    this.dom.actionPanel.classList.add('show');
  }

  handleCenterStackClick() {
    if ((this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101') && this.gameEngine) {
      if (this.gameEngine.currentTurn === this.getMySeat() && this.gameEngine.turnPhase === 'DRAW') {
        this.dispatchOkeyDrawStack();
      }
    }
  }

  updateOkeyHUD(customStatus = null) {
    const p = this.gameEngine.players;
    const mySeat = this.getMySeat();
    const scores = p.map((player) => ({
      name: player.name,
      score: player.score,
    }));

    const status =
      customStatus || (this.gameEngine.currentTurn === mySeat ? 'Sıra Sizde!' : `${p[this.gameEngine.currentTurn]?.name} Oynuyor`);
    this.dom.hudStatus.textContent = status;

    const advice = this.hasAIAccess() && this.aiEnabled ? this.currentAdvice : null;
    this.scene.updateHUD({
      title: 'KLASİK OKEY (Kıraathane)',
      status,
      trump: null,
      okeyTile: this.gameEngine.okeyTileInfo,
      currentTurn: this.toVisualSeat(this.gameEngine.currentTurn, 4),
      scores,
      aiAdvice: advice?.bestDiscard ? `Tavsiye: ${advice.bestDiscard.tile.colorName} ${advice.bestDiscard.tile.number} Atın` : null,
      aiDetail: advice?.bestDiscard?.reason || null,
    });
    this.renderScoreboard();
  }

  // --- BATAK ---
  startBatakGame() {
    this.resetActiveEngine();
    this.currentGameType = 'BATAK';
    this.dom.hudGameName.textContent = 'İhaleli Batak (1/10)';
    this.dom.trumpContainer.style.display = 'flex';
    this.dom.trumpInfoLabel.textContent = 'Koz';
    this.updateGameControls('BATAK');

    this.scene.setGameModeView('BATAK');
    soundFx.playCardShuffle();

    const seatedPlayers = this.getActiveSeatedPlayers(4);
    this.scene.updateTableAvatars(this.toVisualArray(seatedPlayers));

    this.gameEngine = new BatakGameEngine('IHALELI', 10);
    this.gameEngine.initPlayers(seatedPlayers);
    this.gameEngine.onEvent((event, data) => this.handleBatakEvent(event, data));
    this.gameEngine.startNewMatch();

    if (this.dom.scoreboardPanel) {
      if (typeof window !== 'undefined' && window.innerWidth > 960) {
        this.dom.scoreboardPanel.classList.remove('hidden');
      } else {
        this.dom.scoreboardPanel.classList.add('hidden');
      }
      this.renderScoreboard();
    }
  }

  handleBatakEvent(event, data) {
    const mySeat = this.getMySeat();

    if (event === 'log') {
      this.appendLog(data.message);
    } else if (event === 'deal_complete') {
      this.clearPlayedFeed();
      this.updateBatakHUD('Kartlar Dağıtıldı');
      if (this.canAutoSort()) {
        this.sortBatakCards();
      } else {
        const myPlayer = this.getMyPlayer();
        const isMyTurn = this.gameEngine.currentTurn === mySeat && this.gameEngine.gameState === 'PLAYING';
        const playableCards = isMyTurn ? this.gameEngine.getLegalCards(mySeat).map((c) => c.id) : null;
        this.scene.renderPlayerHand(myPlayer?.hand || [], playableCards, null);
      }
      this.scene.renderOpponentHands(this.toVisualArray(this.gameEngine.players));
      soundFx.playCardDeal();
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'deal_complete' });
    } else if (event === 'bidding_started' || event === 'bid_turn_changed') {
      const isMyTurn = data.bidTurn === mySeat;
      const bidderName = this.gameEngine.players[data.bidTurn]?.name || '';
      this.updateBatakHUD(`İhale Sırası: ${bidderName}`);

      if (isMyTurn) {
        this.showBatakBiddingUI(data.highestBid);
        this.scene.showBiddingButtonsInVR(data.highestBid, (bid) => {
          this.dispatchBatakBid(bid);
          this.hideActionPanel();
        });
      } else {
        this.hideActionPanel();
        this.scene.clearVRButtons();
      }
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: event, bidTurn: data.bidTurn });
    } else if (event === 'choose_trump_phase') {
      if (data.playerIndex === mySeat) {
        this.updateBatakHUD('İhaleyi Aldınız! Lütfen Koz Seçin.');
        this.showTrumpSelectionUI();
        this.scene.showTrumpSelectionButtonsInVR((suit) => {
          this.dispatchBatakTrump(suit);
          this.hideActionPanel();
        });
      } else {
        this.updateBatakHUD(`${this.gameEngine.players[data.playerIndex]?.name} Koz Seçiyor...`);
      }
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'choose_trump_phase', playerIndex: data.playerIndex });
    } else if (event === 'trump_chosen') {
      const suit = SUITS[data.trumpSuit];
      this.dom.hudTrump.innerHTML = `<span style="color:${suit.isRed ? '#ef4444' : '#60a5fa'}">${suit.symbol} ${suit.name}</span>`;
      soundFx.playTrumpFanfare();
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'trump_chosen', trumpSuit: data.trumpSuit });
    } else if (event === 'playing_started' || event === 'turn_changed') {
      const isMyTurn = data.currentTurn === mySeat;
      const turnPlayer = this.gameEngine.players[data.currentTurn];
      this.updateBatakHUD(isMyTurn ? '🌟 SIRA SİZDE! Kart seçin veya yukarı sürükleyin.' : `${turnPlayer?.name} oynuyor...`);
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: event, currentTurn: data.currentTurn });
    } else if (event === 'card_played') {
      this.recordPlayedMove(data.playerIndex, data.card, 'card');
      const vSeat = this.toVisualSeat(data.playerIndex, 4);
      this.scene.animateCardPlay(data.card, vSeat, null, () => {
        const visualTrick = (this.gameEngine.currentTrick || []).map((tc) => ({
          ...tc,
          playerIndex: this.toVisualSeat(tc.playerIndex, 4),
        }));
        this.scene.renderTableCards(visualTrick);
      });
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'card_played', playerIndex: data.playerIndex, card: data.card });
    } else if (event === 'trick_completed') {
      const winner = this.gameEngine.players[data.winnerIndex];
      const vWinner = this.toVisualSeat(data.winnerIndex, 4);
      this.updateBatakHUD(`Eli ${winner?.name} aldı!`);
      setTimeout(() => {
        this.scene.animateTrickCollection(vWinner, () => {
          this.updateBatakHUD();
          this.updateAIAdvisor();
        });
      }, 650);
      this.syncHostStateToGuests({ type: 'trick_completed', winnerIndex: data.winnerIndex });
    } else if (event === 'round_ended') {
      this.updateBatakHUD(`${data.round}. Tur Tamamlandı! (${data.round}/${data.totalRounds})`);
      this.showBatakRoundEndUI();
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'round_ended', round: data.round });
    } else if (event === 'match_winner') {
      this.updateBatakHUD(`🏆 OYUN BİTTİ! Kazanan: ${data.winner.name}`);
      this.triggerVictoryCelebration();
      this.showGameOverModal({
        winnerName: data.winner.name,
        details: `Batak İhale Karşılaşması Tamamlandı! Şampiyon: ${data.winner.name} (Puan: ${data.winner.totalScore ?? 0})`,
        gameType: 'BATAK',
      });
      this.syncHostStateToGuests({ type: 'match_winner', winner: data.winner });
    }
  }

  showBatakBiddingUI(highestBid) {
    this.dom.actionTitle.textContent = `İhale Teklifi Verin (En Yüksek: ${highestBid || 0}):`;
    this.dom.actionButtonsContainer.innerHTML = '';

    const passBtn = document.createElement('button');
    passBtn.className = 'action-chip pass';
    passBtn.textContent = 'Pas';
    passBtn.onclick = () => {
      this.dispatchBatakBid(0);
      this.hideActionPanel();
    };
    this.dom.actionButtonsContainer.appendChild(passBtn);

    const minBid = Math.max(5, highestBid + 1);
    for (let b = minBid; b <= 13; b++) {
      const bidBtn = document.createElement('button');
      bidBtn.className = 'action-chip';
      bidBtn.textContent = `${b} Batak`;
      bidBtn.onclick = () => {
        this.dispatchBatakBid(b);
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
      { key: 'C', name: 'Sinek ♣', color: '#60a5fa' },
    ];
    suits.forEach((s) => {
      const btn = document.createElement('button');
      btn.className = 'action-chip';
      btn.style.borderColor = s.color;
      btn.innerHTML = `<span style="color:${s.color}; font-size:1.2rem;">${s.name}</span>`;
      btn.onclick = () => {
        this.dispatchBatakTrump(s.key);
        this.hideActionPanel();
      };
      this.dom.actionButtonsContainer.appendChild(btn);
    });
    this.dom.actionPanel.classList.add('show');
  }

  updateBatakHUD(customStatus = null) {
    const p = this.gameEngine.players;
    const mySeat = this.getMySeat();
    const scores = p.map((player) => ({
      name: player.name,
      bid: player.bid,
      tricks: player.tricksTaken,
      score: player.totalScore,
    }));

    const status =
      customStatus || (this.gameEngine.currentTurn === mySeat ? 'Sıra Sizde!' : `${p[this.gameEngine.currentTurn]?.name} Oynuyor`);
    this.dom.hudStatus.textContent = status;
    this.dom.hudGameName.textContent = `İhaleli Batak (${this.gameEngine.currentRound}/${this.gameEngine.totalRounds})`;

    const advice = this.hasAIAccess() && this.aiEnabled ? this.currentAdvice : null;
    this.scene.updateHUD({
      title: `İHALELİ BATAK (${this.gameEngine.currentRound}/${this.gameEngine.totalRounds}. Tur)`,
      status,
      trump: this.gameEngine.trumpSuit,
      currentTurn: this.toVisualSeat(this.gameEngine.currentTurn, 4),
      scores,
      aiAdvice: advice?.recommendedCard
        ? `Tavsiye: ${advice.recommendedCard.suitName} ${advice.recommendedCard.rank}`
        : advice?.summary || null,
      aiDetail: advice?.reason || null,
    });
    this.renderScoreboard();
  }

  showBatakRoundEndUI() {
    if (!this.gameEngine || this.currentGameType !== 'BATAK') return;
    const round = this.gameEngine.currentRound;
    const total = this.gameEngine.totalRounds;
    const canStartNext = !this.isMultiplayerGuest() && round < total;

    this.dom.actionTitle.textContent = `${round}. Tur Tamamlandı (${round}/${total}) — Her Elin Skorları Güncellendi`;
    this.dom.actionButtonsContainer.innerHTML = '';

    if (canStartNext) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'action-chip';
      nextBtn.style.background = '#059669';
      nextBtn.textContent = `▶️ ${round + 1}. Tura Başla`;
      nextBtn.onclick = () => {
        this.hideActionPanel();
        this.gameEngine?.startNewRound();
      };
      this.dom.actionButtonsContainer.appendChild(nextBtn);
    }

    const sbBtn = document.createElement('button');
    sbBtn.className = 'action-chip';
    sbBtn.textContent = '📋 Skor Tablosu';
    sbBtn.onclick = () => {
      this.dom.scoreboardPanel?.classList.remove('hidden');
      this.renderScoreboard();
    };
    this.dom.actionButtonsContainer.appendChild(sbBtn);

    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'action-chip pass';
    leaveBtn.textContent = '🚪 Oyundan Ayrıl';
    leaveBtn.onclick = () => this.leaveCurrentGame();
    this.dom.actionButtonsContainer.appendChild(leaveBtn);

    this.dom.actionPanel.classList.add('show');

    this.scene.showBatakRoundEndButtonsInVR(
      round + 1,
      total,
      canStartNext,
      () => {
        this.hideActionPanel();
        this.gameEngine?.startNewRound();
      },
      () => this.leaveCurrentGame(true)
    );
  }

  leaveCurrentGame(skipConfirm = false) {
    if (
      !skipConfirm &&
      this.gameEngine &&
      this.gameEngine.gameState !== 'GAME_OVER' &&
      this.gameEngine.gameState !== 'IDLE'
    ) {
      const ok = confirm('Oyun henüz tamamlanmadı. 10 tur dolmadan oyundan ayrılmak istediğinize emin misiniz?');
      if (!ok) return;
    }

    if (networkManager.isConnected) {
      networkManager.leaveRoom();
      spatialVoice.closeAllPeers();
    }

    this.resetActiveEngine();
    this.hideGameOverModal();
    this.dom.scoreboardPanel?.classList.add('hidden');
    if (this.dom.hudStatus) this.dom.hudStatus.textContent = 'Masadan ayrıldınız';
    this.appendLog('🚪 Oyundan ayrıldınız.');
    this.dom.menuModal?.classList.remove('hidden');
  }

  renderScoreboard() {
    if (!this.dom.scoreboardPanel || !this.gameEngine) return;
    const players = this.gameEngine.players || [];
    if (players.length === 0) return;

    const shortName = (n = '') => {
      const clean = String(n).replace(/\s*\(Bot\)/i, '').trim();
      return clean.length > 8 ? clean.slice(0, 7) + '…' : clean;
    };

    if (this.currentGameType === 'BATAK') {
      if (this.dom.scoreboardTitleText) this.dom.scoreboardTitleText.textContent = 'BATAK YAZBOZ';
      if (this.dom.scoreboardRoundBadge) {
        this.dom.scoreboardRoundBadge.textContent = `Tur ${this.gameEngine.currentRound}/${this.gameEngine.totalRounds}`;
      }

      if (this.dom.scoreboardLiveBar) {
        const bidderIdx = this.gameEngine.highestBidderIndex;
        const headerPill =
          bidderIdx >= 0
            ? `<span class="scoreboard-live-pill bidder">İhale: ${shortName(players[bidderIdx]?.name)} (${this.gameEngine.highestBid})</span>`
            : '<span class="scoreboard-live-pill">İhale bekleniyor</span>';
        const trickPills = players
          .map((pl) => `<span class="scoreboard-live-pill">${shortName(pl.name)}: ${pl.tricksTaken || 0} el</span>`)
          .join('');
        this.dom.scoreboardLiveBar.innerHTML = `${headerPill}${trickPills}`;
      }

      if (this.dom.scoreboardThead) {
        this.dom.scoreboardThead.innerHTML = `<tr><th>Tur</th>${players
          .map((pl) => `<th>${shortName(pl.name)}</th>`)
          .join('')}</tr>`;
      }

      const history = this.gameEngine.roundHistory || [];
      if (this.dom.scoreboardTbody) {
        if (history.length === 0) {
          this.dom.scoreboardTbody.innerHTML = `<tr><td colspan="${players.length + 1}" style="color:#94a3b8; padding:10px;">Henüz tamamlanan el yok (${this.gameEngine.currentRound}. tur sürüyor)</td></tr>`;
        } else {
          this.dom.scoreboardTbody.innerHTML = history
            .map((entry) => {
              const cells = players
                .map((pl, idx) => {
                  const rec = entry.scores?.[idx];
                  const val = rec ? rec.roundScore : 0;
                  const star = entry.bidderIndex === idx ? '★' : '';
                  const cls = val > 0 ? 'score-pos' : val < 0 ? 'score-neg' : '';
                  const txt = val > 0 ? `+${val}` : `${val}`;
                  return `<td class="${cls}">${star}${txt}</td>`;
                })
                .join('');
              return `<tr><td><strong>${entry.round}</strong></td>${cells}</tr>`;
            })
            .join('');
        }
      }

      if (this.dom.scoreboardTfoot) {
        this.dom.scoreboardTfoot.innerHTML = `<tr><td>TOPLAM</td>${players
          .map((pl) => `<td>${pl.totalScore || 0}</td>`)
          .join('')}</tr>`;
      }
      return;
    }

    // Pişti / Okey / 101 Okey genel skor görünümü
    const titles = { PISTI: 'PİŞTİ SKOR', OKEY: 'KLASİK OKEY SKOR', OKEY101: '101 OKEY SKOR' };
    if (this.dom.scoreboardTitleText) this.dom.scoreboardTitleText.textContent = titles[this.currentGameType] || 'SKOR TABLOSU';
    if (this.dom.scoreboardRoundBadge) {
      this.dom.scoreboardRoundBadge.textContent =
        this.currentGameType === 'OKEY101'
          ? `El ${this.gameEngine.currentHand || 1}/${this.gameEngine.totalHands || 3}`
          : 'Canlı';
    }
    if (this.dom.scoreboardLiveBar) this.dom.scoreboardLiveBar.innerHTML = '';
    if (this.dom.scoreboardThead) {
      this.dom.scoreboardThead.innerHTML = `<tr><th>Oyuncu</th><th>Skor</th></tr>`;
    }
    if (this.dom.scoreboardTbody) {
      this.dom.scoreboardTbody.innerHTML = players
        .map((pl) => {
          const val = this.currentGameType === 'OKEY101' ? pl.totalPenalty || 0 : (pl.totalScore ?? pl.score ?? 0);
          return `<tr><td>${pl.name}</td><td><strong>${val}</strong></td></tr>`;
        })
        .join('');
    }
    if (this.dom.scoreboardTfoot) this.dom.scoreboardTfoot.innerHTML = '';
  }

  // --- PİŞTİ ---
  startPistiGame() {
    this.resetActiveEngine();
    this.currentGameType = 'PISTI';
    this.dom.hudGameName.textContent = 'Pişti';
    this.dom.trumpContainer.style.display = 'none';
    this.updateGameControls('PISTI');

    this.scene.setGameModeView('PISTI');
    soundFx.playCardShuffle();

    const maxP = networkManager.isConnected && networkManager.maxPlayers ? networkManager.maxPlayers : 2;
    const seatedPlayers = this.getActiveSeatedPlayers(maxP);
    this.scene.updateTableAvatars(this.toVisualArray(seatedPlayers));

    this.gameEngine = new PistiGameEngine(maxP, 101);
    this.gameEngine.initPlayers(seatedPlayers);
    this.gameEngine.onEvent((event, data) => this.handlePistiEvent(event, data));
    this.gameEngine.startNewMatch();
  }

  handlePistiEvent(event, data) {
    const mySeat = this.getMySeat();
    const myPlayer = this.getMyPlayer();
    const total = this.getTotalPlayersCount();

    if (event === 'log') {
      this.appendLog(data.message);
    } else if (event === 'table_deal') {
      this.clearPlayedFeed();
      if (data.tableCards?.length > 0) {
        const top = data.tableCards[data.tableCards.length - 1];
        this.recordPlayedMove(0, top.card || top, 'card', 'Ortada');
      }
      this.scene.renderTableCards(data.tableCards);
      soundFx.playCardDeal();
      this.syncHostStateToGuests({ type: 'table_deal' });
    } else if (event === 'deal_complete') {
      this.updatePistiHUD('Kartlar Dağıtıldı');
      this.scene.renderPlayerHand(myPlayer?.hand || []);
      this.scene.renderOpponentHands(this.toVisualArray(this.gameEngine.players));
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'deal_complete' });
    } else if (event === 'turn_changed') {
      const isMyTurn = data.currentTurn === mySeat;
      this.updatePistiHUD(
        isMyTurn ? '🌟 SIRA SİZDE! Kart atın.' : `${this.gameEngine.players[data.currentTurn]?.name || 'Rakip'} oynuyor...`
      );
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'turn_changed', currentTurn: data.currentTurn });
    } else if (event === 'card_played') {
      this.recordPlayedMove(data.playerIndex, data.card, 'card');
      const vSeat = this.toVisualSeat(data.playerIndex, total);
      this.scene.animateCardPlay(data.card, vSeat, null, () => {
        const visualTable = (this.gameEngine.tableCards || []).map((tc) => ({
          ...tc,
          playerIndex: tc.playerIndex !== undefined ? this.toVisualSeat(tc.playerIndex, total) : undefined,
        }));
        this.scene.renderTableCards(visualTable);
      });
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'card_played', playerIndex: data.playerIndex, card: data.card });
    } else if (event === 'pisti_event') {
      soundFx.playPistiChime();
      this.triggerVictoryCelebration(0.5);
      this.updatePistiHUD(`⚡ ${data.isJackPisti ? 'ÇİFT PİŞTİ (+20)' : 'PİŞTİ (+10)'}!`);
      this.syncHostStateToGuests({ type: 'pisti_event', isJackPisti: data.isJackPisti });
    } else if (event === 'pile_captured') {
      const vCapturer = this.toVisualSeat(data.playerIndex, total);
      setTimeout(() => {
        this.scene.animateTrickCollection(vCapturer, () => {
          this.updatePistiHUD();
          this.updateAIAdvisor();
        });
      }, 600);
      this.syncHostStateToGuests({ type: 'pile_captured', playerIndex: data.playerIndex });
    } else if (event === 'round_ended') {
      this.updatePistiHUD('El Bitti! Skorlar güncellendi.');
      this.updateAIAdvisor();
      this.syncHostStateToGuests({ type: 'round_ended' });
    } else if (event === 'match_winner') {
      this.updatePistiHUD(`🏆 ŞAMPİYON: ${data.winner.name} (${data.winner.totalScore} Puan)`);
      this.triggerVictoryCelebration(1.0);
      this.showGameOverModal({
        winnerName: data.winner.name,
        details: `Pişti Karşılaşması Tamamlandı! Şampiyon: ${data.winner.name} (${data.winner.totalScore} Puan)`,
        gameType: 'PISTI',
      });
      this.syncHostStateToGuests({ type: 'match_winner', winner: data.winner });
    }
  }

  updatePistiHUD(customStatus = null) {
    const p = this.gameEngine.players;
    const mySeat = this.getMySeat();
    const total = this.getTotalPlayersCount();
    const scores = p.map((player) => ({
      name: player.name,
      pistis: player.pistis,
      tricks: player.captured.length,
      score: player.totalScore,
    }));

    const status =
      customStatus || (this.gameEngine.currentTurn === mySeat ? 'Sıra Sizde!' : `${p[this.gameEngine.currentTurn]?.name} Oynuyor`);
    this.dom.hudStatus.textContent = status;

    const advice = this.hasAIAccess() && this.aiEnabled ? this.currentAdvice : null;
    this.scene.updateHUD({
      title: 'PİŞTİ (Hedef 101 Puan)',
      status,
      trump: null,
      currentTurn: this.toVisualSeat(this.gameEngine.currentTurn, total),
      scores,
      aiAdvice: advice?.recommendedCard ? `Tavsiye: ${advice.recommendedCard.suitName} ${advice.recommendedCard.rank}` : advice?.summary || null,
      aiDetail: advice?.reason || null,
    });
    this.renderScoreboard();
  }

  handleUserCardReorder(card, targetIndex) {
    const player = this.getMyPlayer();
    if (!player || !player.hand || !card) return;
    const curIdx = player.hand.findIndex((c) => c.id === card.id);
    if (curIdx === -1 || targetIndex < 0 || targetIndex >= player.hand.length) {
      this.refreshCurrentGameViews();
      return;
    }
    if (curIdx !== targetIndex) {
      const [moved] = player.hand.splice(curIdx, 1);
      player.hand.splice(targetIndex, 0, moved);
      soundFx.playCardDeal(0, 0);
    }
    if (this.currentGameType === 'BATAK') {
      const mySeat = this.getMySeat();
      const isMyTurn = this.gameEngine.currentTurn === mySeat && this.gameEngine.gameState === 'PLAYING';
      const playableCards = isMyTurn ? this.gameEngine.getLegalCards(mySeat).map((c) => c.id) : null;
      this.scene.renderPlayerHand(player.hand, playableCards, this.currentAdvice?.recommendedCard?.id || null);
    } else {
      this.scene.renderPlayerHand(player.hand, null, this.currentAdvice?.recommendedCard?.id || null);
    }
    this.renderMobileHandDock();
  }

  handleUserCardSelected(card) {
    const mySeat = this.getMySeat();
    if (!this.gameEngine || this.gameEngine.gameState !== 'PLAYING') return;
    if (this.gameEngine.currentTurn !== mySeat) return;

    if (this.currentGameType === 'BATAK') {
      if (!this.gameEngine.isCardPlayable(mySeat, card.id)) {
        soundFx.playButtonClick();
        this.appendLog('⚠️ Kural ihlali: Bu kartı oynayamazsınız!');
        return;
      }
      this.dispatchPlayCard(card.id);
    } else if (this.currentGameType === 'PISTI') {
      this.dispatchPlayCard(card.id);
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
    confetti({ particleCount: Math.floor(100 * intensity), spread: 80, origin: { y: 0.6 } });
  }

  showGameOverModal({ winnerName, details }) {
    if (this.dom.gameOverWinner) this.dom.gameOverWinner.textContent = `👑 Kazanan: ${winnerName || 'Oyuncu'}`;
    if (this.dom.gameOverSummary) this.dom.gameOverSummary.textContent = details || 'Karşılaşma tamamlandı.';
    if (this.dom.gameOverModal) this.dom.gameOverModal.classList.remove('hidden');

    if (this.scene?.showVRGameOverDialog) {
      this.scene.showVRGameOverDialog({
        winnerName: winnerName || 'Oyuncu',
        scoreText: details || 'Karşılaşma tamamlandı.',
        onPlayAgain: () => {
          this.hideGameOverModal();
          if (!this.isMultiplayerGuest()) {
            if (this.isMultiplayerHost()) networkManager.startGame(this.currentGameType, networkManager.maxPlayers);
            this.startActiveGameMode();
          }
        },
        onExitVR: () => {
          this.hideGameOverModal();
          this.scene.exitVR();
        },
        onMenu: () => {
          this.hideGameOverModal();
          this.dom.menuModal.classList.remove('hidden');
        },
      });
    }
  }

  hideGameOverModal() {
    this.dom.gameOverModal?.classList.add('hidden');
    this.scene?.hideVRGameOverDialog?.();
  }

  // --- ADMIN & MEMBER FEATURE PERMISSIONS ---
  isAdminUser() {
    return Boolean(this.currentUser?.email?.trim().toLowerCase() === ADMIN_EMAIL);
  }

  hasAIAccess() {
    return Boolean(this.currentUser && (this.isAdminUser() || this.currentUser.aiAccess === true));
  }

  isVIPUser() {
    return this.hasAIAccess();
  }

  canAutoSort() {
    return Boolean(this.currentUser);
  }

  updateVIPState() {
    const isAdmin = this.isAdminUser();
    const hasAI = this.hasAIAccess();
    const canSort = this.canAutoSort();

    if (this.dom.btnProfile) {
      if (isAdmin) {
        if (this.dom.profileIcon) this.dom.profileIcon.textContent = '👑';
        if (this.dom.profileLabel) this.dom.profileLabel.textContent = 'Admin';
        this.dom.btnProfile.style.borderColor = 'var(--border-gold)';
        this.dom.btnProfile.style.color = 'var(--accent-gold)';
      } else if (hasAI) {
        if (this.dom.profileIcon) this.dom.profileIcon.textContent = '🤖';
        if (this.dom.profileLabel) this.dom.profileLabel.textContent = this.currentUser.name || 'Oyuncu';
        this.dom.btnProfile.style.borderColor = '#10b981';
        this.dom.btnProfile.style.color = '#34d399';
      } else if (canSort) {
        if (this.dom.profileIcon) this.dom.profileIcon.textContent = '👤';
        if (this.dom.profileLabel) this.dom.profileLabel.textContent = this.currentUser.name || 'Oyuncu';
        this.dom.btnProfile.style.borderColor = '';
        this.dom.btnProfile.style.color = '';
      } else {
        if (this.dom.profileIcon) this.dom.profileIcon.textContent = '👤';
        if (this.dom.profileLabel) this.dom.profileLabel.textContent = 'Giriş Yap';
        this.dom.btnProfile.style.borderColor = '';
        this.dom.btnProfile.style.color = '';
      }
    }

    if (!hasAI) {
      this.aiEnabled = false;
      this.currentAdvice = null;
    }

    if (this.dom.btnToggleAI) {
      this.dom.btnToggleAI.style.display = hasAI ? 'inline-flex' : 'none';
      this.dom.btnToggleAI.classList.toggle('active', hasAI && this.aiEnabled);
    }
    if (this.dom.aiCoachPanel) {
      this.dom.aiCoachPanel.style.display = hasAI && this.aiEnabled ? 'block' : 'none';
    }
    if (this.dom.btnAISort) {
      const isOkeyType = this.currentGameType === 'OKEY' || this.currentGameType === 'OKEY101';
      this.dom.btnAISort.style.display = hasAI && isOkeyType ? 'inline-flex' : 'none';
    }

    this.scene?.setFeaturePermissions({ canAutoSort: canSort, canUseAI: hasAI });
    this.updateGameControls(this.currentGameType);
  }

  updateGameControls(gameType) {
    const isOkeyType = gameType === 'OKEY' || gameType === 'OKEY101';
    const isCardGame = gameType === 'BATAK' || gameType === 'PISTI';
    const hasAI = this.hasAIAccess();
    const canSort = this.canAutoSort();

    if (this.dom.okeyRackControls) this.dom.okeyRackControls.style.display = isOkeyType && canSort ? 'inline-flex' : 'none';
    if (this.dom.btnAISort) this.dom.btnAISort.style.display = isOkeyType && hasAI ? 'inline-flex' : 'none';
    if (this.dom.btnPhotoDemo) this.dom.btnPhotoDemo.style.display = isOkeyType && hasAI ? 'inline-flex' : 'none';
    if (this.dom.batakControls) this.dom.batakControls.style.display = isCardGame && canSort ? 'inline-flex' : 'none';
    this.syncMobileHandMode();
  }

  sortBatakCards() {
    if (!this.canAutoSort()) return;
    const player = this.getMyPlayer();
    if (!this.gameEngine || !player?.hand) return;

    const suitOrder = { S: 0, H: 1, C: 2, D: 3 };
    const rankOrder = { A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };

    player.hand.sort((a, b) => {
      const sA = suitOrder[a.suit] ?? 0;
      const sB = suitOrder[b.suit] ?? 0;
      if (sA !== sB) return sA - sB;
      return (rankOrder[b.rank] ?? 0) - (rankOrder[a.rank] ?? 0);
    });

    soundFx.playCardShuffle();
    const mySeat = this.getMySeat();
    const isMyTurn = this.gameEngine.currentTurn === mySeat && this.gameEngine.gameState === 'PLAYING';
    const playableCards =
      this.currentGameType === 'BATAK' && isMyTurn ? this.gameEngine.getLegalCards(mySeat).map((c) => c.id) : null;
    const recId = this.hasAIAccess() && this.aiEnabled ? this.currentAdvice?.recommendedCard?.id || null : null;
    this.scene.renderPlayerHand(player.hand, playableCards, recId);
    this.renderMobileHandDock();
    this.appendLog('♠️ Kartlar renklere ve büyüklüklerine göre sıralandı.');
  }

  openAuthModal(customNotice = null) {
    this.dom.authModal.classList.remove('hidden');
    if (this.currentUser) {
      this.dom.authLoggedInView.classList.remove('hidden');
      this.dom.authFormsContainer.classList.add('hidden');
      const isAdmin = this.isAdminUser();
      const hasAI = this.hasAIAccess();
      if (this.dom.authUserName) this.dom.authUserName.textContent = this.currentUser.name || 'Oyuncu';
      if (this.dom.authUserEmailDisplay) this.dom.authUserEmailDisplay.textContent = this.currentUser.email || '';
      if (this.dom.authAvatarIcon) this.dom.authAvatarIcon.textContent = isAdmin ? '👑' : hasAI ? '🤖' : '👤';
      if (this.dom.authVipBadge) this.dom.authVipBadge.style.display = isAdmin ? 'inline-block' : 'none';
      if (this.dom.authAiGrantedBadge) this.dom.authAiGrantedBadge.style.display = !isAdmin && hasAI ? 'inline-block' : 'none';
      if (this.dom.authRegularBadge) this.dom.authRegularBadge.style.display = !isAdmin && !hasAI ? 'inline-block' : 'none';
      if (this.dom.adminAiPanel) {
        this.dom.adminAiPanel.classList.toggle('hidden', !isAdmin);
        if (isAdmin) {
          this.renderAdminUsersList();
        }
      }
    } else {
      this.dom.authLoggedInView.classList.add('hidden');
      this.dom.authFormsContainer.classList.remove('hidden');
      this.dom.adminAiPanel?.classList.add('hidden');
      this.dom.tabAuthLogin.classList.add('active');
      this.dom.tabAuthRegister.classList.remove('active');
      this.dom.viewAuthLogin.classList.remove('hidden');
      this.dom.viewAuthRegister.classList.add('hidden');
      if (customNotice) this.showAuthMsg(customNotice, 'info');
      else if (this.dom.authMsg) this.dom.authMsg.style.display = 'none';
    }
  }

  async renderAdminUsersList() {
    if (!this.isAdminUser() || !this.dom.adminUsersList) return;
    this.dom.adminUsersList.innerHTML = '<div style="color:#94a3b8; font-size:0.8rem;">Üyeler yükleniyor...</div>';
    try {
      const users = await userDb.listAllUsersForAdmin();
      const members = (users || []).filter((u) => u.email?.toLowerCase() !== ADMIN_EMAIL);
      if (members.length === 0) {
        this.dom.adminUsersList.innerHTML =
          '<div style="color:#94a3b8; font-size:0.8rem; padding:6px;">Henüz yönetici dışında kayıtlı üye yok.</div>';
        return;
      }

      this.dom.adminUsersList.innerHTML = '';
      members.forEach((u) => {
        const row = document.createElement('div');
        row.className = 'admin-user-row';

        const meta = document.createElement('div');
        meta.className = 'admin-user-meta';
        meta.innerHTML = `<span class="admin-user-name">${u.name || 'Üye'}</span><span class="admin-user-email">${u.email}</span>`;

        const btn = document.createElement('button');
        const active = Boolean(u.aiAccess);
        btn.className = `admin-toggle-btn ${active ? 'active' : ''}`;
        btn.textContent = active ? '🔒 Yetkiyi Kaldır' : '🤖 AI Yetkisi Ver';
        btn.onclick = async () => {
          btn.disabled = true;
          try {
            await userDb.setUserAiAccess(u.email, !active);
            soundFx.playButtonClick();
            this.renderAdminUsersList();
          } catch (err) {
            this.showAuthMsg(err.message || 'Yetki güncellenemedi.', 'error');
            btn.disabled = false;
          }
        };

        row.appendChild(meta);
        row.appendChild(btn);
        this.dom.adminUsersList.appendChild(row);
      });
    } catch (err) {
      this.dom.adminUsersList.innerHTML = `<div style="color:#f87171; font-size:0.8rem;">${err.message || 'Liste alınamadı.'}</div>`;
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
}

window.addEventListener('DOMContentLoaded', () => {
  new AppManager();
});
