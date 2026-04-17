// ============================================================
// gameEngine.js — Complete Game Logic Engine v2.0
//
// This file contains every single rule of the game as pure
// JavaScript functions. Every function takes the current
// gameState and returns a NEW updated gameState — nothing
// is ever mutated directly. This is called "immutable state"
// and it makes the logic easy to test and debug.
//
// HOW THE ENGINE CONNECTS TO THE SERVER:
//   Client clicks "Roll Dice"
//     → sends socket event to server
//       → server calls rollDice(gameState)
//         → engine returns newGameState
//           → server saves newGameState
//             → server broadcasts newGameState to all clients
//   The client NEVER calls these functions directly.
//
// SECTIONS IN THIS FILE:
//   1.  Constants
//   2.  Game Initialisation
//   3.  Dice & Movement
//   4.  Landing Resolver (central dispatcher)
//   5.  Property Landing (buy / rent / self-landing)
//   6.  Rent Calculator (handles all 3 rent systems)
//   7.  Player Actions (buy, skip, upgrade, use cards)
//   8.  Special Square Handlers (jail, bonus, fine)
//   9.  Card System (chance, republic, upgrader)
//   10. Colour Pairing System (threshold + pink + pinkbrown)
//   11. Bank Borrowing
//   12. Turn Management
//   13. Win / Lose Conditions
//   14. Utility Helpers
// ============================================================

const {
  outerRing,
  innerRing,
  COLOR_GROUPS,
  CHANCE_CARDS,
  REPUBLIC_CARDS,
  UPGRADER_CARDS,
  CARD_BANK_SUPPLY,
  getSquareById,
  getSquareByIndex,
  getPortalDestination,
  getAllProperties,
  getMaxPropertiesPerPlayer,
  isThresholdPairingUnlocked,
  isPinkPairComplete,
  isPinkBrownPairComplete,
  findPinkPair,
  findPinkBrownPair,
} = require('./boardData');


// ════════════════════════════════════════════════════════════
//  SECTION 1 — CONSTANTS
// ════════════════════════════════════════════════════════════

const STARTING_BALANCE = 100000; // ₹1,00,000 per player at game start
const JAIL_FINE = 500;    // Cost to escape jail on your turn
const BONUS_AMOUNT = 500;    // Reward from landing on Bonus square
const FINE_AMOUNT = 500;    // Penalty from landing on Fine square
const BORROW_UNIT = 10000;  // Minimum borrow increment from bank
const MAX_UPGRADE_LEVEL = 3;      // Properties cap at Level 3
const OVER_LIMIT_BONUS = 1000;   // Bonus for landing on unowned property after limit


// ════════════════════════════════════════════════════════════
//  SECTION 2 — GAME INITIALISATION
// ════════════════════════════════════════════════════════════

/**
 * createInitialGameState
 * Creates a brand new game state from scratch.
 * The cardBank tracks how many of each special card
 * the bank currently holds — starts at full supply.
 */
