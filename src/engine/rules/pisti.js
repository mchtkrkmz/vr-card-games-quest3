import { createStandardDeck, shuffleDeck } from '../cards.js';
import { antiCheat } from '../security/antiCheat.js';

export class PistiGameEngine {
  constructor(playerCount = 2, targetScore = 101) {
    this.playerCount = playerCount; // 2 or 4
    this.targetScore = targetScore;
    
    // Players: [{ id, name, isBot, hand: [], captured: [], pistis: [], score: 0, totalScore: 0 }]
    this.players = [];
    this.tableCards = []; // Cards in center: [{ card, faceUp, isHiddenBase }]
    this.deck = [];
    this.currentTurn = 0;
    this.roundDealCount = 0; // Number of deals this game
    this.maxDeals = playerCount === 2 ? 6 : 3;
    this.lastCapturerIndex = -1;
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
    if (this.gameLog.length > 20) this.gameLog.pop();
    this.emit('log', { message, log: this.gameLog });
  }

  initPlayers(customPlayerNames = []) {
    this.players = [];
    for (let i = 0; i < this.playerCount; i++) {
      const isHuman = i === 0;
      const defaultName = isHuman ? 'Oyuncu (Siz)' : `Bot ${i}`;
      this.players.push({
        id: i,
        name: customPlayerNames[i] || defaultName,
        isBot: !isHuman,
        hand: [],
        captured: [],
        pistis: [], // array of { type: 'normal'|'jack', points: 10|20 }
        roundScore: 0,
        totalScore: 0
      });
    }
  }

  startNewMatch() {
    this.players.forEach(p => {
      p.totalScore = 0;
      p.roundScore = 0;
      p.pistis = [];
      p.captured = [];
      p.hand = [];
    });
    this.startNewRound();
  }

  startNewRound() {
    this.deck = antiCheat.secureShuffle(createStandardDeck());
    this.tableCards = [];
    this.roundDealCount = 0;
    this.lastCapturerIndex = -1;
    this.currentTurn = 0;
    this.gameState = 'DEALING';

    this.players.forEach(p => {
      p.hand = [];
      p.captured = [];
      p.pistis = [];
      p.roundScore = 0;
    });

    // 1. Deal 4 cards to the table (3 face-down, 1 face-up)
    for (let i = 0; i < 4; i++) {
      const card = this.deck.pop();
      const faceUp = i === 3; // only top card is face-up
      this.tableCards.push({
        card,
        faceUp,
        isHiddenBase: i < 3
      });
    }

    this.log(`Yeni Pişti eli başladı. Masaya 4 kart açıldı.`);
    this.emit('table_deal', { tableCards: this.tableCards });

    // 2. Deal first 4 cards to players
    this.dealHands();
  }

  dealHands() {
    this.roundDealCount++;
    this.gameState = 'DEALING';

    for (let p = 0; p < this.playerCount; p++) {
      for (let c = 0; c < 4; c++) {
        if (this.deck.length > 0) {
          const card = this.deck.pop();
          this.players[p].hand.push(card);
        }
      }
    }

    this.gameState = 'PLAYING';
    this.log(`Dağıtıldı (${this.roundDealCount}/${this.maxDeals}).`);
    this.emit('deal_complete', {
      roundDealCount: this.roundDealCount,
      players: this.players,
      currentTurn: this.currentTurn
    });

    this.checkTurnAction();
  }

  getTopTableCard() {
    if (this.tableCards.length === 0) return null;
    return this.tableCards[this.tableCards.length - 1].card;
  }

