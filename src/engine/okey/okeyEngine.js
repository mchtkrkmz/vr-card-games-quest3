import { createOkeyDeck, shuffleOkeyDeck } from './tiles.js';
import { antiCheat } from '../security/antiCheat.js';

export class OkeyGameEngine {
  constructor(mode = 'KLASIK', targetScore = 20) {
    this.mode = mode; // 'KLASIK' or '101'
    this.targetScore = targetScore;
    
    // 4 Players: [{ id, name, isBot, hand: [], discards: [], score: 0 }]
    this.players = [];
    this.deck = [];
    this.drawStack = [];
    this.gostergeTile = null;
    this.okeyTileInfo = null; // { colorKey, number }
    this.currentTurn = 0;
    this.turnPhase = 'DRAW'; // 'DRAW' or 'DISCARD'
    this.discardPiles = [[], [], [], []]; // Discards for players 0, 1, 2, 3
    this.lastDiscardedTile = null;
    this.lastDiscarderIndex = -1;
    this.gameState = 'IDLE'; // 'IDLE', 'DEALING', 'PLAYING', 'ROUND_OVER', 'GAME_OVER'
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
        hand: [], // array of tile objects
        score: this.targetScore // In Turkish Okey, players start with 20 points and drop down
      });
    }
  }

  startNewMatch() {
    this.players.forEach(p => {
      p.score = this.targetScore;
    });
    this.startNewRound();
  }

  startNewRound() {
    this.deck = antiCheat.secureShuffle(createOkeyDeck());
    this.drawStack = [...this.deck];
    this.discardPiles = [[], [], [], []];
    this.lastDiscardedTile = null;
    this.lastDiscarderIndex = -1;

    // 1. Determine Gösterge Tile (Indicator)
    // Find a non-fake tile for Gösterge
    let gostergeIdx = this.drawStack.findIndex(t => !t.isFakeOkey);
    this.gostergeTile = this.drawStack.splice(gostergeIdx, 1)[0];

    // 2. Calculate Okey Tile
    // Same color, number + 1 (if 13, wraps to 1)
    const okeyNumber = this.gostergeTile.number === 13 ? 1 : this.gostergeTile.number + 1;
    this.okeyTileInfo = {
      colorKey: this.gostergeTile.colorKey,
      colorName: this.gostergeTile.colorName,
      colorHex: this.gostergeTile.colorHex,
      number: okeyNumber
    };

    // Mark real Okey tiles and map fake okey identity
    this.drawStack.forEach(tile => {
      if (!tile.isFakeOkey && tile.colorKey === this.okeyTileInfo.colorKey && tile.number === this.okeyTileInfo.number) {
        tile.isRealOkey = true;
      }
      if (tile.isFakeOkey) {
        tile.virtualColorKey = this.okeyTileInfo.colorKey;
        tile.virtualNumber = this.okeyTileInfo.number;
      }
    });

    this.log(`🎲 Gösterge Taşı: ${this.gostergeTile.colorName} ${this.gostergeTile.number}`);
    this.log(`⭐ OKEY TAŞI: ${this.okeyTileInfo.colorName} ${this.okeyTileInfo.number}`);

    // 3. Deal Tiles: Player 0 gets 15, others get 14
    this.players.forEach((p, idx) => {
      p.hand = [];
      const count = idx === 0 ? 15 : 14;
      for (let i = 0; i < count; i++) {
        if (this.drawStack.length > 0) {
          p.hand.push(this.drawStack.pop());
        }
      }
      this.sortPlayerHand(p);
      antiCheat.generateHandChecksum(p.id, p.hand);
    });

    this.currentTurn = 0;
    // Player 0 starts with 15 tiles, so they directly enter DISCARD phase
    this.turnPhase = 'DISCARD';
    this.gameState = 'PLAYING';

    this.log(`Taşlar dağıtıldı. Sıra ${this.players[0].name}'de.`);

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

  // Draw tile from center stack
  drawFromStack(playerIndex) {
    if (this.gameState !== 'PLAYING' || this.currentTurn !== playerIndex || this.turnPhase !== 'DRAW') {
      return false;
    }
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
      tile: playerIndex === 0 ? tile : null, // hide bot drawn tiles
      drawStackCount: this.drawStack.length,
      turnPhase: this.turnPhase
    });

    this.checkTurnAction();
    return true;
  }

  // Draw discarded tile from the player on the left
  drawFromDiscard(playerIndex) {
    if (this.gameState !== 'PLAYING' || this.currentTurn !== playerIndex || this.turnPhase !== 'DRAW') {
      return false;
    }

    const leftPlayerIndex = (playerIndex + 3) % 4;
    const leftDiscardPile = this.discardPiles[leftPlayerIndex];
    if (leftDiscardPile.length === 0) return false;

    const tile = leftDiscardPile.pop();
    const player = this.players[playerIndex];
    player.hand.push(tile);
    this.turnPhase = 'DISCARD';

    this.log(`${player.name} yandan atılan ${tile.colorName} ${tile.number || 'Sahte Okey'} taşını aldı.`);
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

  // Discard a tile to player on the right
  discardTile(playerIndex, tileId, isWinningDiscard = false) {
    if (this.gameState !== 'PLAYING' || this.currentTurn !== playerIndex || this.turnPhase !== 'DISCARD') {
      return false;
    }

    const player = this.players[playerIndex];
    const tileIdx = player.hand.findIndex(t => t.id === tileId);
    if (tileIdx === -1) return false;

    const tile = player.hand.splice(tileIdx, 1)[0];
    this.discardPiles[playerIndex].push(tile);
    this.lastDiscardedTile = tile;
    this.lastDiscarderIndex = playerIndex;

    this.log(`${player.name}: ${tile.colorName} ${tile.number || 'Sahte Okey'} attı.`);

    // Check if player is declaring a Win / Finish!
    if (isWinningDiscard || this.checkIfHandWins(player.hand)) {
      const isOkeyFinish = tile.isRealOkey;
      this.log(`🎉 ${player.name} ${isOkeyFinish ? '🌟 OKEY İLE BİTTİ (Çift Ceza)!' : 'ELİ BİTİRDİ!'}`);
      this.endRound(player, isOkeyFinish);
      return true;
    }

    this.emit('tile_discarded', {
      playerIndex,
      tile,
      remainingHandCount: player.hand.length
    });

    // Advance turn to next player
    this.currentTurn = (this.currentTurn + 1) % 4;
    this.turnPhase = 'DRAW';

    this.emit('turn_changed', {
      currentTurn: this.currentTurn,
      turnPhase: this.turnPhase
    });

    this.checkTurnAction();
    return true;
  }

  // --- PER DETECTION & HAND WIN EVALUATION ---
  checkIfHandWins(hand) {
    // A winning Okey hand has 14 tiles partitioned into valid pers (or 7 pairs)
    if (hand.length !== 14) return false;

    // Check 7 Pairs (Çifte Bitme)
    if (this.check7Pairs(hand)) return true;

    // Check standard Pers
    return this.checkValidPers(hand);
  }

  check7Pairs(hand) {
    const counts = new Map();
    let okeyCount = 0;

    hand.forEach(t => {
      if (t.isRealOkey) {
        okeyCount++;
      } else {
        const key = `${t.colorKey}_${t.number}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });

    let pairs = 0;
    counts.forEach(count => {
      pairs += Math.floor(count / 2);
    });

    return (pairs + okeyCount) >= 7;
  }

  checkValidPers(hand) {
    // Greedy per evaluator for Okey
    const tiles = [...hand];
    let okeys = tiles.filter(t => t.isRealOkey);
    let regulars = tiles.filter(t => !t.isRealOkey);

    // Group by color for runs
    const colorGroups = { RED: [], BLACK: [], BLUE: [], YELLOW: [] };
    regulars.forEach(t => {
      if (colorGroups[t.colorKey]) colorGroups[t.colorKey].push(t.number);
    });

    // Check if total grouped tiles + okeys equal 14
    let groupedCount = 0;

    // Check color runs
    for (const color in colorGroups) {
      const nums = Array.from(new Set(colorGroups[color])).sort((a, b) => a - b);
      let run = 1;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] === nums[i - 1] + 1) {
          run++;
        } else {
          if (run >= 3) groupedCount += run;
          run = 1;
        }
      }
      if (run >= 3) groupedCount += run;
    }

    // Check same-number different-color groups
    const numberGroups = {};
    regulars.forEach(t => {
      if (!numberGroups[t.number]) numberGroups[t.number] = new Set();
      numberGroups[t.number].add(t.colorKey);
    });

    for (const num in numberGroups) {
      if (numberGroups[num].size >= 3) {
        groupedCount += numberGroups[num].size;
      }
    }

    return (groupedCount + okeys.length) >= 14;
  }

  // --- BOT ARTIFICIAL INTELLIGENCE ---
  checkTurnAction() {
    if (this.gameState !== 'PLAYING') return;
    const activePlayer = this.players[this.currentTurn];
    if (!activePlayer || !activePlayer.isBot) return;

    if (this.turnPhase === 'DRAW') {
      setTimeout(() => {
        if (this.currentTurn === activePlayer.id && this.turnPhase === 'DRAW') {
          // Bot decides whether to take discard or draw from stack
          const leftPlayer = (this.currentTurn + 3) % 4;
          const leftDiscard = this.discardPiles[leftPlayer];
          const topDiscard = leftDiscard.length > 0 ? leftDiscard[leftDiscard.length - 1] : null;

          if (topDiscard && this.isTileUsefulForBot(activePlayer, topDiscard)) {
            this.drawFromDiscard(activePlayer.id);
          } else {
            this.drawFromStack(activePlayer.id);
          }
        }
      }, 700 + Math.random() * 400);
    } else if (this.turnPhase === 'DISCARD') {
      setTimeout(() => {
        if (this.currentTurn === activePlayer.id && this.turnPhase === 'DISCARD') {
          const discardTile = this.chooseBotDiscardTile(activePlayer);
          if (discardTile) {
            this.discardTile(activePlayer.id, discardTile.id);
          }
        }
      }, 800 + Math.random() * 500);
    }
  }

  isTileUsefulForBot(botPlayer, candidateTile) {
    if (candidateTile.isRealOkey) return true;
    const hand = botPlayer.hand;

    // Check if it creates or extends a run
    const sameColor = hand.filter(t => t.colorKey === candidateTile.colorKey);
    const hasAdj = sameColor.some(t => Math.abs(t.number - candidateTile.number) === 1);
    if (hasAdj) return true;

    // Check if it creates or extends a same-number group
    const sameNumber = hand.filter(t => t.number === candidateTile.number && t.colorKey !== candidateTile.colorKey);
    if (sameNumber.length >= 2) return true;

    return false;
  }

  chooseBotDiscardTile(botPlayer) {
    const hand = botPlayer.hand;
    if (hand.length === 0) return null;

    // Never discard real Okey if possible
    const nonOkeys = hand.filter(t => !t.isRealOkey);
    if (nonOkeys.length === 0) return hand[0];

    // Find the most isolated tile
    let worstTile = nonOkeys[0];
    let minScore = 999;

    nonOkeys.forEach(t => {
      let connectionScore = 0;
      hand.forEach(other => {
        if (other.id !== t.id) {
          if (other.colorKey === t.colorKey && Math.abs(other.number - t.number) <= 2) {
            connectionScore += (3 - Math.abs(other.number - t.number));
          }
          if (other.number === t.number && other.colorKey !== t.colorKey) {
            connectionScore += 2;
          }
        }
      });

      if (connectionScore < minScore) {
        minScore = connectionScore;
        worstTile = t;
      }
    });

    return worstTile;
  }

  endRound(winner, isOkeyFinish) {
    this.gameState = 'ROUND_OVER';

    if (winner) {
      const penalty = isOkeyFinish ? 4 : 2;
      this.players.forEach(p => {
        if (p.id !== winner.id) {
          p.score = Math.max(0, p.score - penalty);
        }
      });
      this.log(`🏆 ELİ KAZANAN: ${winner.name}! Diğer oyuncular -${penalty} puan aldı.`);
    }

    // Check match winner (if someone reached 0 points)
    const eliminated = this.players.some(p => p.score <= 0);
    if (eliminated) {
      this.gameState = 'GAME_OVER';
      const sorted = [...this.players].sort((a, b) => b.score - a.score);
      const champion = sorted[0];
      this.log(`👑 OKEY OYUNU TAMAMLANDI! Şampiyon: ${champion.name}`);
      this.emit('match_winner', { winner: champion, players: this.players });
    } else {
      this.emit('round_ended', {
        winner,
        isOkeyFinish,
        players: this.players
      });
    }
  }
}