const createInitialGameState = (roomCode, mode, players) => {
  const initialPlayers = players.map((p) => ({
    id: p.id,
    username: p.username,
    balance: STARTING_BALANCE,
    ring: "outer",
    positionIndex: 0,
    isJailed: false,
    jailTurnsRemaining: 0,
    ownedProperties: [],       // array of square IDs this player owns
    heldCards: [],       // array of card objects currently held
    upgradeHistory: {},       // { squareId: upgradeLevel } — tracks free upgrades
    tokenStyle: p.tokenStyle || "car",
    tokenColor: p.tokenColor || "red",
    isBot: p.isBot || false,
    isEliminated: false,
  }));

  return {
    roomCode,
    mode,
    status: "wheel_spin",
    turnOrder: [],
    currentPlayerIndex: 0,
    currentPhase: "roll",
    players: initialPlayers,
    properties: {},     // { squareId: { ownerId, upgradeLevel } }
    // The bank's physical card supply — depletes when cards are dealt
    cardBank: { ...CARD_BANK_SUPPLY },
    lastDiceRoll: null,
    // A pending blocker means a player declared a number before rolling
    pendingBlocker: null,
    pendingPayment: null,
    lastEvent: { type: "game_started", message: "Game started! Spinning the wheel..." },
    winner: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};


/**
 * setTurnOrder
 * Uses a Fisher-Yates shuffle on the server to randomly
 * determine who goes first, second, third, etc.
 * This is always done server-side to prevent any client
 * from manipulating the turn order.
 */
const setTurnOrder = (gameState) => {
  const playerIds = gameState.players.map((p) => p.id);
  // Fisher-Yates: swap each element with a random earlier element
  for (let i = playerIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
  }
  const firstName = getPlayerById({ players: gameState.players }, playerIds[0]).username;
  return {
    ...gameState,
    turnOrder: playerIds,
    currentPlayerIndex: 0,
    status: "active",
    currentPhase: "roll",
    lastEvent: {
      type: "turn_order_set",
      message: `Turn order decided! ${firstName} goes first.`,
      turnOrder: playerIds,
    },
    updatedAt: Date.now(),
  };
};


// ════════════════════════════════════════════════════════════
//  SECTION 3 — DICE & MOVEMENT
// ════════════════════════════════════════════════════════════

/**
 * rollDice
 * The server generates two random dice values (1–6 each).
 * It then checks if the player has an active Blocker card
 * declared before calling movePlayer.
 */
const rollDice = (gameState) => {
  if (gameState.currentPhase !== "roll") {
    return { ...gameState, lastEvent: { type: "error", message: "It is not the roll phase." } };
  }

  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const total = die1 + die2;

  const currentPlayerId = getCurrentPlayerId(gameState);

  // Check if a Blocker card was declared for this roll.
  // The blocker is consumed NOW regardless of outcome —
  // the player gambled when they declared the number.
  let stateAfterBlockerCheck = gameState;
  let blockerActivated = false;
  if (gameState.pendingBlocker && gameState.pendingBlocker.playerId === currentPlayerId) {
    const declaredNumber = gameState.pendingBlocker.declaredNumber;
    blockerActivated = (total === declaredNumber);
    // Consume the blocker card and clear the pending blocker
    stateAfterBlockerCheck = {
      ...gameState,
      pendingBlocker: null,
      cardBank: {
        ...gameState.cardBank,
        blocker: gameState.cardBank.blocker + 1, // returns to bank
      },
      players: gameState.players.map(p =>
        p.id === currentPlayerId
          ? { ...p, heldCards: p.heldCards.filter(c => c.cardId !== "blocker" || c._consumed) }
          : p
      ),
    };
  }

  // Move the player
  const stateAfterMove = movePlayer(
    { ...stateAfterBlockerCheck, lastDiceRoll: [die1, die2] },
    currentPlayerId,
    total,
    blockerActivated   // pass blocker flag to landing resolver
  );

  return { ...stateAfterMove, updatedAt: Date.now() };
};


/**
 * movePlayer
 * Moves a player N steps forward from their current position.
 *
 * PORTAL RULE (confirmed by owner):
 *   - Portals ONLY activate when the player lands EXACTLY on
 *     the portal square as their FINAL step.
 *   - If the portal is anywhere in the middle of the path,
 *     the token passes over it silently with NO effect.
 *   - Example: Player rolls 6. Portal is at step 5 from current
 *     position. Token moves steps 1→2→3→4→5(portal, ignored)→6.
 *     Player ends at step 6. Portal does nothing.
 *   - Example: Player rolls 6. Portal is at step 6 from current
 *     position. Token moves steps 1→2→3→4→5→6(portal, LANDS!).
 *     Token teleports to paired portal on other ring. Turn ends
 *     at the paired portal square. Player stays there.
 *
 * This means the movement loop is now very simple — just count
 * N steps forward on the current ring, wrapping around at the
 * end. No teleportation happens during the loop at all.
 * Portal check happens ONLY after the loop ends.
 */
const movePlayer = (gameState, playerId, steps, blockerActivated = false) => {
  const player = getPlayerById(gameState, playerId);
  const ring = player.ring;
  const ringArray = ring === "outer" ? outerRing : innerRing;
  const ringLength = ringArray.length;

  // Simple movement — count N steps forward on the current ring
  // Wraps around using modulo when passing the end of the ring
  const finalIndex = (player.positionIndex + steps) % ringLength;
  const landedSquare = ringArray[finalIndex];

  let finalRing = ring;
  let finalPosition = finalIndex;
  let teleported = false;
  let teleportMsg = "";

  // Portal check — ONLY if the final landing square is a portal
  if (landedSquare.type === "portal") {
    const destinationId = getPortalDestination(landedSquare.id);
    const destinationSq = getSquareById(destinationId);
    finalRing = destinationId.startsWith("I-") ? "inner" : "outer";
    finalPosition = destinationSq.sequenceIndex;
    teleported = true;
    teleportMsg = `${player.username} landed on a portal and teleported to the ${finalRing} ring!`;
  }

  // Update the player's position immutably
  const updatedPlayers = gameState.players.map((p) =>
    p.id === playerId
      ? { ...p, ring: finalRing, positionIndex: finalPosition }
      : p
  );

  // The square we resolve landing effects for is the FINAL square
  // If teleported, it is the paired portal square (turn ends there)
  // If not teleported, it is the normal landed square
  const resolvedSquare = teleported
    ? getSquareByIndex(finalRing, finalPosition)
    : landedSquare;

  const stateAfterMove = {
    ...gameState,
    players: updatedPlayers,
    lastEvent: {
      type: "player_moved",
      playerId,
      newRing: finalRing,
      newIndex: finalPosition,
      landedOn: resolvedSquare.name,
      landedOnType: resolvedSquare.type,
      teleported,
      teleportMessage: teleportMsg,
      diceRoll: gameState.lastDiceRoll,
    },
    updatedAt: Date.now(),
  };

  // Resolve landing effects for the final square
  return resolveLanding(stateAfterMove, playerId, resolvedSquare, blockerActivated);
};


// ════════════════════════════════════════════════════════════
//  SECTION 4 — LANDING RESOLVER
//  Central dispatcher — looks at the square type and routes
//  to the correct handler function.
// ════════════════════════════════════════════════════════════

const resolveLanding = (gameState, playerId, square, blockerActivated = false) => {
  switch (square.type) {
    case "property":
      return resolvePropertyLanding(gameState, playerId, square, blockerActivated);
    case "jail":
      return resolveJailLanding(gameState, playerId);
    case "bonus":
      return resolveBonusLanding(gameState, playerId);
    case "fine":
      return resolveFineLanding(gameState, playerId);
    case "chance":
      return resolveChanceLanding(gameState, playerId, square);
    case "republic":
      return resolveRepublicLanding(gameState, playerId, square);
    case "upgrader":
      return resolveUpgraderLanding(gameState, playerId, square);
    case "portal":
      // Player's final step landed on a portal — turn ends here
      return advanceTurn({
        ...gameState,
        lastEvent: { ...gameState.lastEvent, type: "portal_arrival", message: "Arrived at portal. Turn ends." },
      });
    case "start":
      return advanceTurn(gameState);
    default:
      return advanceTurn(gameState);
  }
};


// ════════════════════════════════════════════════════════════
//  SECTION 5 — PROPERTY LANDING
// ════════════════════════════════════════════════════════════

/**
 * resolvePropertyLanding
 * Four possible situations when landing on a property:
 *   1. Unowned + player under limit     → offer buy/skip choice
 *   2. Unowned + player AT limit        → pay ₹1000 bonus (if market active)
 *   3. Owned by this player             → free upgrade (if eligible)
 *   4. Owned by another player          → pay rent (unless blocker active)
 */
const resolvePropertyLanding = (gameState, playerId, square, blockerActivated) => {
  const ownership = gameState.properties[square.id];
  const player = getPlayerById(gameState, playerId);
  const maxProps = getMaxPropertiesPerPlayer(gameState.players.filter(p => !p.isEliminated).length);
  const atLimit = player.ownedProperties.length >= maxProps;

  // ── Situation 1 & 2: Nobody owns this property ──────────
  if (!ownership) {
    // Count how many properties are still unowned
    const totalOwned = Object.keys(gameState.properties).length;
    const marketActive = totalOwned < 70; // true while properties still available

    if (atLimit && marketActive) {
      // Player is at their limit — reward them with ₹1000 bonus
      const updatedPlayers = gameState.players.map(p =>
        p.id === playerId ? { ...p, balance: p.balance + OVER_LIMIT_BONUS } : p
      );
      return advanceTurn({
        ...gameState,
        players: updatedPlayers,
        lastEvent: {
          type: "over_limit_bonus",
          playerId,
          amount: OVER_LIMIT_BONUS,
          message: `${player.username} is at their property limit! Received ₹${OVER_LIMIT_BONUS} bonus from the bank.`,
        },
        updatedAt: Date.now(),
      });
    }

    // Player can buy — prompt them with a choice (phase switches to "action")
    return {
      ...gameState,
      currentPhase: "action",
      lastEvent: {
        type: "property_unowned",
        playerId,
        squareId: square.id,
        propertyName: square.name,
        buyPrice: square.buyPrice,
        baseRent: square.baseRent,
        canAfford: player.balance >= square.buyPrice,
        atLimit,
        message: `${player.username} landed on ${square.name}. Buy for ₹${square.buyPrice}?`,
      },
      updatedAt: Date.now(),
    };
  }

  // ── Situation 3: Player landed on their OWN property ────
  if (ownership.ownerId === playerId) {
    return resolveOwnPropertyLanding(gameState, playerId, square, ownership);
  }

  // ── Situation 4: Owned by another player — pay rent ─────
  // If a Blocker card was successfully activated, skip rent
  if (blockerActivated) {
    return advanceTurn({
      ...gameState,
      lastEvent: {
        type: "rent_blocked",
        playerId,
        squareId: square.id,
        message: `${player.username}'s Blocker card activated! Rent on ${square.name} is blocked this turn.`,
      },
      updatedAt: Date.now(),
    });
  }

  return initiateRentPayment(gameState, playerId, square, ownership);
};


/**
 * resolveOwnPropertyLanding
 * When a player lands on their own property:
 *   - For Yellow/Red/Orange/Black/Purple properties:
 *     the property upgrades one level for FREE (up to max 3).
 *   - For PinkBrown properties:
 *     the bank pays the owner a self-landing bonus.
 *   - For Pink properties:
 *     nothing happens (no upgrades, no self-landing bonus).
 */
const resolveOwnPropertyLanding = (gameState, playerId, square, ownership) => {
  const player = getPlayerById(gameState, playerId);

  // PinkBrown self-landing bonus
  if (square.color === "pinkBrown") {
    const pair = findPinkBrownPair(square.id);
    if (!pair) return advanceTurn(gameState);
    const paired = isPinkBrownPairComplete(pair, player.ownedProperties);
    const bonus = paired ? pair.selfLandingBonus.paired : pair.selfLandingBonus.solo;
    const updatedPlayers = gameState.players.map(p =>
      p.id === playerId ? { ...p, balance: p.balance + bonus } : p
    );
    return advanceTurn({
      ...gameState,
      players: updatedPlayers,
      lastEvent: {
        type: "self_landing_bonus",
        playerId,
        squareId: square.id,
        amount: bonus,
        paired,
        message: `${player.username} landed on their own ${square.name}! Bank pays ₹${bonus} bonus${paired ? " (pair complete!)" : ""}.`,
      },
      updatedAt: Date.now(),
    });
  }

  // Pink properties — no upgrades, no bonus, just advance turn
  if (square.color === "pink") {
    return advanceTurn({
      ...gameState,
      lastEvent: {
        type: "own_property_no_action",
        playerId,
        message: `${player.username} landed on their own ${square.name}. No upgrade for Pink properties.`,
      },
      updatedAt: Date.now(),
    });
  }

  // Threshold colour properties (Yellow/Red/Orange/Black/Purple)
  // Free upgrade by landing — Base→L1→L2→L3
  if (ownership.upgradeLevel >= MAX_UPGRADE_LEVEL) {
    return advanceTurn({
      ...gameState,
      lastEvent: {
        type: "already_max_level",
        playerId,
        message: `${player.username} landed on ${square.name} (already at max Level 3).`,
      },
      updatedAt: Date.now(),
    });
  }

  const newLevel = ownership.upgradeLevel + 1;
  const rentAtNewLevel = [null, square.rentL1, square.rentL2, square.rentL3][newLevel];
  const updatedProperties = {
    ...gameState.properties,
    [square.id]: { ...ownership, upgradeLevel: newLevel },
  };

  return advanceTurn({
    ...gameState,
    properties: updatedProperties,
    lastEvent: {
      type: "free_upgrade",
      playerId,
      squareId: square.id,
      propertyName: square.name,
      newLevel,
      newRent: rentAtNewLevel,
      message: `${player.username} landed on their own ${square.name} — FREE upgrade to Level ${newLevel}! New rent: ₹${rentAtNewLevel}.`,
    },
    updatedAt: Date.now(),
  });
};


// ════════════════════════════════════════════════════════════
//  SECTION 6 — RENT CALCULATOR
//  Handles all three rent systems:
//    A. Standard threshold-colour properties
//       (base/L1/L2/L3 rents, doubled if pairing unlocked)
//    B. Pink flat_double pairs
//       (fixed flat rent, higher after pairing)
//    C. Pink dice_multiplier pairs
//       (rent = diceRoll × multiplier, higher after pairing)
//    D. PinkBrown properties
//       (always fixed flat rent for other players)
// ════════════════════════════════════════════════════════════

/**
 * calculateRent
 * Returns the rent amount due based on the property's colour
 * group, current upgrade level, and the dice roll total.
 */
const calculateRent = (gameState, payerId, square, ownership) => {
  const diceTotal = gameState.lastDiceRoll[0] + gameState.lastDiceRoll[1];
  const owner = getPlayerById(gameState, ownership.ownerId);

  // ── PinkBrown: always fixed flat rent ───────────────────
  if (square.color === "pinkBrown") {
    const pair = findPinkBrownPair(square.id);
    if (!pair) return square.baseRent;
    return pair.fixedRentForOthers[square.id] || square.baseRent;
  }

  // ── Pink properties ──────────────────────────────────────
  if (square.color === "pink") {
    const pair = findPinkPair(square.id);
    if (!pair) return square.baseRent;

    const paired = isPinkPairComplete(pair, owner.ownedProperties);

    if (pair.evolutionType === "flat_double") {
      // Use evolved flat rent if paired, otherwise solo flat rent
      return paired
        ? pair.evolvedRents[square.id]
        : pair.soloRents[square.id];
    }

    if (pair.evolutionType === "dice_multiplier") {
      // Some Pink properties use dice multiplier even in solo mode
      if (paired) {
        return diceTotal * pair.evolvedMultipliers[square.id];
      } else {
        // Check if this property has a solo multiplier (Pair 4: DC and PBKS)
        // or a flat solo rent (Pair 1: Al Nassr, Inter Miami, Santos)
        if (pair.soloMultipliers && pair.soloMultipliers[square.id]) {
          return diceTotal * pair.soloMultipliers[square.id];
        }
        return pair.soloRents[square.id];
      }
    }

    return square.baseRent;
  }

  // ── Threshold colour properties (Yellow/Red/Orange/Black/Purple) ──
  // Determine base rent from upgrade level
  const rentByLevel = {
    0: square.baseRent,
    1: square.rentL1,
    2: square.rentL2,
    3: square.rentL3,
  };
  let rent = rentByLevel[ownership.upgradeLevel] || square.baseRent;

  // Double the rent if the owner has unlocked threshold pairing
  // for this colour group (e.g. owns 5+ Yellow properties)
  if (square.color && isThresholdPairingUnlocked(square.color, owner.ownedProperties)) {
    rent = rent * 2;
  }

  return rent;
};


/**
 * initiateRentPayment
 * Checks if the payer can afford rent and either processes
 * the payment or triggers the borrow flow first.
 */
const initiateRentPayment = (gameState, payerId, square, ownership) => {
  const rentDue = calculateRent(gameState, payerId, square, ownership);
  const payer = getPlayerById(gameState, payerId);
  const owner = getPlayerById(gameState, ownership.ownerId);

  // Check if payer has a 50% discount card for paying
  // The card will be used automatically if the payer chooses
  // (we set phase to "action" so the UI can ask)
  const hasDiscountCard = payer.heldCards.some(c => c.cardId === "discount_pay");

  if (payer.balance < rentDue && !hasDiscountCard) {
    // Cannot afford — store pendingPayment so borrowFromBank
    // can auto-process it the moment borrowing completes (Option A)
    return {
      ...gameState,
      currentPhase: "action",
      pendingPayment: {
        type: "rent",
        payerId,
        ownerId: ownership.ownerId,
        amount: rentDue,
        squareId: square.id,
      },
      lastEvent: {
        type: "insufficient_funds_rent",
        payerId,
        ownerId: ownership.ownerId,
        ownerName: owner.username,
        squareId: square.id,
        propertyName: square.name,
        rentDue,
        currentBalance: payer.balance,
        message: `${payer.username} owes ₹${rentDue} to ${owner.username} but only has ₹${payer.balance}. Must borrow from bank first.`,
      },
      updatedAt: Date.now(),
    };
  }

  if (hasDiscountCard && payer.balance < rentDue) {
    // Can afford with discount — prompt to use discount card
    return {
      ...gameState,
      currentPhase: "action",
      lastEvent: {
        type: "can_use_discount_pay",
        payerId,
        ownerId: ownership.ownerId,
        squareId: square.id,
        rentDue,
        discountedRent: Math.floor(rentDue / 2),
        message: `${payer.username} owes ₹${rentDue}. Use 50% Discount Card? (Would pay ₹${Math.floor(rentDue / 2)} instead)`,
      },
      updatedAt: Date.now(),
    };
  }

  // Can afford — process payment directly
  return processRentPayment(gameState, payerId, ownership.ownerId, rentDue, square);
};


/**
 * processRentPayment
 * Actually transfers the rent from payer to owner.
 */
// ✅ FIXED
const processRentPayment = (gameState, payerId, ownerId, amount, square) => {
  const payer = getPlayerById(gameState, payerId);
  const owner = getPlayerById(gameState, ownerId);

  const updatedPlayers = gameState.players.map(p => {
    if (p.id === payerId) return { ...p, balance: p.balance - amount };
    if (p.id === ownerId) return { ...p, balance: p.balance + amount };
    return p;
  });

  return advanceTurn({
    ...gameState,
    players: updatedPlayers,
    lastEvent: {
      type: 'rent_paid',
      payerId: payerId,           // ✅ correct
      ownerUsername: owner.username,
      propertyName: square.name,
      propertyColor: square.color,
      rentAmount: amount,            // ✅ correct
      usedBlocker: false,
      usedDiscount: false,
      message: `${payer.username} paid ₹${amount} rent to ${owner.username}`,
    },
    updatedAt: Date.now(),
  });
};


// ════════════════════════════════════════════════════════════
//  SECTION 7 — PLAYER ACTIONS
//  These are called when a player makes a decision in the UI.
// ════════════════════════════════════════════════════════════

/**
 * buyProperty
 * Called when a player taps "Buy" on the property modal.
 * Checks for the 50% discount buy card and applies it if used.
 */
const buyProperty = (gameState, playerId, useDiscountCard = false) => {
  if (gameState.currentPhase !== "action") {
    return { ...gameState, lastEvent: { type: "error", message: "Not in action phase." } };
  }

  const player = getPlayerById(gameState, playerId);
  const square = getSquareByIndex(player.ring, player.positionIndex);

  let price = square.buyPrice;

  // Apply 50% buy discount card if requested and held
  if (useDiscountCard) {
    const cardIndex = player.heldCards.findIndex(c => c.cardId === "discount_buy");
    if (cardIndex === -1) {
      return { ...gameState, lastEvent: { type: "error", message: "You do not hold a discount buy card." } };
    }
    price = Math.floor(price / 2);
    // Remove the card from player's hand and return to bank
    const updatedCards = [...player.heldCards];
    updatedCards.splice(cardIndex, 1);
    gameState = {
      ...gameState,
      cardBank: { ...gameState.cardBank, discount_buy: gameState.cardBank.discount_buy + 1 },
      players: gameState.players.map(p =>
        p.id === playerId ? { ...p, heldCards: updatedCards } : p
      ),
    };
  }

  if (player.balance < price) {
    return { ...gameState, lastEvent: { type: "error", message: `Not enough balance. Need ₹${price}.` } };
  }

  const updatedPlayers = gameState.players.map(p =>
    p.id === playerId
      ? { ...p, balance: p.balance - price, ownedProperties: [...p.ownedProperties, square.id] }
      : p
  );

  const updatedProperties = {
    ...gameState.properties,
    [square.id]: { ownerId: playerId, upgradeLevel: 0 },
  };

  return advanceTurn({
    ...gameState,
    players: updatedPlayers,
    properties: updatedProperties,
    lastEvent: {
      type: "property_bought",
      playerId,
      squareId: square.id,
      propertyName: square.name,
      price,
      discountUsed: useDiscountCard,
      message: `${player.username} bought ${square.name} for ₹${price}${useDiscountCard ? " (50% discount applied!)" : ""}!`,
    },
    updatedAt: Date.now(),
  });
};


/**
 * skipBuying
 * Called when a player taps "Skip" — turn advances with no transaction.
 */
const skipBuying = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  const square = getSquareByIndex(player.ring, player.positionIndex);
  return advanceTurn({
    ...gameState,
    lastEvent: {
      type: "property_skipped",
      playerId,
      propertyName: square.name,
      message: `${player.username} chose not to buy ${square.name}.`,
    },
    updatedAt: Date.now(),
  });
};


