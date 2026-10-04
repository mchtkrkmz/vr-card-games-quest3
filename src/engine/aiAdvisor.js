// AI Game Advisor & Tactical Engine for Turkish Kıraathane Games
// Supports: Klasik Okey, 101 Okey, İhaleli Batak, Pişti

export class AIAdvisorEngine {
  constructor() {
    this.enabled = true;
    this.lastAdvice = null;
  }

  // ==========================================
  // 1. KLASIK OKEY & 101 OKEY ADVISOR
  // ==========================================
  getOkeyAdvice(gameEngine, is101 = false) {
    if (!gameEngine || !gameEngine.players || !gameEngine.players[0]) {
      return null;
    }

    const player = gameEngine.players[0];
    const hand = [...player.hand];
    const discardPiles = gameEngine.discardPiles || [[], [], [], []];
    const leftDiscard = discardPiles[3] || [];
    const topDiscard = leftDiscard.length > 0 ? leftDiscard[leftDiscard.length - 1] : null;

    // A. Gather seen tiles on the table (dead tiles tracking)
    const seenTilesCount = new Map();
    discardPiles.forEach(pile => {
      pile.forEach(t => {
        if (!t.isRealOkey && t.number) {
          const key = `${t.colorKey}_${t.number}`;
          seenTilesCount.set(key, (seenTilesCount.get(key) || 0) + 1);
        }
      });
    });

    // B. Decompose hand into Complete Pers, Near-Pers (Waiting), and Orphans
    const analysis = this.analyzeOkeyHand(hand, seenTilesCount);

    // C. Discard pile evaluation (Should player take left discard?)
    let drawAdvice = null;
    if (gameEngine.turnPhase === 'DRAW' && gameEngine.currentTurn === 0) {
      if (topDiscard) {
        const potentialHand = [...hand, topDiscard];
        const newAnalysis = this.analyzeOkeyHand(potentialHand, seenTilesCount);
        const helpsPer = newAnalysis.completePers.length > analysis.completePers.length ||
          newAnalysis.nearPers.length > analysis.nearPers.length;

        if (helpsPer) {
          drawAdvice = {
            recommendedSource: 'DISCARD',
            title: '📥 Yandan Alın!',
            text: `Yandaki ${topDiscard.colorName} ${topDiscard.number || 'Sahte'} elinizdeki per grubunu tamamlıyor.`
          };
        } else {
          drawAdvice = {
            recommendedSource: 'STACK',
            title: '🎲 Ortadan Çekin',
            text: 'Yandaki taş elinize uymuyor, ortadan yeni taş çekmeniz daha avantajlı.'
          };
        }
      } else {
        drawAdvice = {
          recommendedSource: 'STACK',
          title: '🎲 Ortadan Çekin',
          text: 'Ortadaki desteden yeni taş çekin.'
        };
      }
    }

    // D. Best tile to discard
    let bestDiscard = null;
    if (hand.length > 0) {
      bestDiscard = this.findBestOkeyDiscard(hand, analysis, seenTilesCount);
    }

    // E. 101-specific checks
    let info101 = null;
    if (is101) {
      const perPoints = analysis.perPoints;
      const canOpen = !player.hasOpened && perPoints >= 101;
      const pointsLeft = Math.max(0, 101 - perPoints);

      info101 = {
        perPoints,
        canOpen,
        pointsLeft,
        hasOpened: player.hasOpened,
        tip: player.hasOpened
          ? 'Elinizi açtınız! Şimdi ıstakanızdaki boşta kalan taşları masadaki açık perlere işleyebilirsiniz.'
          : canOpen
          ? `🌟 Tebrikler! Perleriniz ${perPoints} puan yapıyor. Hemen 'El Aç' butonuna basabilirsiniz!`
          : `El açmak için 101 puana ulaşmalısınız. Gereken puan: ${pointsLeft}`
      };
    }

    return {
      gameType: is101 ? 'OKEY101' : 'OKEY',
      analysis,
      drawAdvice,
      bestDiscard,
      info101,
      summary: this.formatOkeySummary(analysis, bestDiscard, is101, info101)
    };
  }

