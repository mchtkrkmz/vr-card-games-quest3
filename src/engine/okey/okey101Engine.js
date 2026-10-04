import { createOkeyDeck } from './tiles.js';
import { antiCheat } from '../security/antiCheat.js';

export class Okey101GameEngine {
  constructor(totalHands = 3) {
    this.totalHands = totalHands;
    this.currentHand = 0;

    // 4 Players: [{ id, name, isBot, hand: [], hasOpened: false, openedType: null ('SERI'|'CIFT'), openedPers: [], totalPenalty: 0, handPenalty: 0 }]
    this.players = [];
    this.deck = [];
    this.drawStack = [];
    this.gostergeTile = null;
    this.okeyTileInfo = null;
    this.currentTurn = 0;
    this.turnPhase = 'DRAW'; // 'DRAW' or 'DISCARD'
    this.discardPiles = [[], [], [], []];
    this.tableOpenedPers = []; // [{ playerIndex, perType: 'RUN'|'GROUP'|'PAIR', tiles: [] }]
    
    this.gameState = 'IDLE'; // 'IDLE', 'PLAYING', 'HAND_OVER', 'GAME_OVER'
    this.eventListeners = [];
    this.gameLog = [];
  }

  onEvent(callback) {
    this.eventListeners.push(callback);
  }

  emit(event, data) {
    this.eventListeners.forEach(cb => cb(event, data));
  }

  log(message) {
    this.gameLog.unshift(message);
    if (this.gameLog.length > 25) this.gameLog.pop();
    this.emit('log', { message, log: this.gameLog });
  }

  initPlayers(customNames = []) {
    this.players = [];
    for (let i = 0; i < 4; i++) {
      const isHuman = i === 0;
      const defaultName = isHuman ? 'Oyuncu (Siz)' : `Bot ${i}`;
      this.players.push({
        id: i,
        name: customNames[i] || defaultName,
        isBot: !isHuman,
        hand: [],
        hasOpened: false,
        openedType: null,
        openedPers: [],
        handPenalty: 0,
        totalPenalty: 0
      });
    }
  }

  startNewMatch() {
    this.currentHand = 0;
    this.players.forEach(p => {
      p.totalPenalty = 0;
      p.handPenalty = 0;
    });
    this.startNewRound();
  }

  startNewRound() {
    this.currentHand++;
    this.deck = antiCheat.secureShuffle(createOkeyDeck());
    this.drawStack = [...this.deck];
    this.discardPiles = [[], [], [], []];
    this.tableOpenedPers = [];

    // 1. Gösterge & Okey Tile
    let gostergeIdx = this.drawStack.findIndex(t => !t.isFakeOkey);
    this.gostergeTile = this.drawStack.splice(gostergeIdx, 1)[0];

    const okeyNumber = this.gostergeTile.number === 13 ? 1 : this.gostergeTile.number + 1;
    this.okeyTileInfo = {
      colorKey: this.gostergeTile.colorKey,
      colorName: this.gostergeTile.colorName,
      colorHex: this.gostergeTile.colorHex,
      number: okeyNumber
    };

    this.drawStack.forEach(tile => {
      if (!tile.isFakeOkey && tile.colorKey === this.okeyTileInfo.colorKey && tile.number === this.okeyTileInfo.number) {
        tile.isRealOkey = true;
      }
      if (tile.isFakeOkey) {
        tile.virtualColorKey = this.okeyTileInfo.colorKey;
        tile.virtualNumber = this.okeyTileInfo.number;
      }
    });

    // 2. Deal 22 tiles to starter, 21 to others
    this.players.forEach((p, idx) => {
      p.hand = [];
      p.hasOpened = false;
      p.openedType = null;
      p.openedPers = [];
      p.handPenalty = 0;

      const count = idx === 0 ? 22 : 21;
      for (let i = 0; i < count; i++) {
        if (this.drawStack.length > 0) {
          p.hand.push(this.drawStack.pop());
        }
      }
      this.sortPlayerHand(p);
    });

    this.currentTurn = 0;
    this.turnPhase = 'DISCARD'; // Starter has 22 tiles, goes directly to discard
    this.gameState = 'PLAYING';

    this.log(`--- 101 OKEY ${this.currentHand}. EL BAŞLADI ---`);
    this.log(`🎲 Gösterge: ${this.gostergeTile.colorName} ${this.gostergeTile.number} | ⭐ OKEY: ${this.okeyTileInfo.colorName} ${this.okeyTileInfo.number}`);
    this.log(`El açma barajı: 101 Puan veya 5 Çift.`);

    this.emit('deal_complete', {
      gosterge: this.gostergeTile,
      okeyInfo: this.okeyTileInfo,
      players: this.players,
      currentTurn: this.currentTurn,
      turnPhase: this.turnPhase,
      drawStackCount: this.drawStack.length
    });

    this.checkTurnAction();
  }