/**
 * useDiscountPayCard
 * Called when a player chooses to use their 50% discount pay
 * card when facing a rent payment they can afford at half price.
 */
const useDiscountPayCard = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  const cardIndex = player.heldCards.findIndex(c => c.cardId === "discount_pay");
  if (cardIndex === -1) {
    return { ...gameState, lastEvent: { type: "error", message: "You do not hold a discount pay card." } };
  }

  // Find the current square the player is on and the owner
  const square = getSquareByIndex(player.ring, player.positionIndex);
  const ownership = gameState.properties[square.id];
  if (!ownership) return gameState;

  const fullRent = calculateRent(gameState, playerId, square, ownership);
  const discountRent = Math.floor(fullRent / 2);

  // Remove card from player hand and return to bank
  const updatedCards = [...player.heldCards];
  updatedCards.splice(cardIndex, 1);

  const stateAfterCardUse = {
    ...gameState,
    cardBank: { ...gameState.cardBank, discount_pay: gameState.cardBank.discount_pay + 1 },
    players: gameState.players.map(p =>
      p.id === playerId ? { ...p, heldCards: updatedCards } : p
    ),
  };

  return processRentPayment(stateAfterCardUse, playerId, ownership.ownerId, discountRent, square);
};

/**
 * payRentFull
 * Called when a player has the discount_pay card but chooses
 * to pay full rent anyway (e.g. they want to save the card).
 */