  // Decompose hand into structured groupings
  analyzeOkeyHand(hand, seenTilesCount) {
    const okeys = hand.filter(t => t.isRealOkey);
    const nonOkeys = hand.filter(t => !t.isRealOkey);

    const completePers = [];
    const usedTileIds = new Set();

    // 1. Find Same-Color Consecutive Runs (e.g. Red 4-5-6-7)
    const colorGroups = { RED: [], BLACK: [], BLUE: [], YELLOW: [] };
    nonOkeys.forEach(t => {
      if (colorGroups[t.colorKey]) colorGroups[t.colorKey].push(t);
    });

    for (const color in colorGroups) {
      const sorted = [...colorGroups[color]].sort((a, b) => a.number - b.number);
      // Group consecutive
      let currentRun = [];
      for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        if (currentRun.length === 0) {
          currentRun.push(curr);
        } else {
          const last = currentRun[currentRun.length - 1];
          if (curr.number === last.number + 1) {
            currentRun.push(curr);
          } else if (curr.number === last.number) {
            // Duplicate number, skip for this run
          } else {
            if (currentRun.length >= 3) {
              completePers.push({
                type: 'RUN',
                name: `${curr.colorName} Serisi (${currentRun[0].number}-${currentRun[currentRun.length - 1].number})`,
                tiles: [...currentRun]
              });
              currentRun.forEach(t => usedTileIds.add(t.id));
            }
            currentRun = [curr];
          }
        }
      }
      if (currentRun.length >= 3) {
        completePers.push({
          type: 'RUN',
          name: `${sorted[0].colorName} Serisi (${currentRun[0].number}-${currentRun[currentRun.length - 1].number})`,
          tiles: [...currentRun]
        });
        currentRun.forEach(t => usedTileIds.add(t.id));
      }
    }

    // 2. Find Same-Number Different-Color Groups (e.g. 7 Red, 7 Black, 7 Blue)
    const numberGroups = {};
    nonOkeys.forEach(t => {
      if (!usedTileIds.has(t.id)) {
        if (!numberGroups[t.number]) numberGroups[t.number] = [];
        // Avoid duplicate colors in the same set
        if (!numberGroups[t.number].some(existing => existing.colorKey === t.colorKey)) {
          numberGroups[t.number].push(t);
        }
      }
    });

    for (const num in numberGroups) {
      if (numberGroups[num].length >= 3) {
        completePers.push({
          type: 'GROUP',
          name: `${num}'li Renk Grubu`,
          tiles: [...numberGroups[num]]
        });
        numberGroups[num].forEach(t => usedTileIds.add(t.id));
      }
    }

    // 3. Find Near-Pers (2-tile runs e.g. 8-9 or 2-tile pairs e.g. 5 Red, 5 Blue)
    const nearPers = [];
    const remainingTiles = hand.filter(t => !usedTileIds.has(t.id) && !t.isRealOkey);

    // Color 2-runs
    for (const color in colorGroups) {
      const unusedInColor = remainingTiles
        .filter(t => t.colorKey === color)
        .sort((a, b) => a.number - b.number);

      for (let i = 0; i < unusedInColor.length - 1; i++) {
        const t1 = unusedInColor[i];
        const t2 = unusedInColor[i + 1];
        if (t2.number === t1.number + 1 && !usedTileIds.has(t1.id) && !usedTileIds.has(t2.id)) {
          const neededNumbers = [];
          if (t1.number > 1) neededNumbers.push(t1.number - 1);
          if (t2.number < 13) neededNumbers.push(t2.number + 1);

          nearPers.push({
            type: 'NEAR_RUN',
            name: `${t1.colorName} ${t1.number}-${t2.number}`,
            tiles: [t1, t2],
            waiting: `${t1.colorName} ${neededNumbers.join(' veya ')} bekleniyor`
          });
          usedTileIds.add(t1.id);
          usedTileIds.add(t2.id);
        }
      }
    }

    // Same-number 2-pairs
    const unusedNumberGroups = {};
    remainingTiles.forEach(t => {
      if (!usedTileIds.has(t.id)) {
        if (!unusedNumberGroups[t.number]) unusedNumberGroups[t.number] = [];
        unusedNumberGroups[t.number].push(t);
      }
    });