  playCard(playerIndex, cardId) {
    if (this.gameState !== 'PLAYING') return false;
    if (this.currentTurn !== playerIndex) return false;

    const player = this.players[playerIndex];
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    if (cardIdx === -1) return false;

    const playedCard = player.hand.splice(cardIdx, 1)[0];
    const topCard = this.getTopTableCard();
    const tableCountBefore = this.tableCards.length;

    let isPisti = false;
    let isJackPisti = false;
    let isCaptured = false;

    // Pişti Rule Check
    if (tableCountBefore === 1 && topCard) {
      if (playedCard.rank === topCard.rank) {
        // MATCH ON 1 CARD -> PIŞTI!
        if (playedCard.rank === 'J') {
          isJackPisti = true;
          isPisti = true;
        } else {
          isPisti = true;
        }
      } else if (playedCard.rank === 'J') {
        // Jack played on single non-Jack card -> normal capture (not pisti in standard Turkish rules)
        isCaptured = true;
      }
    } else if (tableCountBefore > 1 && topCard) {
      if (playedCard.rank === topCard.rank || playedCard.rank === 'J') {
        isCaptured = true;
      }
    }

    // Add card to table visually first
    this.tableCards.push({ card: playedCard, faceUp: true, isHiddenBase: false, playerIndex });

    this.emit('card_played', {
      playerIndex,
      card: playedCard,
      tableCount: this.tableCards.length,
      isPisti,
      isJackPisti,
      isCaptured: isCaptured || isPisti
    });

    if (isPisti) {
      const points = isJackPisti ? 20 : 10;
      player.pistis.push({ type: isJackPisti ? 'jack' : 'normal', points, card: playedCard });
      this.lastCapturerIndex = playerIndex;
      this.log(`${player.name} ${isJackPisti ? '🔥 ÇİFT PİŞTİ (Vale) yaptı! (+20)' : '⚡ PİŞTİ yaptı! (+10)'}`);
      this.emit('pisti_event', { playerIndex, isJackPisti, points });

      // Collect all table cards to player
      const capturedCards = this.tableCards.map(tc => tc.card);
      player.captured.push(...capturedCards);
      this.tableCards = [];

      this.emit('pile_captured', { playerIndex, capturedCount: capturedCards.length, isPisti: true });
    } else if (isCaptured) {
      this.lastCapturerIndex = playerIndex;
      const capturedCards = this.tableCards.map(tc => tc.card);
      player.captured.push(...capturedCards);
      this.tableCards = [];
      this.log(`${player.name} yerdeki ${capturedCards.length} kartı aldı.`);
      this.emit('pile_captured', { playerIndex, capturedCount: capturedCards.length, isPisti: false });
    } else {
      this.log(`${player.name}: ${playedCard.rank} ${playedCard.suitName}`);
    }

    this.advanceTurn();
    return true;
  }

  advanceTurn() {
    // Check if current deal round is finished (all hands empty)
    const allHandsEmpty = this.players.every(p => p.hand.length === 0);

    if (allHandsEmpty) {
      if (this.roundDealCount < this.maxDeals && this.deck.length > 0) {
        // Next deal in round
        setTimeout(() => {
          this.dealHands();
        }, 1200);
        return;
      } else {
        // Round Finished!
        this.endRound();
        return;
      }
    }

    // Next player's turn
    this.currentTurn = (this.currentTurn + 1) % this.playerCount;
    this.emit('turn_changed', { currentTurn: this.currentTurn });
    this.checkTurnAction();
  }

  checkTurnAction() {
    const activePlayer = this.players[this.currentTurn];
    if (activePlayer && activePlayer.isBot && this.gameState === 'PLAYING') {
      const delay = 900 + Math.random() * 600;
      setTimeout(() => {
        if (this.currentTurn === activePlayer.id && this.gameState === 'PLAYING') {
          const chosenCard = this.chooseBotCard(activePlayer);
          if (chosenCard) {
            this.playCard(activePlayer.id, chosenCard.id);
          }
        }
      }, delay);
    }
  }