const payRentFull = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  const square = getSquareByIndex(player.ring, player.positionIndex);
  const ownership = gameState.properties[square.id];
  if (!ownership) return gameState;

  const fullRent = calculateRent(gameState, playerId, square, ownership);

  if (player.balance < fullRent) {
    return {
      ...gameState,
      currentPhase: 'action',
      pendingPayment: {
        type: 'rent', payerId: playerId,
        ownerId: ownership.ownerId, amount: fullRent, squareId: square.id,
      },
      lastEvent: {
        type: 'insufficient_funds_rent', payerId: playerId,
        ownerId: ownership.ownerId, squareId: square.id,
        rentDue: fullRent, currentBalance: player.balance,
        message: `${player.username} can't afford ₹${fullRent}. Must borrow first.`,
      },
      updatedAt: Date.now(),
    };
  }

  return processRentPayment(gameState, playerId, ownership.ownerId, fullRent, square);
};

/**
 * declareBlocker
 * Called BEFORE the player rolls their dice.
 * Player chooses a number (2–12) to block rent on.
 * The card is consumed when the dice are rolled, regardless
 * of whether the declared number actually comes up.
 */
const declareBlocker = (gameState, playerId, declaredNumber) => {
  if (gameState.currentPhase !== "roll") {
    return { ...gameState, lastEvent: { type: "error", message: "Can only declare blocker before rolling." } };
  }

  const player = getPlayerById(gameState, playerId);
  const cardIndex = player.heldCards.findIndex(c => c.cardId === "blocker");
  if (cardIndex === -1) {
    return { ...gameState, lastEvent: { type: "error", message: "You do not hold a Blocker card." } };
  }

  if (declaredNumber < 2 || declaredNumber > 12) {
    return { ...gameState, lastEvent: { type: "error", message: "Declared number must be between 2 and 12." } };
  }

  // Mark the card as pending — it gets consumed in rollDice()
  // We mark it with _consumed flag so the removal in rollDice is precise
  const updatedCards = player.heldCards.map((c, i) =>
    i === cardIndex ? { ...c, _consumed: true } : c
  );

  return {
    ...gameState,
    pendingBlocker: { playerId, declaredNumber },
    players: gameState.players.map(p =>
      p.id === playerId ? { ...p, heldCards: updatedCards } : p
    ),
    lastEvent: {
      type: "blocker_declared",
      playerId,
      declaredNumber,
      message: `${player.username} declared Blocker on dice total ${declaredNumber}! Now rolling...`,
    },
    updatedAt: Date.now(),
  };
};