  sortPlayerHand(player) {
    const colorOrder = { 'RED': 0, 'BLACK': 1, 'BLUE': 2, 'YELLOW': 3, 'FAKE': 4 };
    player.hand.sort((a, b) => {
      if (a.isRealOkey) return -1;
      if (b.isRealOkey) return 1;
      const cA = colorOrder[a.colorKey] ?? 0;
      const cB = colorOrder[b.colorKey] ?? 0;
      if (cA !== cB) return cA - cB;
      return a.number - b.number;
    });
  }

  // Draw tile
  drawFromStack(playerIndex) {
    if (this.gameState !== 'PLAYING' || this.currentTurn !== playerIndex || this.turnPhase !== 'DRAW') return false;
    if (this.drawStack.length === 0) {
      this.log(`Ortada taş kalmadı! El berabere bitti.`);
      this.endRound(null, false);
      return false;
    }

    const tile = this.drawStack.pop();
    const player = this.players[playerIndex];
    player.hand.push(tile);
    this.turnPhase = 'DISCARD';

    this.log(`${player.name} ortadan taş çekti.`);
    this.emit('tile_drawn', {
      playerIndex,
      source: 'STACK',
      tile: playerIndex === 0 ? tile : null,
      drawStackCount: this.drawStack.length,
      turnPhase: this.turnPhase
    });

    this.checkTurnAction();
    return true;
  }

  drawFromDiscard(playerIndex) {
    if (this.gameState !== 'PLAYING' || this.currentTurn !== playerIndex || this.turnPhase !== 'DRAW') return false;
    const leftPlayerIndex = (playerIndex + 3) % 4;
    const leftDiscard = this.discardPiles[leftPlayerIndex];
    if (leftDiscard.length === 0) return false;

    const tile = leftDiscard.pop();
    const player = this.players[playerIndex];
    player.hand.push(tile);
    this.turnPhase = 'DISCARD';

    this.log(`${player.name} yandan atılan ${tile.colorName} ${tile.number || 'Sahte'} taşını aldı.`);
    this.emit('tile_drawn', {
      playerIndex,
      source: 'DISCARD',
      tile,
      leftPlayerIndex,
      turnPhase: this.turnPhase
    });

    this.checkTurnAction();
    return true;
  }

  // Calculate maximum valid per points in hand
  calculateHandPerPoints(player) {
    const validPers = this.findBestPersInHand(player.hand);
    let totalPoints = 0;
    validPers.forEach(per => {
      per.tiles.forEach(t => {
        const val = t.isRealOkey ? (this.okeyTileInfo.number) : (t.number || this.okeyTileInfo.number);
        totalPoints += val;
      });
    });
    return { totalPoints, pers: validPers };
  }

  findBestPersInHand(hand) {
    const pers = [];
    const colorGroups = { RED: [], BLACK: [], BLUE: [], YELLOW: [] };
    hand.forEach(t => {
      if (colorGroups[t.colorKey]) colorGroups[t.colorKey].push(t);
    });

    // 1. Color runs (3+ consecutive)
    for (const color in colorGroups) {
      const sorted = [...colorGroups[color]].sort((a, b) => a.number - b.number);
      let currentRun = [];
      for (let i = 0; i < sorted.length; i++) {
        if (currentRun.length === 0) {
          currentRun.push(sorted[i]);
        } else if (sorted[i].number === currentRun[currentRun.length - 1].number + 1) {
          currentRun.push(sorted[i]);
        } else if (sorted[i].number !== currentRun[currentRun.length - 1].number) {
          if (currentRun.length >= 3) pers.push({ type: 'RUN', tiles: [...currentRun] });
          currentRun = [sorted[i]];
        }
      }
      if (currentRun.length >= 3) pers.push({ type: 'RUN', tiles: [...currentRun] });
    }

    // 2. Same-number different-color groups (3 or 4)
    const numGroups = {};
    hand.forEach(t => {
      if (!t.isFakeOkey && !t.isRealOkey) {
        if (!numGroups[t.number]) numGroups[t.number] = [];
        if (!numGroups[t.number].some(x => x.colorKey === t.colorKey)) {
          numGroups[t.number].push(t);
        }
      }
    });

    for (const num in numGroups) {
      if (numGroups[num].length >= 3) {
        pers.push({ type: 'GROUP', tiles: numGroups[num] });
      }
    }

    return pers;
  }

