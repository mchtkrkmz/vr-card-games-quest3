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
      const cfg = customNames[i];
      const isObj = cfg && typeof cfg === 'object';
      const isBot = isObj ? Boolean(cfg.isBot) : i !== 0;
      const defaultName = !isBot ? (i === 0 ? 'Oyuncu (Siz)' : `Oyuncu ${i + 1}`) : `Bot ${i}`;
      this.players.push({
        id: i,
        name: (isObj ? cfg.name : cfg) || defaultName,
        isBot,
        avatarId: isObj ? cfg.avatarId || null : null,
        clientId: isObj ? cfg.clientId || null : null,
        hand: [], // array of tile objects
        score: this.targetScore // In Turkish Okey, players start with 20 points and drop down
      });
    }
  }

  getSnapshot() {
    return {
      gameType: 'OKEY',
      mode: this.mode,
      targetScore: this.targetScore,
      drawStackCount: this.drawStack.length,
      gostergeTile: this.gostergeTile,
      okeyTileInfo: this.okeyTileInfo,
      currentTurn: this.currentTurn,
      turnPhase: this.turnPhase,
      discardPiles: this.discardPiles,
      lastDiscardedTile: this.lastDiscardedTile,
      lastDiscarderIndex: this.lastDiscarderIndex,
      gameState: this.gameState,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        avatarId: p.avatarId || null,
        clientId: p.clientId || null,
        hand: p.hand,
        score: p.score
      })),
      gameLog: this.gameLog.slice(0, 8)
    };
  }

  applySnapshot(snap) {
    if (!snap) return;
    this.mode = snap.mode ?? this.mode;
    this.targetScore = snap.targetScore ?? this.targetScore;
    this.drawStack = new Array(snap.drawStackCount ?? 0).fill(null);
    this.gostergeTile = snap.gostergeTile || null;
    this.okeyTileInfo = snap.okeyTileInfo || null;
    this.currentTurn = snap.currentTurn ?? 0;
    this.turnPhase = snap.turnPhase ?? 'DRAW';
    this.discardPiles = snap.discardPiles || [[], [], [], []];
    this.lastDiscardedTile = snap.lastDiscardedTile || null;
    this.lastDiscarderIndex = snap.lastDiscarderIndex ?? -1;
    this.gameState = snap.gameState ?? this.gameState;
    this.players = (snap.players || []).map(p => ({ ...p, hand: [...(p.hand || [])] }));
    if (Array.isArray(snap.gameLog)) this.gameLog = [...snap.gameLog];
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
      if (p.isBot) {
        this.sortPlayerHand(p);
      }
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

    const candidateTile = player.hand[tileIdx];
    const penaltyInfo = isWinningDiscard
      ? { willPenalize: false, penaltyPoints: 0, reason: null }
      : this.getDiscardPenaltyInfo(playerIndex, candidateTile);

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

    if (penaltyInfo.willPenalize) {
      player.score = Math.min(40, (player.score || 0) + penaltyInfo.penaltyPoints);
      this.log(`🚨 CEZA (+${penaltyInfo.penaltyPoints} Puan): ${player.name} — ${penaltyInfo.reason}`);
      this.emit('penalty_incurred', {
        playerIndex,
        points: penaltyInfo.penaltyPoints,
        reason: penaltyInfo.reason,
        tile
      });
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
        const effColor = t.isFakeOkey ? (t.virtualColorKey || this.okeyTileInfo?.colorKey || t.colorKey) : t.colorKey;
        const effNum = t.isFakeOkey ? (t.virtualNumber || this.okeyTileInfo?.number || t.number) : t.number;
        const key = `${effColor}_${effNum}`;
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
    if (!hand || hand.length !== 14) return false;

    const COLOR_IDX = { RED: 0, BLACK: 1, BLUE: 2, YELLOW: 3 };
    const counts = [
      new Array(14).fill(0),
      new Array(14).fill(0),
      new Array(14).fill(0),
      new Array(14).fill(0)
    ];

    let okeyCount = 0;
    for (const t of hand) {
      if (t.isRealOkey) {
        okeyCount++;
        continue;
      }
      const effColor = t.isFakeOkey ? (t.virtualColorKey || this.okeyTileInfo?.colorKey) : t.colorKey;
      const effNum = t.isFakeOkey ? (t.virtualNumber || this.okeyTileInfo?.number) : t.number;
      const cIdx = COLOR_IDX[effColor];
      if (cIdx === undefined || !effNum || effNum < 1 || effNum > 13) return false;
      counts[cIdx][effNum]++;
    }

    const solve = (remOkeys) => {
      // Find first remaining regular tile
      let firstC = -1;
      let firstN = -1;
      outer: for (let c = 0; c < 4; c++) {
        for (let n = 1; n <= 13; n++) {
          if (counts[c][n] > 0) {
            firstC = c;
            firstN = n;
            break outer;
          }
        }
      }

      if (firstC === -1) {
        // Every regular tile partitioned; remaining jokers are valid only if 0 or >= 3
        return remOkeys === 0 || remOkeys >= 3;
      }

      // Option 1: Same-number set across distinct colors (size 3 or 4)
      const otherColors = [];
      for (let c = 0; c < 4; c++) {
        if (c !== firstC && counts[c][firstN] > 0) otherColors.push(c);
      }

      // Subsets of otherColors of size >= 1 (padded with Okeys if < 2)
      const maskLimit = 1 << otherColors.length;
      for (let mask = 0; mask < maskLimit; mask++) {
        const chosen = [];
        for (let i = 0; i < otherColors.length; i++) {
          if (mask & (1 << i)) chosen.push(otherColors[i]);
        }
        const realCount = 1 + chosen.length;
        for (const targetSize of [3, 4]) {
          const okeysNeeded = targetSize - realCount;
          if (okeysNeeded >= 0 && okeysNeeded <= remOkeys && realCount >= 1) {
            counts[firstC][firstN]--;
            for (const oc of chosen) counts[oc][firstN]--;
            const ok = solve(remOkeys - okeysNeeded);
            for (const oc of chosen) counts[oc][firstN]++;
            counts[firstC][firstN]++;
            if (ok) return true;
          }
        }
      }

      // Option 2: Same-color consecutive run covering (firstC, firstN)
      // Any position in the run before firstN can be filled by an Okey
      const maxStartShift = Math.min(firstN - 1, remOkeys);
      for (let shift = 0; shift <= maxStartShift; shift++) {
        const start = firstN - shift;
        for (let end = Math.max(firstN, start + 2); end <= 13; end++) {
          let okeysNeeded = 0;
          const usedNums = [];
          let valid = true;
          for (let k = start; k <= end; k++) {
            if (counts[firstC][k] > 0) {
              usedNums.push(k);
            } else {
              okeysNeeded++;
              if (okeysNeeded > remOkeys) {
                valid = false;
                break;
              }
            }
          }
          if (!valid) break;
          for (const k of usedNums) counts[firstC][k]--;
          const ok = solve(remOkeys - okeysNeeded);
          for (const k of usedNums) counts[firstC][k]++;
          if (ok) return true;
        }
      }

      // Option 3: Classic Turkish Okey wraparound run [12, 13, 1]
      if (firstN === 1 || firstN === 12 || firstN === 13) {
        const wrapNums = [12, 13, 1];
        let okeysNeeded = 0;
        const usedWrap = [];
        for (const k of wrapNums) {
          if (counts[firstC][k] > 0) usedWrap.push(k);
          else okeysNeeded++;
        }
        if (okeysNeeded <= remOkeys) {
          for (const k of usedWrap) counts[firstC][k]--;
          const ok = solve(remOkeys - okeysNeeded);
          for (const k of usedWrap) counts[firstC][k]++;
          if (ok) return true;
        }
      }

      return false;
    };

    return solve(okeyCount);
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

  findPerTileIds(playerIndex) {
    const player = this.players[playerIndex];
    const ids = new Set();
    if (!player || !Array.isArray(player.hand)) return ids;

    const resolveId = (t) => {
      if (t.isFakeOkey) {
        return {
          colorKey: t.virtualColorKey || this.okeyTileInfo?.colorKey || '',
          number: Number(t.virtualNumber || this.okeyTileInfo?.number || 0),
        };
      }
      return { colorKey: t.colorKey || '', number: Number(t.number || 0) };
    };

    const colorGroups = { RED: [], BLACK: [], BLUE: [], YELLOW: [] };
    player.hand.forEach((t) => {
      if (t.isRealOkey) return;
      const id = resolveId(t);
      if (colorGroups[id.colorKey] && id.number > 0) {
        colorGroups[id.colorKey].push({ tile: t, num: id.number });
      }
    });

    for (const color in colorGroups) {
      const sorted = [...colorGroups[color]].sort((a, b) => a.num - b.num);
      let run = [];
      for (const item of sorted) {
        if (ids.has(item.tile.id)) continue;
        if (run.length === 0) {
          run.push(item);
        } else if (item.num === run[run.length - 1].num + 1) {
          run.push(item);
        } else if (item.num !== run[run.length - 1].num) {
          if (run.length >= 3) run.forEach((x) => ids.add(x.tile.id));
          run = [item];
        }
      }
      if (run.length >= 3) run.forEach((x) => ids.add(x.tile.id));
    }

    const numGroups = {};
    player.hand.forEach((t) => {
      if (t.isRealOkey || ids.has(t.id)) return;
      const id = resolveId(t);
      if (id.number > 0 && id.colorKey) {
        if (!numGroups[id.number]) numGroups[id.number] = [];
        if (!numGroups[id.number].some((x) => resolveId(x).colorKey === id.colorKey)) {
          numGroups[id.number].push(t);
        }
      }
    });
    for (const num in numGroups) {
      if (numGroups[num].length >= 3) {
        numGroups[num].forEach((t) => ids.add(t.id));
      }
    }

    return ids;
  }

  findWinningDiscardTiles(playerIndex) {
    const player = this.players[playerIndex];
    if (!player || !Array.isArray(player.hand) || player.hand.length !== 15) return [];
    const winners = [];
    for (let i = 0; i < player.hand.length; i++) {
      const remaining = player.hand.filter((_, idx) => idx !== i);
      if (this.checkIfHandWins(remaining)) {
        winners.push(player.hand[i]);
      }
    }
    return winners;
  }

  getDiscardPenaltyInfo(playerIndex, tile) {
    const player = this.players[playerIndex];
    if (!player || !tile) {
      return { willPenalize: false, penaltyPoints: 0, reason: null };
    }
    if (tile.isRealOkey) {
      if (player.hand.length === 15) {
        const remaining = player.hand.filter((x) => x.id !== tile.id);
        if (this.checkIfHandWins(remaining)) {
          return { willPenalize: false, penaltyPoints: 0, reason: null, isWinningOkey: true };
        }
      }
      return {
        willPenalize: true,
        penaltyPoints: 2,
        reason: 'Gerçek Okey taşını bitmeden yere atmak +2 ceza puanı verir!'
      };
    }
    return { willPenalize: false, penaltyPoints: 0, reason: null };
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