/**
 * useColorL1Card
 * Called when a player uses a colour Level 1 card from the upgrader.
 * The player chooses which of their base-level properties of
 * that colour to upgrade to Level 1 instantly for free.
 * Does nothing if the player owns no base-level properties
 * of that colour, or if the target isn't eligible.
 */
const useColorL1Card = (gameState, playerId, targetSquareId) => {
  const player = getPlayerById(gameState, playerId);
  const square = getSquareById(targetSquareId);
  const ownership = gameState.properties[targetSquareId];

  if (!ownership || ownership.ownerId !== playerId) {
    return { ...gameState, lastEvent: { type: "error", message: "You do not own this property." } };
  }
  if (ownership.upgradeLevel !== 0) {
    return { ...gameState, lastEvent: { type: "error", message: "Card only upgrades base-level (Level 0) properties to Level 1." } };
  }
  if (square.color === "pink" || square.color === "pinkBrown") {
    return { ...gameState, lastEvent: { type: "error", message: "Upgrader cards do not apply to Pink or PinkBrown properties." } };
  }

  // Find which colour card the player holds that matches this property
  const cardId = `${square.color}_l1`;
  const cardIndex = player.heldCards.findIndex(c => c.cardId === cardId);
  if (cardIndex === -1) {
    return { ...gameState, lastEvent: { type: "error", message: `You do not hold a ${square.color} Level 1 card.` } };
  }

  // Remove card, return to bank, upgrade property
  const updatedCards = [...player.heldCards];
  updatedCards.splice(cardIndex, 1);

  return {
    ...gameState,
    cardBank: { ...gameState.cardBank, [cardId]: gameState.cardBank[cardId] + 1 },
    players: gameState.players.map(p =>
      p.id === playerId ? { ...p, heldCards: updatedCards } : p
    ),
    properties: {
      ...gameState.properties,
      [targetSquareId]: { ...ownership, upgradeLevel: 1 },
    },
    lastEvent: {
      type: "card_upgrade_l1",
      playerId,
      squareId: targetSquareId,
      propertyName: square.name,
      message: `${player.username} used ${square.color} Level 1 card to upgrade ${square.name} to Level 1! New rent: ₹${square.rentL1}.`,
    },
    updatedAt: Date.now(),
  };
};


/**
 * useLevel2AnyCard
 * Upgrades any ONE Level-1 property the player owns to Level 2.
 * Does nothing if the target is not currently at Level 1.
 * Does not apply to Pink or PinkBrown properties.
 */
const useLevel2AnyCard = (gameState, playerId, targetSquareId) => {
  const player = getPlayerById(gameState, playerId);
  const square = getSquareById(targetSquareId);
  const ownership = gameState.properties[targetSquareId];

  if (!ownership || ownership.ownerId !== playerId) {
    return { ...gameState, lastEvent: { type: "error", message: "You do not own this property." } };
  }
  if (ownership.upgradeLevel !== 1) {
    return { ...gameState, lastEvent: { type: "error", message: "Level 2 Any Card only upgrades Level-1 properties to Level 2." } };
  }
  if (square.color === "pink" || square.color === "pinkBrown") {
    return { ...gameState, lastEvent: { type: "error", message: "Upgrader cards do not apply to Pink or PinkBrown properties." } };
  }

  const cardIndex = player.heldCards.findIndex(c => c.cardId === "level2_any");
  if (cardIndex === -1) {
    return { ...gameState, lastEvent: { type: "error", message: "You do not hold a Level 2 Any card." } };
  }

  const updatedCards = [...player.heldCards];
  updatedCards.splice(cardIndex, 1);

  return {
    ...gameState,
    cardBank: { ...gameState.cardBank, level2_any: gameState.cardBank.level2_any + 1 },
    players: gameState.players.map(p =>
      p.id === playerId ? { ...p, heldCards: updatedCards } : p
    ),
    properties: {
      ...gameState.properties,
      [targetSquareId]: { ...ownership, upgradeLevel: 2 },
    },
    lastEvent: {
      type: "card_upgrade_l2",
      playerId,
      squareId: targetSquareId,
      propertyName: square.name,
      message: `${player.username} used Level 2 Any card to upgrade ${square.name} to Level 2! New rent: ₹${square.rentL2}.`,
    },
    updatedAt: Date.now(),
  };
};


// ════════════════════════════════════════════════════════════
//  SECTION 8 — SPECIAL SQUARE HANDLERS
// ════════════════════════════════════════════════════════════

