import { createStandardDeck, shuffleDeck, SUITS } from '../cards.js';
import { antiCheat } from '../security/antiCheat.js';

export class BatakGameEngine {
  constructor(mode = 'IHALELI', totalRounds = 5) {
    this.mode = mode; // 'IHALELI' or 'KOZ_MACA'
    this.totalRounds = totalRounds;
    this.currentRound = 0;
    
    // 4 Players: [{ id, name, isBot, hand: [], tricksTaken: 0, bid: 0, roundScore: 0, totalScore: 0 }]
    this.players = [];
    this.deck = [];
    this.currentTurn = 0;
    this.leadPlayerIndex = 0; // Player who started current trick
    this.currentTrick = []; // [{ playerIndex, card }]
    this.trumpSuit = 'S'; // Default Spades (Maça)
    this.trumpBroken = false; // Cannot lead trump until trump is played or player has only trumps
    
    // Bidding phase state
    this.highestBid = 0;
    this.highestBidderIndex = -1;
    this.bidTurn = 0;
    this.consecutivePasses = 0;
    this.biddingActive = false;
    this.choosingTrump = false;
    
    this.gameState = 'IDLE'; // 'IDLE', 'BIDDING', 'CHOOSE_TRUMP', 'PLAYING', 'ROUND_OVER', 'GAME_OVER'
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
        tricksTaken: 0,
        bid: 0,
        hasPassed: false,
        roundScore: 0,
        totalScore: 0
      });
    }
  }

  startNewMatch() {
    this.currentRound = 0;
    this.players.forEach(p => {
      p.totalScore = 0;
      p.roundScore = 0;
    });
    this.startNewRound();
  }

  startNewRound() {
    this.currentRound++;
    this.deck = antiCheat.secureShuffle(createStandardDeck());
    this.currentTrick = [];
    this.trumpBroken = false;
    this.highestBid = 0;
    this.highestBidderIndex = -1;
    this.consecutivePasses = 0;
    this.biddingActive = false;
    this.choosingTrump = false;

    // Reset player round stats
    this.players.forEach(p => {
      p.hand = [];
      p.tricksTaken = 0;
      p.bid = 0;
      p.hasPassed = false;
      p.roundScore = 0;
    });

    // Deal 13 cards to each player
    for (let i = 0; i < 52; i++) {
      const pIdx = i % 4;
      this.players[pIdx].hand.push(this.deck[i]);
    }

    // Sort hands by suit and value for convenience
    const suitOrder = { 'S': 0, 'H': 1, 'D': 2, 'C': 3 };
    this.players.forEach(p => {
      p.hand.sort((a, b) => {
        if (suitOrder[a.suit] !== suitOrder[b.suit]) {
          return suitOrder[a.suit] - suitOrder[b.suit];
        }
        return b.value - a.value;
      });
      antiCheat.generateHandChecksum(p.id, p.hand);
    });

    this.log(`--- ${this.currentRound}. El Başladı ---`);
    this.emit('deal_complete', {
      players: this.players,
      round: this.currentRound,
      totalRounds: this.totalRounds
    });

    if (this.mode === 'KOZ_MACA') {
      this.trumpSuit = 'S';
      this.trumpBroken = false;
      this.highestBid = 0;
      this.highestBidderIndex = -1;
      this.startKozMacaBidding();
    } else {
      this.startIhaleBidding();
    }
  }

  // --- BIDDING PHASE ---
  startIhaleBidding() {
    this.gameState = 'BIDDING';
    this.biddingActive = true;
    this.bidTurn = 0; // Starts from player 0 or dealer + 1
    this.highestBid = 4; // minimum bid is 5 (or pass)
    this.highestBidderIndex = -1;
    this.consecutivePasses = 0;

    this.log(`İhale başladı. Minimum teklif 5.`);
    this.emit('bidding_started', {
      bidTurn: this.bidTurn,
      highestBid: this.highestBid,
      highestBidderIndex: this.highestBidderIndex
    });

    this.checkBidTurn();
  }

  startKozMacaBidding() {
    this.gameState = 'BIDDING';
    this.biddingActive = true;
    this.bidTurn = 0;
    this.trumpSuit = 'S';
    this.log(`Koz Maça ihale başladı. Koz sabit MAÇA (♠).`);
    this.emit('bidding_started', {
      bidTurn: this.bidTurn,
      highestBid: this.highestBid,
      highestBidderIndex: this.highestBidderIndex
    });
    this.checkBidTurn();
  }

  submitBid(playerIndex, bidValue) {
    // bidValue: 0 for Pass, 5..13 for amount
    if (this.gameState !== 'BIDDING' || this.bidTurn !== playerIndex) return false;
    const player = this.players[playerIndex];

    if (bidValue === 0) {
      // Pass
      player.hasPassed = true;
      this.log(`${player.name}: Pas`);
      this.consecutivePasses++;
    } else {
      if (bidValue <= this.highestBid && this.highestBidderIndex !== -1) {
        return false; // Invalid bid
      }
      player.bid = bidValue;
      this.highestBid = bidValue;
      this.highestBidderIndex = playerIndex;
      this.log(`${player.name} ihaleyi ${bidValue}'e yükseltti!`);
      this.consecutivePasses = 0;
    }

    this.emit('bid_placed', {
      playerIndex,
      bid: bidValue,
      highestBid: this.highestBid,
      highestBidderIndex: this.highestBidderIndex
    });

    // Check if bidding ended: 3 passes after at least one bid, or all 4 pass
    const activeBidders = this.players.filter(p => !p.hasPassed);

    if (this.highestBidderIndex !== -1 && activeBidders.length === 1 && activeBidders[0].id === this.highestBidderIndex) {
      // We have a winner!
      this.finishBidding();
      return true;
    } else if (activeBidders.length === 0) {
      // Everyone passed! Dealer gets forced 4 bid
      this.highestBidderIndex = 3;
      this.highestBid = 4;
      this.players[3].bid = 4;
      this.log(`Herkes pas dedi. İhale 4 ile zorunlu olarak ${this.players[3].name}'e kaldı.`);
      this.finishBidding();
      return true;
    }

    // Advance to next active bidder
    do {
      this.bidTurn = (this.bidTurn + 1) % 4;
    } while (this.players[this.bidTurn].hasPassed);

    this.emit('bid_turn_changed', {
      bidTurn: this.bidTurn,
      highestBid: this.highestBid,
      highestBidderIndex: this.highestBidderIndex
    });

    this.checkBidTurn();
    return true;
  }

  finishBidding() {
    this.biddingActive = false;
    const winner = this.players[this.highestBidderIndex];
    winner.bid = this.highestBid;
    this.log(`İhale ${winner.bid} ile ${winner.name}'de kaldı!`);

    if (this.mode === 'KOZ_MACA') {
      this.trumpSuit = 'S';
      this.startPlayingPhase();
    } else {
      // Winner chooses Trump
      this.gameState = 'CHOOSE_TRUMP';
      this.choosingTrump = true;
      this.emit('choose_trump_phase', { playerIndex: this.highestBidderIndex });

      if (winner.isBot) {
        setTimeout(() => {
          const chosenTrump = this.chooseBotTrump(winner);
          this.setTrump(winner.id, chosenTrump);
        }, 1000);
      }
    }
  }

  setTrump(playerIndex, suit) {
    if (this.gameState !== 'CHOOSE_TRUMP' || playerIndex !== this.highestBidderIndex) return false;
    this.trumpSuit = suit;
    this.choosingTrump = false;
    const suitName = SUITS[suit].name;
    const symbol = SUITS[suit].symbol;
    this.log(`Koz seçildi: ${suitName} (${symbol})`);
    this.emit('trump_chosen', { trumpSuit: suit, suitName, symbol });

    this.startPlayingPhase();
    return true;
  }

  startPlayingPhase() {
    this.gameState = 'PLAYING';
    this.leadPlayerIndex = this.highestBidderIndex;
    this.currentTurn = this.highestBidderIndex;
    this.currentTrick = [];

    this.log(`${this.players[this.currentTurn].name} ilk kağıdı atıyor.`);
    this.emit('playing_started', {
      currentTurn: this.currentTurn,
      trumpSuit: this.trumpSuit
    });

    this.checkTurnAction();
  }

  checkBidTurn() {
    if (this.gameState !== 'BIDDING') return;
    const activePlayer = this.players[this.bidTurn];
    if (activePlayer && activePlayer.isBot) {
      setTimeout(() => {
        if (this.gameState === 'BIDDING' && this.bidTurn === activePlayer.id) {
          const botBid = this.calculateBotBid(activePlayer);
          this.submitBid(activePlayer.id, botBid);
        }
      }, 900 + Math.random() * 500);
    }
  }

  calculateBotBid(botPlayer) {
    // Estimate tricks based on high cards and suit length
    let estimatedTricks = 0;
    const suitCounts = { 'S': 0, 'H': 0, 'D': 0, 'C': 0 };

    botPlayer.hand.forEach(c => {
      suitCounts[c.suit]++;
      if (c.rank === 'A') estimatedTricks += 1.0;
      else if (c.rank === 'K') estimatedTricks += 0.7;
      else if (c.rank === 'Q') estimatedTricks += 0.4;
      else if (c.rank === 'J') estimatedTricks += 0.2;
    });

    // Add extra tricks for longest suit (potential trump)
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    if (maxSuitCount >= 5) estimatedTricks += (maxSuitCount - 4) * 0.9;

    const roundedTricks = Math.floor(estimatedTricks);
    const minBidNeeded = this.highestBid === 0 ? 5 : this.highestBid + 1;

    if (roundedTricks >= minBidNeeded && roundedTricks >= 5 && roundedTricks <= 10) {
      return minBidNeeded;
    }
    return 0; // Pass
  }

  chooseBotTrump(botPlayer) {
    const suitCounts = { 'S': 0, 'H': 0, 'D': 0, 'C': 0 };
    const suitHighPoints = { 'S': 0, 'H': 0, 'D': 0, 'C': 0 };

    botPlayer.hand.forEach(c => {
      suitCounts[c.suit]++;
      if (c.rank === 'A') suitHighPoints[c.suit] += 4;
      if (c.rank === 'K') suitHighPoints[c.suit] += 3;
      if (c.rank === 'Q') suitHighPoints[c.suit] += 2;
    });

    let bestSuit = 'S';
    let bestScore = -1;

    for (const suit of ['S', 'H', 'D', 'C']) {
      const score = suitCounts[suit] * 3 + suitHighPoints[suit];
      if (score > bestScore) {
        bestScore = score;
        bestSuit = suit;
      }
    }
    return bestSuit;
  }

  // --- TRICK PLAY RULES ENFORCEMENT ---
  getLegalCards(playerIndex) {
    const player = this.players[playerIndex];
    const hand = player.hand;
    if (hand.length === 0) return [];

    // If starting a trick (Lead Player)
    if (this.currentTrick.length === 0) {
      // Cannot lead trump unless trump has been broken OR player only has trumps
      const nonTrumpCards = hand.filter(c => c.suit !== this.trumpSuit);
      if (!this.trumpBroken && nonTrumpCards.length > 0) {
        return nonTrumpCards;
      }
      return hand;
    }

    // Following a trick
    const leadCard = this.currentTrick[0].card;
    const leadSuit = leadCard.suit;

    // 1. Must follow lead suit if held
    const cardsOfLeadSuit = hand.filter(c => c.suit === leadSuit);
    if (cardsOfLeadSuit.length > 0) {
      // Rule: In Batak, player MUST raise (play higher card of lead suit) if they can!
      const currentHighestLeadVal = Math.max(
        ...this.currentTrick.filter(t => t.card.suit === leadSuit).map(t => t.card.value)
      );
      const higherCards = cardsOfLeadSuit.filter(c => c.value > currentHighestLeadVal);
      if (higherCards.length > 0) {
        return higherCards;
      }
      return cardsOfLeadSuit;
    }

    // 2. Player has NO cards of lead suit -> MUST play Koz (Trump / Çakmak) if held
    const trumpCardsInHand = hand.filter(c => c.suit === this.trumpSuit);
    if (trumpCardsInHand.length > 0) {
      // If trump already played in this trick by opponent, MUST play higher trump if held!
      const trumpsInTrick = this.currentTrick.filter(t => t.card.suit === this.trumpSuit);
      if (trumpsInTrick.length > 0) {
        const highestTrumpInTrick = Math.max(...trumpsInTrick.map(t => t.card.value));
        const higherTrumps = trumpCardsInHand.filter(c => c.value > highestTrumpInTrick);
        if (higherTrumps.length > 0) {
          return higherTrumps;
        }
      }
      return trumpCardsInHand;
    }

    // 3. Player has no lead suit and no trump -> Can discard any card (Yan kaçma)
    return hand;
  }

  isCardPlayable(playerIndex, cardId) {
    const legalCards = this.getLegalCards(playerIndex);
    return legalCards.some(c => c.id === cardId);
  }

  playCard(playerIndex, cardId) {
    if (this.gameState !== 'PLAYING' || this.currentTurn !== playerIndex) return false;
    if (!this.isCardPlayable(playerIndex, cardId)) {
      this.log(`⚠️ Kural ihlali: Bu kartı oynayamazsınız!`);
      return false;
    }

    const player = this.players[playerIndex];
    const cardIdx = player.hand.findIndex(c => c.id === cardId);
    const playedCard = player.hand.splice(cardIdx, 1)[0];

    if (playedCard.suit === this.trumpSuit && !this.trumpBroken) {
      this.trumpBroken = true;
      this.log(`💥 Koz açıldı! (${SUITS[this.trumpSuit].name})`);
    }

    this.currentTrick.push({
      playerIndex,
      card: playedCard
    });

    this.log(`${player.name}: ${playedCard.rank} ${playedCard.suitName}`);
    this.emit('card_played', {
      playerIndex,
      card: playedCard,
      trickCount: this.currentTrick.length
    });

    if (this.currentTrick.length === 4) {
      // Trick is complete
      setTimeout(() => {
        this.evaluateTrick();
      }, 1000);
    } else {
      // Next player in trick
      this.currentTurn = (this.currentTurn + 1) % 4;
      this.emit('turn_changed', { currentTurn: this.currentTurn });
      this.checkTurnAction();
    }

    return true;
  }

  evaluateTrick() {
    const leadSuit = this.currentTrick[0].card.suit;
    let winningPlay = this.currentTrick[0];

    for (let i = 1; i < this.currentTrick.length; i++) {
      const play = this.currentTrick[i];
      // If current winner is trump:
      if (winningPlay.card.suit === this.trumpSuit) {
        if (play.card.suit === this.trumpSuit && play.card.value > winningPlay.card.value) {
          winningPlay = play;
        }
      } else {
        // If current winner is lead suit:
        if (play.card.suit === this.trumpSuit) {
          winningPlay = play; // Trump beats lead suit
        } else if (play.card.suit === leadSuit && play.card.value > winningPlay.card.value) {
          winningPlay = play;
        }
      }
    }

    const winner = this.players[winningPlay.playerIndex];
    winner.tricksTaken++;
    this.log(`🏆 Eli ${winner.name} aldı (${winningPlay.card.rank} ${winningPlay.card.suitName})! Toplam: ${winner.tricksTaken}`);

    this.emit('trick_completed', {
      winnerIndex: winner.id,
      winningCard: winningPlay.card,
      trick: this.currentTrick
    });

    this.currentTrick = [];

    // Check if hand finished (all 13 tricks played)
    const allCardsPlayed = this.players.every(p => p.hand.length === 0);
    if (allCardsPlayed) {
      setTimeout(() => {
        this.endRound();
      }, 1200);
    } else {
      this.leadPlayerIndex = winner.id;
      this.currentTurn = winner.id;
      this.emit('turn_changed', { currentTurn: this.currentTurn });
      this.checkTurnAction();
    }
  }

  checkTurnAction() {
    if (this.gameState !== 'PLAYING') return;
    const activePlayer = this.players[this.currentTurn];
    if (activePlayer && activePlayer.isBot) {
      setTimeout(() => {
        if (this.gameState === 'PLAYING' && this.currentTurn === activePlayer.id) {
          const chosenCard = this.chooseBotPlayCard(activePlayer);
          if (chosenCard) {
            this.playCard(activePlayer.id, chosenCard.id);
          }
        }
      }, 800 + Math.random() * 500);
    }
  }

  chooseBotPlayCard(botPlayer) {
    const legalCards = this.getLegalCards(botPlayer.id);
    if (legalCards.length === 0) return null;

    // Leading a trick
    if (this.currentTrick.length === 0) {
      // Prefer leading high cards (Aces) of side suits
      const aces = legalCards.filter(c => c.rank === 'A' && c.suit !== this.trumpSuit);
      if (aces.length > 0) return aces[0];

      // Otherwise lead a low card
      legalCards.sort((a, b) => a.value - b.value);
      return legalCards[0];
    }

    // Following a trick
    // Sort legal cards descending
    legalCards.sort((a, b) => b.value - a.value);

    // If we have cards that win the trick, play the lowest winning card to conserve high cards
    const leadSuit = this.currentTrick[0].card.suit;
    let highestTrickCard = this.currentTrick[0].card;
    for (const t of this.currentTrick) {
      if (t.card.suit === this.trumpSuit) {
        if (highestTrickCard.suit !== this.trumpSuit || t.card.value > highestTrickCard.value) {
          highestTrickCard = t.card;
        }
      } else if (highestTrickCard.suit !== this.trumpSuit && t.card.suit === leadSuit && t.card.value > highestTrickCard.value) {
        highestTrickCard = t.card;
      }
    }

    const winningCards = legalCards.filter(c => {
      if (highestTrickCard.suit === this.trumpSuit) {
        return c.suit === this.trumpSuit && c.value > highestTrickCard.value;
      } else {
        if (c.suit === this.trumpSuit) return true;
        return c.suit === leadSuit && c.value > highestTrickCard.value;
      }
    });

    if (winningCards.length > 0) {
      // Pick lowest winning card
      return winningCards[winningCards.length - 1];
    }

    // Cannot win trick, discard lowest card
    return legalCards[legalCards.length - 1];
  }

  endRound() {
    this.gameState = 'ROUND_OVER';
    const bidder = this.players[this.highestBidderIndex];

    // Batak Scoring:
    // Bidder:
    // - If made (tricksTaken >= bid): + (bid * 10) + (tricksTaken - bid)
    // - If failed (tricksTaken < bid): - (bid * 10) (BATTINIZ!)
    // Others:
    // - Standard: + (tricksTaken * 10) (if tricksTaken == 0, some rules give 0 or -10)

    this.players.forEach(p => {
      if (p.id === this.highestBidderIndex) {
        if (p.tricksTaken >= p.bid) {
          const extra = p.tricksTaken - p.bid;
          p.roundScore = p.bid * 10 + extra;
          this.log(`🎉 ${p.name} ihaleyi tutturdu (${p.tricksTaken}/${p.bid})! +${p.roundScore} Puan.`);
        } else {
          p.roundScore = -(p.bid * 10);
          this.log(`💥 ${p.name} BATTI (${p.tricksTaken}/${p.bid})! ${p.roundScore} Puan.`);
        }
      } else {
        p.roundScore = p.tricksTaken * 10;
        this.log(`${p.name}: ${p.tricksTaken} el aldı (+${p.roundScore} Puan).`);
      }
      p.totalScore += p.roundScore;
    });

    if (this.currentRound >= this.totalRounds) {
      this.gameState = 'GAME_OVER';
      // Find player with highest total score
      const sorted = [...this.players].sort((a, b) => b.totalScore - a.totalScore);
      const winner = sorted[0];
      this.log(`🏆 BATAK OYUNU TAMAMLANDI! Şampiyon: ${winner.name} (${winner.totalScore} Puan)`);
      this.emit('match_winner', { winner, players: this.players });
    } else {
      this.emit('round_ended', {
        round: this.currentRound,
        totalRounds: this.totalRounds,
        players: this.players
      });
    }
  }
}