    for (const num in unusedNumberGroups) {
      if (unusedNumberGroups[num].length === 2) {
        const pTiles = unusedNumberGroups[num];
        nearPers.push({
          type: 'NEAR_GROUP',
          name: `Çift ${num} (${pTiles[0].colorName} & ${pTiles[1].colorName})`,
          tiles: pTiles,
          waiting: `Farklı renkte 3. bir ${num} bekleniyor`
        });
        pTiles.forEach(t => usedTileIds.add(t.id));
      }
    }

    // 4. Orphan / Dead Tiles
    const orphanTiles = hand.filter(t => !usedTileIds.has(t.id) && !t.isRealOkey);

    // Calculate total per points for 101 Okey
    let perPoints = 0;
    completePers.forEach(per => {
      per.tiles.forEach(t => {
        perPoints += (t.number || 0);
      });
    });

    return {
      completePers,
      nearPers,
      orphanTiles,
      okeys,
      perPoints
    };
  }

  // Find the single best tile to discard based on safety and orphan status
  findBestOkeyDiscard(hand, analysis, seenTilesCount) {
    if (hand.length === 0) return null;

    // 1. Look among orphan tiles first
    let candidates = analysis.orphanTiles;
    if (candidates.length === 0) {
      // If no orphans, pick from 2-tile pairs
      if (analysis.nearPers.length > 0) {
        candidates = analysis.nearPers[analysis.nearPers.length - 1].tiles;
      } else {
        candidates = hand.filter(t => !t.isRealOkey);
      }
    }

    if (candidates.length === 0) {
      return {
        tile: hand[hand.length - 1],
        index: hand.length - 1,
        reason: 'Eliniz tamamen tamamlanmış, fazlalık taşı atın.'
      };
    }

    // Score candidates: high dead count on table = safer to discard, extreme numbers (1, 13) are also safe
    let bestCandidate = candidates[0];
    let highestSafetyScore = -999;

    candidates.forEach(tile => {
      let score = 0;
      const key = `${tile.colorKey}_${tile.number}`;
      const seenCount = seenTilesCount.get(key) || 0;

      score += seenCount * 20; // If already seen on table, safer to throw
      if (tile.number === 1 || tile.number === 13) score += 5; // Edge numbers are less flexible
      score += tile.number * 0.5; // In 101, discarding high numbers reduces penalty

      if (score > highestSafetyScore) {
        highestSafetyScore = score;
        bestCandidate = tile;
      }
    });

    const indexInHand = hand.findIndex(t => t.id === bestCandidate.id);
    return {
      tile: bestCandidate,
      index: indexInHand,
      reason: `${bestCandidate.colorName} ${bestCandidate.number} hiçbir pere uymuyor (Boşta Taş). En güvenli hamle bu taşı atmaktır.`
    };
  }

  formatOkeySummary(analysis, bestDiscard, is101, info101) {
    const persCount = analysis.completePers.length;
    const nearCount = analysis.nearPers.length;
    const okeyCount = analysis.okeys.length;

    let text = `🎯 **Analiz:** Elinizde ${persCount} adet hazır per, ${nearCount} adet bekleyen grup var. `;
    if (okeyCount > 0) text += `⭐ ${okeyCount} adet OKEY taşınız bulunuyor! `;

    if (is101 && info101) {
      text += `\n📊 **101 Durumu:** Toplam ${info101.perPoints} puan. ${info101.tip}`;
    }

    if (bestDiscard && bestDiscard.tile) {
      text += `\n💡 **Tavsiye Hamle:** **${bestDiscard.tile.colorName} ${bestDiscard.tile.number}** taşını atmanız önerilir.`;
    }

    return text;
  }

  // ==========================================
  // 2. PİŞTİ AI ADVISOR
  // ==========================================
  getPistiAdvice(gameEngine) {
    if (!gameEngine || !gameEngine.players || !gameEngine.players[0]) return null;

    const player = gameEngine.players[0];
    const hand = [...player.hand];
    const tableCards = gameEngine.tableCards || [];
    const topCard = tableCards.length > 0 ? tableCards[tableCards.length - 1] : null;

    if (hand.length === 0) return null;

    // Check for exact Pişti Match!
    let matchingCard = null;
    if (topCard) {
      matchingCard = hand.find(c => c.value === topCard.value);
    }

    // Check for Jacks (Valeler)
    const jacks = hand.filter(c => c.value === 11);
    const nonJacks = hand.filter(c => c.value !== 11);

    let recommendedCard = null;
    let reason = '';
    let isPistiMove = false;

    if (topCard && matchingCard) {
      recommendedCard = matchingCard;
      isPistiMove = tableCards.length === 1;
      reason = isPistiMove
        ? `🔥 **PİŞTİ FIRSATI (+10 PUAN)!** Yerdeki ${topCard.suitName} ${topCard.rank} ile elinizdeki ${matchingCard.suitName} ${matchingCard.rank}'i eşleştirin!`
        : `⚡ **Yeri Toplayın!** Elinizdeki ${matchingCard.suitName} ${matchingCard.rank} yerdeki kartları almanızı sağlar.`;
    } else if (tableCards.length >= 3 && jacks.length > 0) {
      recommendedCard = jacks[0];
      reason = `🧹 **Yeri Süpürün!** Yerde ${tableCards.length} kart birikti. Vale (${jacks[0].suitName} J) atarak tüm puanları toplayın!`;
    } else {
      // Safe discard: Pick lowest value non-point card, save Jacks and Aces
      const safePool = nonJacks.length > 0 ? nonJacks : hand;
      // Sort by card priority: avoid throwing Karo 10 (+3), Sinek 2 (+2), As (+1)
      safePool.sort((a, b) => {
        const getCardScore = (c) => {
          if (c.suit === 'DIAMONDS' && c.value === 10) return 100; // Keep Karo 10
          if (c.suit === 'CLUBS' && c.value === 2) return 90;     // Keep Sinek 2
          if (c.value === 1) return 80;                            // Keep As
          if (c.value === 11) return 95;                           // Keep Vale
          return c.value;
        };
        return getCardScore(a) - getCardScore(b);
      });

      recommendedCard = safePool[0];
      reason = `💡 **Güvenli Hamle:** Yerde alacak kart yok. Düşük riskli **${recommendedCard.suitName} ${recommendedCard.rank}** kartını atın.`;
    }

    const cardIndex = hand.findIndex(c => c.id === recommendedCard.id);

    return {
      gameType: 'PISTI',
      recommendedCard,
      cardIndex,
      isPistiMove,
      tableCount: tableCards.length,
      topCard,
      reason,
      summary: reason
    };
  }

  // ==========================================
  // 3. İHALELİ BATAK AI ADVISOR
  // ==========================================
  getBatakAdvice(gameEngine) {
    if (!gameEngine || !gameEngine.players || !gameEngine.players[0]) return null;

    const player = gameEngine.players[0];
    const hand = [...player.hand];

    // A. Bidding Phase Advisor
    if (gameEngine.gameState === 'BIDDING') {
      return this.getBatakBiddingAdvice(hand, gameEngine.highestBid);
    }

    // B. Playing Phase Advisor
    if (gameEngine.gameState === 'PLAYING') {
      const legalCards = gameEngine.getLegalCards(0);
      const currentTrick = gameEngine.currentTrick || [];
      const trumpSuit = gameEngine.trumpSuit;

      if (legalCards.length === 0) return null;

      let bestCard = legalCards[0];
      let reason = '';

      // If opening trick
      if (currentTrick.length === 0) {
        // Lead with high non-trump cards (Aces/Kings) to secure quick tricks
        const highNonTrumps = legalCards.filter(c => c.suit !== trumpSuit && c.value >= 13);
        if (highNonTrumps.length > 0) {
          bestCard = highNonTrumps[0];
          reason = `👑 **Ele Başlama:** Güçlü **${bestCard.suitName} ${bestCard.rank}** ile eli başlatın ve karşıdan büyük kartları çekin.`;
        } else {
          // Play lowest safe card
          bestCard = legalCards.reduce((min, c) => c.value < min.value ? c : min, legalCards[0]);
          reason = `🛡️ **Düşük Başlangıç:** Kozlarınızı korumak için küçük **${bestCard.suitName} ${bestCard.rank}** ile başlayın.`;
        }
      } else {
        // Responding to trick
        const leadSuit = currentTrick[0].card.suit;
        const highestOnTable = currentTrick.reduce((max, t) => (t.card?.value || 0) > (max?.value || 0) ? t.card : max, currentTrick[0].card);

        // Can we win with lead suit?
        const winningSuitCards = legalCards.filter(c => c.suit === leadSuit && c.value > highestOnTable.value);
        if (winningSuitCards.length > 0) {
          // Play just high enough
          winningSuitCards.sort((a, b) => a.value - b.value);
          bestCard = winningSuitCards[0];
          reason = `🏆 **Eli Alma:** **${bestCard.suitName} ${bestCard.rank}** atarak yerdeki eli garantileyin.`;
        } else {
          // If we have trumps and cannot follow lead suit
          const trumps = legalCards.filter(c => c.suit === trumpSuit);
          if (trumps.length > 0 && leadSuit !== trumpSuit) {
            trumps.sort((a, b) => a.value - b.value);
            bestCard = trumps[0];
            reason = `⚡ **Koz Çakma:** Yerdeki renginiz yok, **${bestCard.suitName} ${bestCard.rank}** koz çakarak eli alın!`;
          } else {
            // Throw lowest useless card
            legalCards.sort((a, b) => a.value - b.value);
            bestCard = legalCards[0];
            reason = `💡 **Kağıt Kaçma:** Eli alamıyorsunuz, en küçük **${bestCard.suitName} ${bestCard.rank}** kartını verin.`;
          }
        }
      }

      return {
        gameType: 'BATAK',
        phase: 'PLAYING',
        recommendedCard: bestCard,
        cardId: bestCard.id,
        reason,
        summary: reason
      };
    }

    return null;
  }

  getBatakBiddingAdvice(hand, currentHighestBid) {
    // Estimate trick potential
    const suits = { SPADES: [], HEARTS: [], DIAMONDS: [], CLUBS: [] };
    hand.forEach(c => {
      if (suits[c.suit]) suits[c.suit].push(c);
    });

    let bestSuit = 'SPADES';
    let maxTrickEstimate = 0;

    for (const suit in suits) {
      const cards = suits[suit];
      let tricks = 0;
      // Aces give +1 trick, Kings with support give +0.8, Queens give +0.5
      cards.forEach(c => {
        if (c.value === 14) tricks += 1.0;
        else if (c.value === 13 && cards.length >= 2) tricks += 0.8;
        else if (c.value === 12 && cards.length >= 3) tricks += 0.5;
      });
      // Length bonus for trump suit
      if (cards.length >= 5) tricks += (cards.length - 4) * 0.9;
      if (cards.length >= 4) tricks += 0.5;

      if (tricks > maxTrickEstimate) {
        maxTrickEstimate = tricks;
        bestSuit = suit;
      }
    }

    const estimatedBid = Math.max(0, Math.floor(maxTrickEstimate));
    const canBid = estimatedBid > currentHighestBid;
    const suitNames = { SPADES: 'Maça ♠', HEARTS: 'Kupa ♥', DIAMONDS: 'Karo ♦', CLUBS: 'Sinek ♣' };

    let reason = '';
    if (canBid && estimatedBid >= 5) {
      reason = `🌟 **İhale Tavsiyesi:** Eliniz **${suitNames[bestSuit]}** kozuyla yaklaşık **${estimatedBid} el** alabilir. İhaleye girebilirsiniz!`;
    } else {
      reason = `✋ **Pas Tavsiyesi:** Mevcut ihale (${currentHighestBid}) el gücünüzün üstünde. Pas geçmeniz daha güvenli.`;
    }

    return {
      gameType: 'BATAK',
      phase: 'BIDDING',
      recommendedBid: canBid ? estimatedBid : 0,
      bestSuit,
      estimatedBid,
      canBid,
      reason,
      summary: reason
    };
  }
}

export const aiAdvisor = new AIAdvisorEngine();