/**
 * resolveJailLanding — Player lands on Jail square.
 * They are jailed. Next turn: pay ₹500 to play, or skip once.
 * After skipping once they are automatically freed.
 */
const resolveJailLanding = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  const updatedPlayers = gameState.players.map(p =>
    p.id === playerId
      ? { ...p, isJailed: true, jailTurnsRemaining: 1 }
      : p
  );
  return advanceTurn({
    ...gameState,
    players: updatedPlayers,
    lastEvent: {
      type: "sent_to_jail",
      playerId,
      message: `${player.username} landed on Jail! Next turn: pay ₹${JAIL_FINE} to play or skip the turn.`,
    },
    updatedAt: Date.now(),
  });
};


/**
 * payJailFine — Player pays ₹500 to escape jail.
 * Clears jailed status and allows them to roll normally.
 */
const payJailFine = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  if (!player.isJailed) {
    return { ...gameState, lastEvent: { type: "error", message: "Player is not in jail." } };
  }
  if (player.balance < JAIL_FINE) {
    return { ...gameState, lastEvent: { type: "error", message: `Need ₹${JAIL_FINE} to pay jail fine.` } };
  }
  const updatedPlayers = gameState.players.map(p =>
    p.id === playerId
      ? { ...p, balance: p.balance - JAIL_FINE, isJailed: false, jailTurnsRemaining: 0 }
      : p
  );
  return {
    ...gameState,
    players: updatedPlayers,
    currentPhase: "roll",
    lastEvent: {
      type: "jail_fine_paid",
      playerId,
      amount: JAIL_FINE,
      message: `${player.username} paid ₹${JAIL_FINE} and is free from jail! Roll the dice.`,
    },
    updatedAt: Date.now(),
  };
};


/**
 * skipJailTurn — Player skips their jailed turn.
 * After 1 skipped turn they are automatically freed.
 */
const skipJailTurn = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  const updatedPlayers = gameState.players.map(p => {
    if (p.id !== playerId) return p;
    const newTurns = p.jailTurnsRemaining - 1;
    return { ...p, jailTurnsRemaining: newTurns, isJailed: newTurns > 0 };
  });
  const newState = getPlayerById({ players: updatedPlayers }, playerId);
  return advanceTurn({
    ...gameState,
    players: updatedPlayers,
    lastEvent: {
      type: "jail_turn_skipped",
      playerId,
      freed: !newState.isJailed,
      message: `${player.username}'s turn skipped (in jail).${!newState.isJailed ? " Now free!" : ""}`,
    },
    updatedAt: Date.now(),
  });
};


/**
 * resolveBonusLanding — Player receives ₹500 from bank.
 */
const resolveBonusLanding = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  const updatedPlayers = gameState.players.map(p =>
    p.id === playerId ? { ...p, balance: p.balance + BONUS_AMOUNT } : p
  );
  return advanceTurn({
    ...gameState,
    players: updatedPlayers,
    lastEvent: {
      type: "bonus_collected",
      playerId,
      amount: BONUS_AMOUNT,
      message: `${player.username} landed on Bonus! Received ₹${BONUS_AMOUNT} from the bank.`,
    },
    updatedAt: Date.now(),
  });
};


/**
 * resolveFineLanding — Player pays ₹500 to bank.
 */
const resolveFineLanding = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  if (player.balance < FINE_AMOUNT) {
    // Store pendingPayment so borrowFromBank auto-processes fine after borrowing
    return {
      ...gameState,
      currentPhase: "action",
      pendingPayment: {
        type: "fine",
        payerId: playerId,
        ownerId: null,
        amount: FINE_AMOUNT,
        squareId: null,
      },
      lastEvent: {
        type: "insufficient_funds_fine",
        playerId,
        fineAmount: FINE_AMOUNT,
        message: `${player.username} landed on Fine but can't afford ₹${FINE_AMOUNT}. Must borrow first.`,
      },
      updatedAt: Date.now(),
    };
  }
  const updatedPlayers = gameState.players.map(p =>
    p.id === playerId ? { ...p, balance: p.balance - FINE_AMOUNT } : p
  );
  return advanceTurn({
    ...gameState,
    players: updatedPlayers,
    lastEvent: {
      type: "fine_paid",
      playerId,
      amount: FINE_AMOUNT,
      message: `${player.username} landed on Fine! Paid ₹${FINE_AMOUNT} to the bank.`,
    },
    updatedAt: Date.now(),
  });
};


// ════════════════════════════════════════════════════════════
//  SECTION 9 — CARD SYSTEM
// ════════════════════════════════════════════════════════════

/**
 * resolveChanceLanding
 * Gets the card for the current dice total and applies it.
 */
const resolveChanceLanding = (gameState, playerId) => {
  const diceTotal = gameState.lastDiceRoll[0] + gameState.lastDiceRoll[1];
  const card = CHANCE_CARDS[diceTotal];
  const player = getPlayerById(gameState, playerId);

  const stateAfterCard = applyDiceCard(gameState, playerId, card);
  return advanceTurn({
    ...stateAfterCard,
    lastEvent: {
      type: "chance_card",
      playerId,
      diceTotal,
      card,
      message: `${player.username} drew Chance card (roll ${diceTotal}): "${card.text}"`,
    },
    updatedAt: Date.now(),
  });
};


/**
 * resolveRepublicLanding — Same mechanic as Chance.
 */
const resolveRepublicLanding = (gameState, playerId) => {
  const diceTotal = gameState.lastDiceRoll[0] + gameState.lastDiceRoll[1];
  const card = REPUBLIC_CARDS[diceTotal];
  const player = getPlayerById(gameState, playerId);

  const stateAfterCard = applyDiceCard(gameState, playerId, card);
  return advanceTurn({
    ...stateAfterCard,
    lastEvent: {
      type: "republic_card",
      playerId,
      diceTotal,
      card,
      message: `${player.username} drew Republic card (roll ${diceTotal}): "${card.text}"`,
    },
    updatedAt: Date.now(),
  });
};


/**
 * resolveUpgraderLanding
 * Gets the upgrader card for the dice total.
 * Checks the bank's supply — if 0 copies remain, no card is given.
 * Some cards (discount, blocker, level2) are added to the player's hand.
 * Some cards (color_l1) are applied immediately if eligible.
 */