  // Open Hand to Table (El Açma)
  openHand(playerIndex) {
    const player = this.players[playerIndex];
    if (player.hasOpened) return false;

    const { totalPoints, pers } = this.calculateHandPerPoints(player);
    if (totalPoints < 101 && pers.length < 5) {
      this.log(`⚠️ El açılamaz: Toplam ${totalPoints} puan (En az 101 gerekli).`);
      return false;
    }

    player.hasOpened = true;
    player.openedType = totalPoints >= 101 ? 'SERI' : 'CIFT';
    player.openedPers = pers;

    // Remove opened tiles from hand
    pers.forEach(per => {
      this.tableOpenedPers.push({ playerIndex, perType: per.type, tiles: per.tiles });
      per.tiles.forEach(ot => {
        const idx = player.hand.findIndex(t => t.id === ot.id);
        if (idx !== -1) player.hand.splice(idx, 1);
      });
    });

    this.log(`🎉 ${player.name} ELİNİ AÇTI! Toplam: ${totalPoints} Puan (${pers.length} Per).`);
    this.emit('hand_opened', { playerIndex, totalPoints, pers, remainingCount: player.hand.length });
    return true;
  }

  // Discard tile
  discardTile(playerIndex, tileId) {
    if (this.gameState !== 'PLAYING' || this.currentTurn !== playerIndex || this.turnPhase !== 'DISCARD') {
      return false;
    }

    const player = this.players[playerIndex];
    const tileIdx = player.hand.findIndex(t => t.id === tileId);
    if (tileIdx === -1) return false;

    const tile = player.hand.splice(tileIdx, 1)[0];
    this.discardPiles[playerIndex].push(tile);

    this.log(`${player.name}: ${tile.colorName} ${tile.number || 'Sahte Okey'} attı.`);

    // Check if player has 0 tiles left -> FINISH!
    if (player.hand.length === 0) {
      const isOkeyFinish = tile.isRealOkey;
      this.log(`👑 ${player.name} ${isOkeyFinish ? '🌟 OKEY ATARAK BİTTİ (-202 Puan)!' : '101 ELİNİ BİTİRDİ (-101 Puan)!'}`);
      this.endRound(player, isOkeyFinish);
      return true;
    }

    this.emit('tile_discarded', {
      playerIndex,
      tile,
      remainingHandCount: player.hand.length
    });

    this.currentTurn = (this.currentTurn + 1) % 4;
    this.turnPhase = 'DRAW';

    this.emit('turn_changed', {
      currentTurn: this.currentTurn,
      turnPhase: this.turnPhase
    });

    this.checkTurnAction();
    return true;
  }

  checkTurnAction() {
    if (this.gameState !== 'PLAYING') return;
    const activePlayer = this.players[this.currentTurn];
    if (!activePlayer || !activePlayer.isBot) return;

    if (this.turnPhase === 'DRAW') {
      setTimeout(() => {
        if (this.currentTurn === activePlayer.id && this.turnPhase === 'DRAW') {
          this.drawFromStack(activePlayer.id);
        }
      }, 700 + Math.random() * 400);
    } else if (this.turnPhase === 'DISCARD') {
      setTimeout(() => {
        if (this.currentTurn === activePlayer.id && this.turnPhase === 'DISCARD') {
          // If bot can open hand, do it!
          if (!activePlayer.hasOpened) {
            const { totalPoints } = this.calculateHandPerPoints(activePlayer);
            if (totalPoints >= 101) {
              this.openHand(activePlayer.id);
            }
          }

          const worstTile = activePlayer.hand[activePlayer.hand.length - 1] || activePlayer.hand[0];
          if (worstTile) {
            this.discardTile(activePlayer.id, worstTile.id);
          }
        }
      }, 800 + Math.random() * 500);
    }
  }

  endRound(winner, isOkeyFinish) {
    this.gameState = 'HAND_OVER';

    this.players.forEach(p => {
      if (winner && p.id === winner.id) {
        p.handPenalty = isOkeyFinish ? -202 : -101;
      } else if (!p.hasOpened) {
        p.handPenalty = isOkeyFinish ? 202 : 101; // unopened penalty
      } else {
        // Sum remaining tiles in hand
        let remainingSum = 0;
        p.hand.forEach(t => remainingSum += (t.number || 0));
        p.handPenalty = remainingSum;
      }
      p.totalPenalty += p.handPenalty;
    });

    this.log(`101 Eli Tamamlandı! Cezalar hesaplandı.`);

    if (this.currentHand >= this.totalHands) {
      this.gameState = 'GAME_OVER';
      // Winner is player with LOWEST penalty points
      const sorted = [...this.players].sort((a, b) => a.totalPenalty - b.totalPenalty);
      const champion = sorted[0];
      this.log(`🏆 101 OKEY ŞAMPİYONU: ${champion.name} (${champion.totalPenalty} Ceza Puanı)`);
      this.emit('match_winner', { winner: champion, players: this.players });
    } else {
      this.emit('round_ended', {
        hand: this.currentHand,
        totalHands: this.totalHands,
        players: this.players
      });
    }
  }
}