  chooseBotCard(botPlayer) {
    const hand = botPlayer.hand;
    if (hand.length === 0) return null;
    const topCard = this.getTopTableCard();
    const tableCount = this.tableCards.length;

    // 1. Check for Pişti opportunity!
    if (tableCount === 1 && topCard) {
      const matching = hand.find(c => c.rank === topCard.rank);
      if (matching) return matching;
    }

    // 2. Check for capturing matching rank (pile > 1)
    if (tableCount > 1 && topCard) {
      const matching = hand.find(c => c.rank === topCard.rank && c.rank !== 'J');
      if (matching) return matching;
    }

    // 3. Pile has juicy cards (Aces, Karo 10, Sinek 2, or >= 4 cards) -> use Jack if held
    const hasJack = hand.find(c => c.rank === 'J');
    if (hasJack && tableCount >= 3) {
      return hasJack;
    }

    // 4. If table is empty, avoid playing Jack, Karo 10, Sinek 2, or Aces if possible
    const nonValuableCards = hand.filter(c => {
      const isValuable = c.rank === 'J' || c.rank === 'A' || (c.rank === '10' && c.suit === 'D') || (c.rank === '2' && c.suit === 'C');
      return !isValuable;
    });

    if (nonValuableCards.length > 0) {
      return nonValuableCards[Math.floor(Math.random() * nonValuableCards.length)];
    }

    // 5. If only valuable or jacks left, play lowest risk
    const nonJacks = hand.filter(c => c.rank !== 'J');
    if (nonJacks.length > 0) {
      return nonJacks[0];
    }

    return hand[0];
  }

  endRound() {
    this.gameState = 'ROUND_OVER';

    // Remaining cards on table go to the last capturer
    if (this.tableCards.length > 0 && this.lastCapturerIndex >= 0) {
      const lastPlayer = this.players[this.lastCapturerIndex];
      const remaining = this.tableCards.map(tc => tc.card);
      lastPlayer.captured.push(...remaining);
      this.log(`Yerde kalan ${remaining.length} kart son alan ${lastPlayer.name}'e verildi.`);
      this.tableCards = [];
    }

    // Calculate Scores for each player
    // Scores:
    // Karo 10 (♦10) = 3 pts
    // Sinek 2 (♣2) = 2 pts
    // Aslar (A) = 1 pt each (4 total)
    // Valeler (J) = 1 pt each (4 total)
    // Most Cards = 3 pts
    // Pişti = 10 pts, Jack Pişti = 20 pts

    let maxCardsCount = -1;
    let maxCardsPlayer = -1;
    let isTiedCards = false;

    this.players.forEach((p, idx) => {
      let roundCardScore = 0;
      const count = p.captured.length;

      if (count > maxCardsCount) {
        maxCardsCount = count;
        maxCardsPlayer = idx;
        isTiedCards = false;
      } else if (count === maxCardsCount) {
        isTiedCards = true;
      }

      p.captured.forEach(c => {
        if (c.suit === 'D' && c.rank === '10') roundCardScore += 3;
        else if (c.suit === 'C' && c.rank === '2') roundCardScore += 2;
        else if (c.rank === 'A') roundCardScore += 1;
        else if (c.rank === 'J') roundCardScore += 1;
      });

      const pistiScore = p.pistis.reduce((sum, item) => sum + item.points, 0);
      p.roundScore = roundCardScore + pistiScore;
    });

    // Award Most Cards bonus (3 points)
    if (!isTiedCards && maxCardsPlayer >= 0) {
      this.players[maxCardsPlayer].roundScore += 3;
      this.log(`${this.players[maxCardsPlayer].name} en çok kartı aldı (+3 puan)!`);
    }

    // Add round scores to total
    this.players.forEach(p => {
      p.totalScore += p.roundScore;
    });

    this.log(`El bitti! Skorlar hesaplandı.`);

    // Check match winner
    const winner = this.players.find(p => p.totalScore >= this.targetScore);
    if (winner) {
      this.gameState = 'GAME_OVER';
      this.log(`🏆 OYUN BİTTİ! Kazanan: ${winner.name} (${winner.totalScore} Puan)`);
      this.emit('match_winner', { winner, players: this.players });
    } else {
      this.emit('round_ended', { players: this.players });
    }
  }
}