const resolveUpgraderLanding = (gameState, playerId) => {
  const diceTotal = gameState.lastDiceRoll[0] + gameState.lastDiceRoll[1];
  const card = UPGRADER_CARDS[diceTotal];
  const player = getPlayerById(gameState, playerId);
  const supply = gameState.cardBank[card.cardId] || 0;

  // No cards left in the bank for this type
  if (supply <= 0) {
    return advanceTurn({
      ...gameState,
      lastEvent: {
        type: "upgrader_no_supply",
        playerId,
        diceTotal,
        cardId: card.cardId,
        message: `${player.username} rolled ${diceTotal} on Upgrader but the bank has no ${card.cardId} cards left!`,
      },
      updatedAt: Date.now(),
    });
  }

  // Deduct from bank supply
  const newCardBank = { ...gameState.cardBank, [card.cardId]: supply - 1 };

  // Cards that go into the player's hand (used later)
  const holdableCards = ["discount_pay", "discount_buy", "blocker", "level2_any"];
  if (holdableCards.includes(card.effectType) || holdableCards.includes(card.cardId)) {
    const newCard = { cardId: card.cardId, effectType: card.effectType, text: card.text };
    return advanceTurn({
      ...gameState,
      cardBank: newCardBank,
      players: gameState.players.map(p =>
        p.id === playerId ? { ...p, heldCards: [...p.heldCards, newCard] } : p
      ),
      lastEvent: {
        type: "upgrader_card_received",
        playerId,
        diceTotal,
        card,
        message: `${player.username} received a ${card.cardId} card! They can use it whenever they want.`,
      },
      updatedAt: Date.now(),
    });
  }

  // color_l1 cards also go into the player's hand to be used later
  if (card.effectType === "color_l1") {
    const newCard = { cardId: card.cardId, effectType: card.effectType, color: card.color, text: card.text };
    return advanceTurn({
      ...gameState,
      cardBank: newCardBank,
      players: gameState.players.map(p =>
        p.id === playerId ? { ...p, heldCards: [...p.heldCards, newCard] } : p
      ),
      lastEvent: {
        type: "upgrader_card_received",
        playerId,
        diceTotal,
        card,
        message: `${player.username} received a ${card.color} Level 1 card! Use it to upgrade any base-level ${card.color} property.`,
      },
      updatedAt: Date.now(),
    });
  }

  return advanceTurn({ ...gameState, cardBank: newCardBank, updatedAt: Date.now() });
};


/**
 * applyDiceCard
 * Applies the effect of a chance or republic card to the game state.
 */
const applyDiceCard = (gameState, playerId, card) => {
  const player = getPlayerById(gameState, playerId);
  switch (card.effectType) {
    case "money_gain":
      return {
        ...gameState,
        players: gameState.players.map(p =>
          p.id === playerId ? { ...p, balance: p.balance + card.amount } : p
        ),
      };
    case "money_loss": {
      const amountToPay = Math.min(card.amount, player.balance);
      return {
        ...gameState,
        players: gameState.players.map(p =>
          p.id === playerId ? { ...p, balance: p.balance - amountToPay } : p
        ),
      };
    }
    case "go_to_jail":
      // Move token to jail square (outer index 31)
      return {
        ...gameState,
        players: gameState.players.map(p =>
          p.id === playerId
            ? { ...p, ring: "outer", positionIndex: 31, isJailed: true, jailTurnsRemaining: 1 }
            : p
        ),
      };
    case "move_to_start":
      // Republic card 5 — move token back to Start (outer index 0)
      return {
        ...gameState,
        players: gameState.players.map(p =>
          p.id === playerId
            ? { ...p, ring: "outer", positionIndex: 0 }
            : p
        ),
      };
    default:
      return gameState;
  }
};


// ════════════════════════════════════════════════════════════
//  SECTION 10 — COLOUR PAIRING SYSTEM
//  (Logic is embedded in calculateRent and resolveOwnProperty)
//  This section provides public helpers for the UI to query
//  pairing status for display purposes.
// ════════════════════════════════════════════════════════════

/**
 * getPairingStatus
 * Returns a summary of all pairing states for a given player.
 * Useful for the UI to display which pairings are active/complete.
 */
const getPairingStatus = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  if (!player) return {};

  const status = {};

  // Threshold groups
  ["yellow", "red", "orange", "black", "purple"].forEach(color => {
    const group = COLOR_GROUPS[color];
    const owned = player.ownedProperties.filter(id => group.propertyIds.includes(id));
    status[color] = {
      type: "threshold",
      owned: owned.length,
      threshold: group.threshold,
      total: group.totalProperties,
      unlocked: owned.length >= group.threshold,
    };
  });

  // Pink pairs
  status.pink = COLOR_GROUPS.pink.pairs.map(pair => ({
    pairId: pair.pairId,
    complete: isPinkPairComplete(pair, player.ownedProperties),
    owned: pair.properties.filter(id => player.ownedProperties.includes(id)),
    total: pair.properties.length,
  }));

  // PinkBrown pairs
  status.pinkBrown = COLOR_GROUPS.pinkBrown.pairs.map(pair => ({
    pairId: pair.pairId,
    complete: isPinkBrownPairComplete(pair, player.ownedProperties),
    owned: pair.properties.filter(id => player.ownedProperties.includes(id)),
    total: pair.properties.length,
  }));

  return status;
};


// ════════════════════════════════════════════════════════════
//  SECTION 11 — BANK BORROWING
// ════════════════════════════════════════════════════════════

/**
 * borrowFromBank
 * Player borrows a multiple of ₹10,000 from the bank.
 * CRITICAL RULE: every active (non-eliminated) player
 * receives the same amount simultaneously. This is the
 * unique wealth-balancing mechanic of this game.
 */
const borrowFromBank = (gameState, playerId, amount) => {
  if (amount % BORROW_UNIT !== 0 || amount <= 0) {
    return { ...gameState, lastEvent: { type: "error", message: `Borrow amount must be a multiple of ₹${BORROW_UNIT}.` } };
  }
  const borrower = getPlayerById(gameState, playerId);
  const activePlayers = gameState.players.filter(p => !p.isEliminated);

  // ALL active players receive the amount — not just the borrower
  const updatedPlayers = gameState.players.map(p =>
    p.isEliminated ? p : { ...p, balance: p.balance + amount }
  );

  const stateAfterBorrow = {
    ...gameState,
    players: updatedPlayers,
    pendingPayment: null, // will be cleared after auto-processing below
    lastEvent: {
      type: "bank_borrow",
      playerId,
      amount,
      message: `${borrower.username} borrowed ₹${amount} from the bank! All ${activePlayers.length} players received ₹${amount}.`,
    },
    updatedAt: Date.now(),
  };

  // ── OPTION A: Auto-process any pending payment immediately ──
  // If a pendingPayment exists (rent or fine that triggered the borrow),
  // automatically process it now that the player has sufficient funds.
  // The player sees one smooth flow: "Borrowed ₹X → Paid ₹Y rent/fine"
  const pending = gameState.pendingPayment;
  if (pending && pending.payerId === playerId) {
    const payerAfterBorrow = stateAfterBorrow.players.find(p => p.id === playerId);

    if (pending.type === "rent") {
      // Verify player now has enough after borrowing
      if (payerAfterBorrow.balance >= pending.amount) {
        const square = pending.squareId ? getSquareById(pending.squareId) : null;
        return processRentPayment(
          stateAfterBorrow,
          pending.payerId,
          pending.ownerId,
          pending.amount,
          square
        );
      }
      // Still not enough — keep pendingPayment so player can borrow more
      return { ...stateAfterBorrow, pendingPayment: pending };
    }

    if (pending.type === "fine") {
      if (payerAfterBorrow.balance >= pending.amount) {
        const updatedForFine = stateAfterBorrow.players.map(p =>
          p.id === playerId ? { ...p, balance: p.balance - pending.amount } : p
        );
        return advanceTurn({
          ...stateAfterBorrow,
          players: updatedForFine,
          pendingPayment: null,
          lastEvent: {
            type: "fine_paid",
            playerId,
            amount: pending.amount,
            message: `${borrower.username} borrowed ₹${amount} and paid ₹${pending.amount} fine to the bank.`,
          },
          updatedAt: Date.now(),
        });
      }
      // Still not enough — keep pendingPayment
      return { ...stateAfterBorrow, pendingPayment: pending };
    }
  }

  return stateAfterBorrow;
};


