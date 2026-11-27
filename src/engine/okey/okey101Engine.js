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
        hand: [],
        hasOpened: false,
        openedType: null,
        openedPers: [],
        handPenalty: 0,
        extraPenalty: 0,
        totalPenalty: 0
      });
    }
  }

  getSnapshot() {
    return {
      gameType: 'OKEY101',
      totalHands: this.totalHands,
      currentHand: this.currentHand,
      drawStackCount: this.drawStack.length,
      gostergeTile: this.gostergeTile,
      okeyTileInfo: this.okeyTileInfo,
      currentTurn: this.currentTurn,
      turnPhase: this.turnPhase,
      discardPiles: this.discardPiles,
      tableOpenedPers: this.tableOpenedPers,
      gameState: this.gameState,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        avatarId: p.avatarId || null,
        clientId: p.clientId || null,
        hand: p.hand,
        hasOpened: p.hasOpened,
        openedType: p.openedType,
        openedPers: p.openedPers,
        handPenalty: p.handPenalty,
        extraPenalty: p.extraPenalty || 0,
        totalPenalty: p.totalPenalty
      })),
      gameLog: this.gameLog.slice(0, 8)
    };
  }

  applySnapshot(snap) {
    if (!snap) return;
    this.totalHands = snap.totalHands ?? this.totalHands;
    this.currentHand = snap.currentHand ?? this.currentHand;
    this.drawStack = new Array(snap.drawStackCount ?? 0).fill(null);
    this.gostergeTile = snap.gostergeTile || null;
    this.okeyTileInfo = snap.okeyTileInfo || null;
    this.currentTurn = snap.currentTurn ?? 0;
    this.turnPhase = snap.turnPhase ?? 'DRAW';
    this.discardPiles = snap.discardPiles || [[], [], [], []];
    this.tableOpenedPers = snap.tableOpenedPers || [];
    this.gameState = snap.gameState ?? this.gameState;
    this.players = (snap.players || []).map(p => ({
      ...p,
      extraPenalty: p.extraPenalty || 0,
      hand: [...(p.hand || [])],
      openedPers: [...(p.openedPers || [])]
    }));
    if (Array.isArray(snap.gameLog)) this.gameLog = [...snap.gameLog];
  }

  startNewMatch() {
    this.currentHand = 0;
    this.players.forEach(p => {
      p.totalPenalty = 0;
      p.handPenalty = 0;
      p.extraPenalty = 0;
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
      p.extraPenalty = 0;

      const count = idx === 0 ? 22 : 21;
      for (let i = 0; i < count; i++) {
        if (this.drawStack.length > 0) {
          p.hand.push(this.drawStack.pop());
        }
      }
      if (p.isBot) {
        this.sortPlayerHand(p);
      }
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

  _resolveTileIdentity(tile) {
    if (!tile) return { colorKey: '', number: 0, isWild: false };
    if (tile.isRealOkey) {
      return {
        colorKey: this.okeyTileInfo?.colorKey || tile.colorKey || '',
        number: Number(this.okeyTileInfo?.number || tile.number || 0),
        isWild: true
      };
    }
    if (tile.isFakeOkey) {
      return {
        colorKey: tile.virtualColorKey || this.okeyTileInfo?.colorKey || '',
        number: Number(tile.virtualNumber || this.okeyTileInfo?.number || 0),
        isWild: false
      };
    }
    return {
      colorKey: tile.colorKey || '',
      number: Number(tile.number || 0),
      isWild: false
    };
  }

  findBestPersInHand(hand) {
    const pers = [];
    const usedIds = new Set();
    const colorGroups = { RED: [], BLACK: [], BLUE: [], YELLOW: [] };

    (hand || []).forEach(t => {
      if (t.isRealOkey) return;
      const id = this._resolveTileIdentity(t);
      if (colorGroups[id.colorKey] && id.number > 0) {
        colorGroups[id.colorKey].push({ tile: t, num: id.number });
      }
    });

    // 1. Color runs (3+ consecutive) without reusing the same tile instance
    for (const color in colorGroups) {
      const sorted = [...colorGroups[color]].sort((a, b) => a.num - b.num);
      let currentRun = [];
      for (let i = 0; i < sorted.length; i++) {
        if (usedIds.has(sorted[i].tile.id)) continue;
        if (currentRun.length === 0) {
          currentRun.push(sorted[i]);
        } else if (sorted[i].num === currentRun[currentRun.length - 1].num + 1) {
          currentRun.push(sorted[i]);
        } else if (sorted[i].num !== currentRun[currentRun.length - 1].num) {
          if (currentRun.length >= 3) {
            pers.push({ type: 'RUN', tiles: currentRun.map(x => x.tile) });
            currentRun.forEach(x => usedIds.add(x.tile.id));
          }
          currentRun = [sorted[i]];
        }
      }
      if (currentRun.length >= 3) {
        pers.push({ type: 'RUN', tiles: currentRun.map(x => x.tile) });
        currentRun.forEach(x => usedIds.add(x.tile.id));
      }
    }

    // 2. Same-number different-color groups (3 or 4) from remaining unused tiles
    const numGroups = {};
    (hand || []).forEach(t => {
      if (t.isRealOkey || usedIds.has(t.id)) return;
      const id = this._resolveTileIdentity(t);
      if (id.number > 0 && id.colorKey) {
        if (!numGroups[id.number]) numGroups[id.number] = [];
        if (!numGroups[id.number].some(x => this._resolveTileIdentity(x).colorKey === id.colorKey)) {
          numGroups[id.number].push(t);
        }
      }
    });

    for (const num in numGroups) {
      if (numGroups[num].length >= 3) {
        pers.push({ type: 'GROUP', tiles: numGroups[num] });
        numGroups[num].forEach(t => usedIds.add(t.id));
      }
    }

    return pers;
  }

  canMeldTileToPer(tile, per) {
    if (!tile || !per || !Array.isArray(per.tiles) || per.tiles.length === 0) {
      return { ok: false };
    }
    const perKind = per.perType || per.type;
    const nonWilds = per.tiles
      .map((t, idx) => ({ id: this._resolveTileIdentity(t), idx }))
      .filter(x => !x.id.isWild && x.id.number > 0);
    if (nonWilds.length === 0) return { ok: false };

    if (perKind === 'RUN') {
      if (tile.isRealOkey) {
        return per.tiles.length < 13 ? { ok: true, position: 'END' } : { ok: false };
      }
      const runColor = nonWilds[0].id.colorKey;
      const id = this._resolveTileIdentity(tile);
      if (id.colorKey !== runColor || id.number <= 0) return { ok: false };

      const hasWrapOne = nonWilds.some(
        x => x.id.number === 1 && x.idx > 0 && nonWilds[0].id.number >= 11
      );
      const firstNum = nonWilds[0].id.number - nonWilds[0].idx;
      const lastNum = firstNum + per.tiles.length - 1;

      if (firstNum > 1 && id.number === firstNum - 1) {
        return { ok: true, position: 'START' };
      }
      if (!hasWrapOne && lastNum < 13 && id.number === lastNum + 1) {
        return { ok: true, position: 'END' };
      }
      if (!hasWrapOne && lastNum === 13 && id.number === 1 && !nonWilds.some(x => x.id.number === 1)) {
        return { ok: true, position: 'END' };
      }
      return { ok: false };
    }

    if (perKind === 'GROUP') {
      if (per.tiles.length >= 4) return { ok: false };
      if (tile.isRealOkey) {
        return { ok: true, position: 'END' };
      }
      const groupNum = nonWilds[0].id.number;
      const existingColors = new Set(nonWilds.map(x => x.id.colorKey));
      const id = this._resolveTileIdentity(tile);
      if (id.number === groupNum && id.colorKey && !existingColors.has(id.colorKey)) {
        return { ok: true, position: 'END' };
      }
      return { ok: false };
    }

    return { ok: false };
  }

  findMeldTargetsForTile(tile) {
    if (!tile || !Array.isArray(this.tableOpenedPers)) return [];
    const targets = [];
    this.tableOpenedPers.forEach((per, perIndex) => {
      const check = this.canMeldTileToPer(tile, per);
      if (check.ok) {
        targets.push({ perIndex, per, position: check.position });
      }
    });
    return targets;
  }

  findMeldableTiles(playerIndex) {
    const player = this.players[playerIndex];
    if (!player || !player.hasOpened) return [];
    const results = [];
    for (const tile of player.hand) {
      const targets = this.findMeldTargetsForTile(tile);
      if (targets.length > 0) {
        results.push({ tile, targets });
      }
    }
    return results;
  }

  meldTile(playerIndex, tileId, targetPerIndex = null) {
    if (this.gameState !== 'PLAYING' || this.currentTurn !== playerIndex || this.turnPhase !== 'DISCARD') {
      return false;
    }
    const player = this.players[playerIndex];
    if (!player || !player.hasOpened) {
      this.log('⚠️ Taş işlemek için önce elinizi (101+) açmış olmalısınız.');
      return false;
    }
    const tileIdx = player.hand.findIndex(t => t.id === tileId);
    if (tileIdx === -1) return false;
    const tile = player.hand[tileIdx];

    let chosenTarget = null;
    if (targetPerIndex !== null && targetPerIndex !== undefined && this.tableOpenedPers[targetPerIndex]) {
      const per = this.tableOpenedPers[targetPerIndex];
      const check = this.canMeldTileToPer(tile, per);
      if (check.ok) {
        chosenTarget = { perIndex: targetPerIndex, per, position: check.position };
      }
    }
    if (!chosenTarget) {
      const allTargets = this.findMeldTargetsForTile(tile);
      chosenTarget = allTargets[0] || null;
    }
    if (!chosenTarget) return false;

    player.hand.splice(tileIdx, 1);
    if (chosenTarget.position === 'START') {
      chosenTarget.per.tiles.unshift(tile);
    } else {
      chosenTarget.per.tiles.push(tile);
    }

    const tileText = `${tile.colorName || ''} ${tile.isFakeOkey ? 'Sahte Okey' : tile.number}`.trim();
    this.log(`✨ ${player.name}, ${tileText} taşını masadaki pere işledi!`);
    this.emit('tile_melded', {
      playerIndex,
      tile,
      perIndex: chosenTarget.perIndex,
      remainingHandCount: player.hand.length
    });

    if (player.hand.length === 0) {
      this.log(`👑 ${player.name} TÜM TAŞLARINI İŞLEYEREK BİTİRDİ (-101 Puan)!`);
      this.endRound(player, false);
    }
    return true;
  }

  meldAllPossible(playerIndex) {
    let count = 0;
    for (let step = 0; step < 22; step++) {
      const player = this.players[playerIndex];
      if (!player || !player.hasOpened || player.hand.length === 0) break;
      const meldable = this.findMeldableTiles(playerIndex);
      if (meldable.length === 0) break;
      const item = meldable[0];
      const ok = this.meldTile(playerIndex, item.tile.id, item.targets[0]?.perIndex);
      if (!ok) break;
      count++;
      if (this.gameState !== 'PLAYING') break;
    }
    return count;
  }

  getDiscardPenaltyInfo(playerIndex, tile) {
    const player = this.players[playerIndex];
    if (!player || !tile || player.hand.length <= 1) {
      return { willPenalize: false, penaltyPoints: 0, reason: null, targetPerIndex: null };
    }
    if (tile.isRealOkey) {
      return {
        willPenalize: true,
        penaltyPoints: 101,
        reason: 'Yere Okey atmak +101 ceza puanı kazandırır!',
        targetPerIndex: null
      };
    }
    const targets = this.findMeldTargetsForTile(tile);
    if (targets.length > 0) {
      return {
        willPenalize: true,
        penaltyPoints: 101,
        reason: 'İşlek taş! Masadaki açılmış pere işleyen taşı atmak +101 ceza puanı kazandırır!',
        targetPerIndex: targets[0].perIndex
      };
    }
    return { willPenalize: false, penaltyPoints: 0, reason: null, targetPerIndex: null };
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

    const candidateTile = player.hand[tileIdx];
    const penaltyInfo = this.getDiscardPenaltyInfo(playerIndex, candidateTile);

    const tile = player.hand.splice(tileIdx, 1)[0];
    this.discardPiles[playerIndex].push(tile);

    this.log(`${player.name}: ${tile.colorName} ${tile.isFakeOkey ? 'Sahte Okey' : tile.number} attı.`);

    if (penaltyInfo.willPenalize) {
      player.extraPenalty = (player.extraPenalty || 0) + penaltyInfo.penaltyPoints;
      player.totalPenalty += penaltyInfo.penaltyPoints;
      this.log(`🚨 CEZA (+${penaltyInfo.penaltyPoints} Puan): ${player.name} — ${penaltyInfo.reason}`);
      this.emit('penalty_incurred', {
        playerIndex,
        points: penaltyInfo.penaltyPoints,
        reason: penaltyInfo.reason,
        tile
      });
    }

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

          // Meld any extra fitting tiles onto table pers if opened
          if (activePlayer.hasOpened && activePlayer.hand.length > 1) {
            this.meldAllPossible(activePlayer.id);
          }
          if (this.gameState !== 'PLAYING' || this.currentTurn !== activePlayer.id) return;

          // Prefer discarding a safe tile that does not trigger +101 işlek/okey penalty
          const safeTile = [...activePlayer.hand]
            .reverse()
            .find(t => !this.getDiscardPenaltyInfo(activePlayer.id, t).willPenalize);
          const chosen = safeTile || activePlayer.hand[activePlayer.hand.length - 1] || activePlayer.hand[0];
          if (chosen) {
            this.discardTile(activePlayer.id, chosen.id);
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