// ════════════════════════════════════════════════════════════
//  SECTION 12 — TURN MANAGEMENT
// ════════════════════════════════════════════════════════════

/**
 * advanceTurn
 * Moves to the next non-eliminated player's turn.
 * Checks if the next player is jailed and sets phase accordingly.
 * Also checks win condition after every turn advancement.
 */
const advanceTurn = (gameState) => {
  const gameOverCheck = checkWinCondition(gameState);
  if (gameOverCheck.status === "finished") return gameOverCheck;

  const total = gameState.turnOrder.length;
  let nextIndex = (gameState.currentPlayerIndex + 1) % total;
  let loops = 0;

  // Skip eliminated players
  while (
    getPlayerById(gameState, gameState.turnOrder[nextIndex])?.isEliminated &&
    loops < total
  ) {
    nextIndex = (nextIndex + 1) % total;
    loops++;
  }

  const nextPlayerId = gameState.turnOrder[nextIndex];
  const nextPlayer = getPlayerById(gameState, nextPlayerId);

  // If the next player is jailed, show them the jail decision screen
  if (nextPlayer.isJailed) {
    return {
      ...gameState,
      currentPlayerIndex: nextIndex,
      currentPhase: "jail_decision",
      lastEvent: {
        type: "jail_turn_start",
        playerId: nextPlayerId,
        message: `${nextPlayer.username} is in jail. Pay ₹${JAIL_FINE} to roll, or skip your turn.`,
      },
      updatedAt: Date.now(),
    };
  }

  return {
    ...gameState,
    currentPlayerIndex: nextIndex,
    currentPhase: "roll",
    lastEvent: {
      ...gameState.lastEvent,
      nextPlayerId,
      nextPlayerName: nextPlayer.username,
    },
    updatedAt: Date.now(),
  };
};


// ════════════════════════════════════════════════════════════
//  SECTION 13 — WIN / LOSE CONDITIONS
// ════════════════════════════════════════════════════════════

/**
 * eliminatePlayer
 * Called when a player cannot pay a mandatory debt.
 * All their properties return to the bank as unowned.
 * All their money also returns to the bank.
 * Then immediately checks if the game is over.
 */
const eliminatePlayer = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);

  // Return all their cards to the bank
  const newCardBank = { ...gameState.cardBank };
  player.heldCards.forEach(card => {
    if (newCardBank[card.cardId] !== undefined) {
      newCardBank[card.cardId] += 1;
    }
  });

  // Remove all their property ownerships
  const updatedProperties = { ...gameState.properties };
  player.ownedProperties.forEach(propId => { delete updatedProperties[propId]; });

  const updatedPlayers = gameState.players.map(p =>
    p.id === playerId
      ? { ...p, isEliminated: true, balance: 0, ownedProperties: [], heldCards: [] }
      : p
  );

  const stateAfterElim = {
    ...gameState,
    players: updatedPlayers,
    properties: updatedProperties,
    cardBank: newCardBank,
    lastEvent: {
      type: "player_eliminated",
      playerId,
      message: `${player.username} has been eliminated! All their properties return to the bank.`,
    },
    updatedAt: Date.now(),
  };

  return checkWinCondition(stateAfterElim);
};


/**
 * playerLeft
 * Called when a player disconnects or voluntarily leaves.
 * Identical to elimination — properties and money go to bank.
 */
const playerLeft = (gameState, playerId) => {
  const player = getPlayerById(gameState, playerId);
  const state = eliminatePlayer(gameState, playerId);
  return {
    ...state,
    lastEvent: {
      ...state.lastEvent,
      type: "player_left",
      message: `${player.username} left the game. Their properties and money return to the bank.`,
    },
  };
};


/**
 * checkWinCondition
 * If only 1 active player remains, they win and the game ends.
 */
const checkWinCondition = (gameState) => {
  const active = gameState.players.filter(p => !p.isEliminated);
  if (active.length === 1) {
    const winner = active[0];
    return {
      ...gameState,
      status: "finished",
      currentPhase: "finished",
      winner: winner.id,
      lastEvent: {
        type: "game_over",
        winnerId: winner.id,
        winnerName: winner.username,
        finalBalances: gameState.players.map(p => ({
          id: p.id,
          username: p.username,
          balance: p.balance,
          isEliminated: p.isEliminated,
          propertiesOwned: p.ownedProperties.length,
        })),
        message: `🏆 ${winner.username} wins the game with ₹${winner.balance}!`,
      },
      updatedAt: Date.now(),
    };
  }
  return gameState;
};


// ════════════════════════════════════════════════════════════
//  SECTION 14 — UTILITY HELPERS
// ════════════════════════════════════════════════════════════

const getCurrentPlayerId = (gameState) =>
  gameState.turnOrder[gameState.currentPlayerIndex];

const getPlayerById = (gameState, playerId) =>
  gameState.players.find(p => p.id === playerId) || null;

/** Generates a random 6-character room code with no ambiguous chars */
const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};


// ════════════════════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════════════════════

module.exports = {
  // Initialisation
  createInitialGameState,
  setTurnOrder,
  generateRoomCode,

  // Movement
  rollDice,
  movePlayer,

  // Player actions
  buyProperty,
  skipBuying,
  useDiscountPayCard,
  payRentFull,
  declareBlocker,
  useColorL1Card,
  useLevel2AnyCard,

  // Jail
  payJailFine,
  skipJailTurn,

  // Financial
  borrowFromBank,
  eliminatePlayer,
  playerLeft,

  // Pairing
  getPairingStatus,
  calculateRent,

  // Utilities
  getCurrentPlayerId,
  getPlayerById,
  checkWinCondition,

  // Constants
  STARTING_BALANCE,
  JAIL_FINE,
  BONUS_AMOUNT,
  FINE_AMOUNT,
  BORROW_UNIT,
  MAX_UPGRADE_LEVEL,
  OVER_LIMIT_BONUS,
};
