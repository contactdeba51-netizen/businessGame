// ============================================================
// boardData.js — Complete Board Configuration v2.0
//
// What changed in v2.0:
//   - Every property now has a 'color' field
//   - COLOR_GROUPS defines all 7 colour groups with their
//     pairing rules and thresholds
//   - CHANCE_CARDS, REPUBLIC_CARDS, UPGRADER_CARDS are now
//     dice-roll based (not random draw)
//   - CARD_BANK_SUPPLY tracks limited card availability
//   - Pink and PinkBrown pairing systems fully defined
//   - Helper functions for pairing checks added
//
// UPGRADE SYSTEM (important — read this):
//   Upgrades are FREE and happen automatically by landing
//   on your OWN property during your turn.
//   1st landing after buying  → upgrades to Level 1
//   2nd landing               → upgrades to Level 2
//   3rd landing               → upgrades to Level 3 (max)
//   Pink and PinkBrown properties have NO upgrade levels.
//
// PROPERTY LIMIT:
//   Max properties per player = floor(70 / numberOfPlayers)
//   e.g. 6 players → max 11 each, 4 remainder for anyone.
// ============================================================


// ════════════════════════════════════════════════════════════
//  CARD BANK SUPPLY
//  The bank holds a limited physical supply of special cards.
//  When received by a player the count goes down.
//  When used the card returns and count goes back up.
// ════════════════════════════════════════════════════════════

const CARD_BANK_SUPPLY = {
  discount_pay:  2,  // 50% off rent payment — 2 copies in bank
  discount_buy:  2,  // 50% off property purchase — 2 copies
  blocker:       5,  // Block rent on declared dice number — 5 copies
  red_l1:        1,  // Instantly upgrade one Red property to L1
  purple_l1:     1,  // Instantly upgrade one Purple property to L1
  black_l1:      1,  // Instantly upgrade one Black property to L1
  yellow_l1:     1,  // Instantly upgrade one Yellow property to L1
  orange_l1:     1,  // Instantly upgrade one Orange property to L1
  level2_any:    2,  // Upgrade any ONE Level-1 property to Level 2
};


// ════════════════════════════════════════════════════════════
//  CHANCE CARDS
//  The effect is determined by the DICE TOTAL that brought
//  the player to the Chance square — not a random draw.
//  Possible totals: 2 through 12 (11 outcomes).
// ════════════════════════════════════════════════════════════

const CHANCE_CARDS = {
  2:  { diceTotal: 2,  text: "Lucky day! Receive ₹500 from the bank.",      effectType: "money_gain", amount: 500  },
  3:  { diceTotal: 3,  text: "Tax bill! Pay ₹500 to the bank.",              effectType: "money_loss", amount: 500  },
  4:  { diceTotal: 4,  text: "Bonus reward! Receive ₹500 from the bank.",    effectType: "money_gain", amount: 500  },
  5:  { diceTotal: 5,  text: "Windfall! Receive ₹1000 from the bank.",       effectType: "money_gain", amount: 1000 },
  6:  { diceTotal: 6,  text: "Go directly to Jail!",                         effectType: "go_to_jail"              },
  7:  { diceTotal: 7,  text: "Fine imposed! Pay ₹500 to the bank.",          effectType: "money_loss", amount: 500  },
  8:  { diceTotal: 8,  text: "Jackpot! Receive ₹2000 from the bank.",        effectType: "money_gain", amount: 2000 },
  9:  { diceTotal: 9,  text: "Penalty! Pay ₹1000 to the bank.",              effectType: "money_loss", amount: 1000 },
  10: { diceTotal: 10, text: "Surprise bonus! Receive ₹700 from the bank.",  effectType: "money_gain", amount: 700  },
  11: { diceTotal: 11, text: "Heavy fine! Pay ₹1500 to the bank.",           effectType: "money_loss", amount: 1500 },
  12: { diceTotal: 12, text: "Deduction! Pay ₹600 to the bank.",             effectType: "money_loss", amount: 600  },
};


// ════════════════════════════════════════════════════════════
//  REPUBLIC CARDS
//  Also dice-total based, same mechanic as Chance.
// ════════════════════════════════════════════════════════════

const REPUBLIC_CARDS = {
  2:  { diceTotal: 2,  text: "Republic fine! Pay ₹500 to the bank.",         effectType: "money_loss",    amount: 500  },
  3:  { diceTotal: 3,  text: "Government subsidy! Receive ₹500.",             effectType: "money_gain",    amount: 500  },
  4:  { diceTotal: 4,  text: "Budget cut! Pay ₹500 to the bank.",             effectType: "money_loss",    amount: 500  },
  5:  { diceTotal: 5,  text: "Republic order! Move to the Start position.",   effectType: "move_to_start"              },
  6:  { diceTotal: 6,  text: "Republic reward! Receive ₹700.",                effectType: "money_gain",    amount: 700  },
  7:  { diceTotal: 7,  text: "National bonus! Receive ₹1000.",                effectType: "money_gain",    amount: 1000 },
  8:  { diceTotal: 8,  text: "Republic tax! Pay ₹1000 to the bank.",          effectType: "money_loss",    amount: 1000 },
  9:  { diceTotal: 9,  text: "Election windfall! Receive ₹2000.",             effectType: "money_gain",    amount: 2000 },
  10: { diceTotal: 10, text: "Austerity measure! Pay ₹1500 to the bank.",     effectType: "money_loss",    amount: 1500 },
  11: { diceTotal: 11, text: "Republic levy! Pay ₹500 to the bank.",          effectType: "money_loss",    amount: 500  },
  12: { diceTotal: 12, text: "Republic gift! Receive ₹600.",                  effectType: "money_gain",    amount: 600  },
};


// ════════════════════════════════════════════════════════════
//  UPGRADER CARDS
//  Dice-total based. Each card type has limited bank supply.
//  effectType meanings:
//    discount_pay  — hold card, use when paying rent (halves rent)
//    discount_buy  — hold card, use when buying property (halves price)
//    blocker       — declare a dice number before rolling; if that
//                    number comes up, rent is blocked for that turn.
//                    Card is consumed regardless of dice outcome.
//    color_l1      — instantly upgrade one owned property of
//                    that colour from base to Level 1 (free).
//                    Does nothing if player owns no base-level
//                    properties of that colour.
//    level2_any    — upgrade any ONE of your Level-1 properties
//                    to Level 2 instantly. Does nothing if you
//                    have no Level-1 properties at all.
//    Pink/PinkBrown properties are EXCLUDED from all upgrader cards.
// ════════════════════════════════════════════════════════════

const UPGRADER_CARDS = {
  2:  { diceTotal: 2,  text: "50% Discount — Paying! Halves your next rent payment.",          effectType: "discount_pay",  cardId: "discount_pay",  color: null     },
  3:  { diceTotal: 3,  text: "Red Level 1! Upgrade one of your Red properties to Level 1.",    effectType: "color_l1",      cardId: "red_l1",        color: "red"    },
  4:  { diceTotal: 4,  text: "Blocker! Declare a dice number to block rent before rolling.",   effectType: "blocker",       cardId: "blocker",       color: null     },
  5:  { diceTotal: 5,  text: "Purple Level 1! Upgrade one Purple property to Level 1.",        effectType: "color_l1",      cardId: "purple_l1",     color: "purple" },
  6:  { diceTotal: 6,  text: "Black Level 1! Upgrade one Black property to Level 1.",          effectType: "color_l1",      cardId: "black_l1",      color: "black"  },
  7:  { diceTotal: 7,  text: "Yellow Level 1! Upgrade one Yellow property to Level 1.",        effectType: "color_l1",      cardId: "yellow_l1",     color: "yellow" },
  8:  { diceTotal: 8,  text: "Blocker! Declare a dice number to block rent before rolling.",   effectType: "blocker",       cardId: "blocker",       color: null     },
  9:  { diceTotal: 9,  text: "Orange Level 1! Upgrade one Orange property to Level 1.",        effectType: "color_l1",      cardId: "orange_l1",     color: "orange" },
  10: { diceTotal: 10, text: "50% Discount — Buying! Halves the price of your next purchase.", effectType: "discount_buy",  cardId: "discount_buy",  color: null     },
  11: { diceTotal: 11, text: "Level 2 Any! Upgrade any one Level-1 property to Level 2.",      effectType: "level2_any",    cardId: "level2_any",    color: null     },
  12: { diceTotal: 12, text: "Level 2 Any! Upgrade any one Level-1 property to Level 2.",      effectType: "level2_any",    cardId: "level2_any",    color: null     },
};


// ════════════════════════════════════════════════════════════
//  COLOUR GROUPS
//
//  Two types of colour group exist:
//
//  1. "threshold" groups (Yellow, Red, Orange, Black, Purple)
//     When one player owns >= threshold properties from this
//     group, ALL their properties in this group get doubled
//     rent across all four levels (base, L1, L2, L3).
//     Acquiring more properties after unlocking also benefits.
//
//  2. "pairing" groups (Pink)
//     Specific property combinations must all be owned by
//     ONE player. When complete, rents evolve — either to
//     higher flat amounts or to dynamic dice multipliers.
//     Pink properties have NO upgrade levels.
//
//  3. "pairing_selfbonus" groups (PinkBrown)
//     Same one-owner pairing condition. Rent charged to
//     OTHER players never changes. When the OWNER's own
//     token lands on their PinkBrown property, the bank
//     pays the owner a bonus (higher after pairing).
//     PinkBrown properties have NO upgrade levels.
// ════════════════════════════════════════════════════════════

const COLOR_GROUPS = {

  yellow: {
    color: "yellow",
    type: "threshold",
    threshold: 5,          // own 5 of 10 to unlock doubling
    totalProperties: 10,
    propertyIds: [
      "O-P-008",  // Nepal
      "O-P-014",  // Oman
      "O-P-020",  // Netherlands
      "O-P-026",  // Namibia
      "O-P-033",  // Papua New Guinea
      "O-P-039",  // UAE
      "O-P-043",  // USA
      "O-P-047",  // Scotland
      "I-P-002",  // Hong Kong
      "I-P-012",  // Uganda
    ],
  },

  red: {
    color: "red",
    type: "threshold",
    threshold: 4,          // own 4 of 8 to unlock doubling
    totalProperties: 8,
    propertyIds: [
      "O-P-003",  // AC Milan
      "O-P-023",  // Manchester United
      "O-P-038",  // Liverpool
      "O-P-051",  // Real Madrid
      "I-P-001",  // Bayern Munich
      "I-P-007",  // Barcelona
      "I-P-008",  // Ajax
      "I-P-015",  // Juventus
    ],
  },

  orange: {
    color: "orange",
    type: "threshold",
    threshold: 5,          // own 5 of 11 to unlock doubling
    totalProperties: 11,
    propertyIds: [
      "O-P-005",  // Bayer Leverkusen
      "O-P-012",  // Leicester City
      "O-P-018",  // Sevilla FC
      "O-P-022",  // Tottenham Hotspur
      "O-P-028",  // Real Betis
      "O-P-034",  // Aston Villa
      "O-P-040",  // Newcastle United
      "O-P-046",  // AS Roma
      "O-P-052",  // Athletic Club
      "I-P-003",  // Crystal Palace
      "I-P-011",  // Marseille
    ],
  },

  black: {
    color: "black",
    type: "threshold",
    threshold: 6,          // own 6 of 12 to unlock doubling
    totalProperties: 12,
    propertyIds: [
      "O-P-002",  // Australia
      "O-P-006",  // South Africa
      "O-P-013",  // Bangladesh
      "O-P-015",  // Afghanistan
      "O-P-017",  // Pakistan
      "O-P-029",  // West Indies
      "O-P-032",  // India
      "O-P-035",  // Sri Lanka
      "O-P-042",  // England
      "O-P-048",  // New Zealand
      "I-P-009",  // Ireland
      "I-P-017",  // Zimbabwe
    ],
  },

  purple: {
    color: "purple",
    type: "threshold",
    threshold: 6,          // own 6 of 12 to unlock doubling
    totalProperties: 12,
    propertyIds: [
      "O-P-004",  // Benfica
      "O-P-009",  // Arsenal
      "O-P-019",  // Chelsea
      "O-P-025",  // Atletico Madrid
      "O-P-030",  // PSG
      "O-P-036",  // Inter Milan
      "O-P-045",  // Manchester City
      "O-P-049",  // Borussia Dortmund
      "I-P-005",  // Napoli
      "I-P-006",  // Sporting CP
      "I-P-013",  // Porto
      "I-P-016",  // PSV
    ],
  },

  // ── PINK GROUP ─────────────────────────────────────────────
  // 6 pairs. ALL properties in a pair must be owned by the
  // SAME player for evolution to activate.
  // If split across players, both stay in solo mode forever
  // (no trading system exists to resolve a split).
  // upgradeEnabled: false — no L1/L2/L3 for Pink properties.

  pink: {
    color: "pink",
    type: "pairing",
    upgradeEnabled: false,
    pairs: [
      {
        // Pair 1 — Al Nassr + Inter Miami + Santos (3 properties)
        // Solo: flat fixed rents.
        // Evolved: dynamic rent = diceRoll × multiplier.
        pairId: "PINK-PAIR-1",
        properties: ["O-P-001", "O-P-021", "I-P-018"],
        evolutionType: "dice_multiplier",
        soloRents: {
          "O-P-001": 1000,  // Al Nassr flat solo rent
          "O-P-021": 800,   // Inter Miami flat solo rent
          "I-P-018": 800,   // Santos flat solo rent
        },
        // After pairing: rent = diceRoll × multiplier
        evolvedMultipliers: {
          "O-P-001": 500,   // Al Nassr: e.g. roll 6 → pay 6×500=₹3000
          "O-P-021": 400,   // Inter Miami: roll 6 → pay ₹2400
          "I-P-018": 300,   // Santos: roll 6 → pay ₹1800
        },
      },
      {
        // Pair 2 — RR + KKR (2 properties)
        // Solo and evolved are both flat — evolved is double solo.
        pairId: "PINK-PAIR-2",
        properties: ["O-P-007", "O-P-041"],
        evolutionType: "flat_double",
        soloRents:    { "O-P-007": 800,  "O-P-041": 1200 },
        evolvedRents: { "O-P-007": 1600, "O-P-041": 2400 },
      },
      {
        // Pair 3 — CSK + MI (2 properties)
        pairId: "PINK-PAIR-3",
        properties: ["O-P-010", "O-P-031"],
        evolutionType: "flat_double",
        soloRents:    { "O-P-010": 1500, "O-P-031": 1500 },
        evolvedRents: { "O-P-010": 3000, "O-P-031": 3000 },
      },
      {
        // Pair 4 — DC + PBKS (2 properties)
        // Both solo AND evolved use dice multipliers (unique pair).
        // Even in solo mode rent is dynamic, not flat.
        pairId: "PINK-PAIR-4",
        properties: ["O-P-016", "O-P-044"],
        evolutionType: "dice_multiplier",
        // Solo multipliers (used before pairing)
        soloMultipliers:    { "O-P-016": 100, "O-P-044": 150 },
        // Evolved multipliers (used after pairing complete)
        evolvedMultipliers: { "O-P-016": 200, "O-P-044": 250 },
      },
      {
        // Pair 5 — RCB + SRH (2 properties)
        pairId: "PINK-PAIR-5",
        properties: ["O-P-024", "O-P-050"],
        evolutionType: "flat_double",
        soloRents:    { "O-P-024": 1200, "O-P-050": 1000 },
        evolvedRents: { "O-P-024": 2400, "O-P-050": 2000 },
      },
      {
        // Pair 6 — GT + LSG (2 properties)
        pairId: "PINK-PAIR-6",
        properties: ["I-P-014", "I-P-004"],
        evolutionType: "flat_double",
        soloRents:    { "I-P-014": 1000, "I-P-004": 800  },
        evolvedRents: { "I-P-014": 2000, "I-P-004": 1600 },
      },
    ],
  },

  // ── PINK + BROWN (MAROON) GROUP ────────────────────────────
  // 2 pairs. Unique "self-landing bonus" mechanic:
  //   - Rent OTHER players pay = always fixed, never changes.
  //   - When the OWNER's token lands on their own PinkBrown
  //     property, the BANK pays the owner a bonus.
  //   - Solo bonus (owns 1 of the pair) < paired bonus.
  // upgradeEnabled: false — no L1/L2/L3.

  pinkBrown: {
    color: "pinkBrown",
    type: "pairing_selfbonus",
    upgradeEnabled: false,
    pairs: [
      {
        // Pair 1 — East Bengal + Mohun Bagan
        pairId: "PINKBROWN-PAIR-1",
        properties: ["O-P-011", "O-P-037"],
        // What other players ALWAYS pay — unchanged by pairing
        fixedRentForOthers: {
          "O-P-011": 1500,  // East Bengal
          "O-P-037": 1500,  // Mohun Bagan
        },
        // What the BANK pays the owner when they land on OWN property
        selfLandingBonus: {
          solo:   1000,  // owns only 1 of the 2
          paired: 2000,  // owns both — doubled bonus
        },
      },
      {
        // Pair 2 — Kerala Blasters + Mumbai City
        pairId: "PINKBROWN-PAIR-2",
        properties: ["O-P-027", "I-P-010"],
        fixedRentForOthers: {
          "O-P-027": 1000,  // Kerala Blasters
          "I-P-010": 1000,  // Mumbai City
        },
        selfLandingBonus: {
          solo:   500,   // owns only 1 of the 2
          paired: 1000,  // owns both — doubled bonus
        },
      },
    ],
  },

};


// ════════════════════════════════════════════════════════════
//  PORTAL PAIRING MAP
// ════════════════════════════════════════════════════════════

const portalMap = {
  "O-PORT-1": "I-PORT-1",  // Outer[7]  ↔ Inner[3]
  "O-PORT-2": "I-PORT-2",  // Outer[18] ↔ Inner[11]
  "O-PORT-3": "I-PORT-3",  // Outer[27] ↔ Inner[14]
  "O-PORT-4": "I-PORT-4",  // Outer[37] ↔ Inner[18]
  "O-PORT-5": "I-PORT-5",  // Outer[50] ↔ Inner[25]
  "O-PORT-6": "I-PORT-6",  // Outer[59] ↔ Inner[29]
  "I-PORT-1": "O-PORT-1",
  "I-PORT-2": "O-PORT-2",
  "I-PORT-3": "O-PORT-3",
  "I-PORT-4": "O-PORT-4",
  "I-PORT-5": "O-PORT-5",
  "I-PORT-6": "O-PORT-6",
};


// ════════════════════════════════════════════════════════════
//  OUTER RING — 62 squares
// ════════════════════════════════════════════════════════════

const outerRing = [
  { id:"O-START",  sequenceIndex:0,  type:"start",    name:"Start",             color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"O-P-001",  sequenceIndex:1,  type:"property", name:"Al Nassr",          color:"pink",      buyPrice:4500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-002",  sequenceIndex:2,  type:"property", name:"Australia",         color:"black",     buyPrice:4400, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-003",  sequenceIndex:3,  type:"property", name:"AC Milan",          color:"red",       buyPrice:2500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-004",  sequenceIndex:4,  type:"property", name:"Benfica",           color:"purple",    buyPrice:2500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-005",  sequenceIndex:5,  type:"property", name:"Bayer Leverkusen",  color:"orange",    buyPrice:3900, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-006",  sequenceIndex:6,  type:"property", name:"South Africa",      color:"black",     buyPrice:4000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-PORT-1", sequenceIndex:7,  type:"portal",   name:"Portal",            color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"I-PORT-1" },
  { id:"O-P-007",  sequenceIndex:8,  type:"property", name:"RR",                color:"pink",      buyPrice:3800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-008",  sequenceIndex:9,  type:"property", name:"Nepal",             color:"yellow",    buyPrice:3800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-009",  sequenceIndex:10, type:"property", name:"Arsenal",           color:"purple",    buyPrice:4000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-010",  sequenceIndex:11, type:"property", name:"CSK",               color:"pink",      buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-011",  sequenceIndex:12, type:"property", name:"East Bengal",       color:"pinkBrown", buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-012",  sequenceIndex:13, type:"property", name:"Leicester City",    color:"orange",    buyPrice:3600, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-013",  sequenceIndex:14, type:"property", name:"Bangladesh",        color:"black",     buyPrice:3300, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-014",  sequenceIndex:15, type:"property", name:"Oman",              color:"yellow",    buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-015",  sequenceIndex:16, type:"property", name:"Afghanistan",       color:"black",     buyPrice:2500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-016",  sequenceIndex:17, type:"property", name:"DC",                color:"pink",      buyPrice:2500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-PORT-2", sequenceIndex:18, type:"portal",   name:"Portal",            color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"I-PORT-2" },
  { id:"O-P-017",  sequenceIndex:19, type:"property", name:"Pakistan",          color:"black",     buyPrice:3600, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-018",  sequenceIndex:20, type:"property", name:"Sevilla FC",        color:"orange",    buyPrice:4200, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-019",  sequenceIndex:21, type:"property", name:"Chelsea",           color:"purple",    buyPrice:3800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-020",  sequenceIndex:22, type:"property", name:"Netherlands",       color:"yellow",    buyPrice:3500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-021",  sequenceIndex:23, type:"property", name:"Inter Miami",       color:"pink",      buyPrice:3500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-UPG-1",  sequenceIndex:24, type:"upgrader", name:"Upgrader",          color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"O-P-022",  sequenceIndex:25, type:"property", name:"Tottenham Hotspur", color:"orange",    buyPrice:3900, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-023",  sequenceIndex:26, type:"property", name:"Manchester United", color:"red",       buyPrice:4500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-PORT-3", sequenceIndex:27, type:"portal",   name:"Portal",            color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"I-PORT-3" },
  { id:"O-P-024",  sequenceIndex:28, type:"property", name:"RCB",               color:"pink",      buyPrice:3500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-025",  sequenceIndex:29, type:"property", name:"Atletico Madrid",   color:"purple",    buyPrice:3500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-026",  sequenceIndex:30, type:"property", name:"Namibia",           color:"yellow",    buyPrice:2500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-JAIL",   sequenceIndex:31, type:"jail",     name:"Jail",              color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"O-P-027",  sequenceIndex:32, type:"property", name:"Kerala Blasters",   color:"pinkBrown", buyPrice:2500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-028",  sequenceIndex:33, type:"property", name:"Real Betis",        color:"orange",    buyPrice:3300, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-029",  sequenceIndex:34, type:"property", name:"West Indies",       color:"black",     buyPrice:3500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-030",  sequenceIndex:35, type:"property", name:"PSG",               color:"purple",    buyPrice:3800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-031",  sequenceIndex:36, type:"property", name:"MI",                color:"pink",      buyPrice:4000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-PORT-4", sequenceIndex:37, type:"portal",   name:"Portal",            color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"I-PORT-4" },
  { id:"O-P-032",  sequenceIndex:38, type:"property", name:"India",             color:"black",     buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-033",  sequenceIndex:39, type:"property", name:"Papua New Guinea",  color:"yellow",    buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-034",  sequenceIndex:40, type:"property", name:"Aston Villa",       color:"orange",    buyPrice:3400, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-035",  sequenceIndex:41, type:"property", name:"Sri Lanka",         color:"black",     buyPrice:3500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-036",  sequenceIndex:42, type:"property", name:"Inter Milan",       color:"purple",    buyPrice:3600, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-037",  sequenceIndex:43, type:"property", name:"Mohun Bagan",       color:"pinkBrown", buyPrice:4000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-038",  sequenceIndex:44, type:"property", name:"Liverpool",         color:"red",       buyPrice:3500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-039",  sequenceIndex:45, type:"property", name:"UAE",               color:"yellow",    buyPrice:3800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-040",  sequenceIndex:46, type:"property", name:"Newcastle United",  color:"orange",    buyPrice:3800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-041",  sequenceIndex:47, type:"property", name:"KKR",               color:"pink",      buyPrice:4600, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-042",  sequenceIndex:48, type:"property", name:"England",           color:"black",     buyPrice:3600, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-043",  sequenceIndex:49, type:"property", name:"USA",               color:"yellow",    buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-PORT-5", sequenceIndex:50, type:"portal",   name:"Portal",            color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"I-PORT-5" },
  { id:"O-P-044",  sequenceIndex:51, type:"property", name:"PBKS",              color:"pink",      buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-045",  sequenceIndex:52, type:"property", name:"Manchester City",   color:"purple",    buyPrice:4000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-046",  sequenceIndex:53, type:"property", name:"AS Roma",           color:"orange",    buyPrice:3200, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-047",  sequenceIndex:54, type:"property", name:"Scotland",          color:"yellow",    buyPrice:3200, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-UPG-2",  sequenceIndex:55, type:"upgrader", name:"Upgrader",          color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"O-P-048",  sequenceIndex:56, type:"property", name:"New Zealand",       color:"black",     buyPrice:3300, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-049",  sequenceIndex:57, type:"property", name:"Borussia Dortmund", color:"purple",    buyPrice:3200, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-050",  sequenceIndex:58, type:"property", name:"SRH",               color:"pink",      buyPrice:2500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-PORT-6", sequenceIndex:59, type:"portal",   name:"Portal",            color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"I-PORT-6" },
  { id:"O-P-051",  sequenceIndex:60, type:"property", name:"Real Madrid",       color:"red",       buyPrice:4600, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"O-P-052",  sequenceIndex:61, type:"property", name:"Athletic Club",     color:"orange",    buyPrice:3200, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
];


// ════════════════════════════════════════════════════════════
//  INNER RING — 30 squares
// ════════════════════════════════════════════════════════════

const innerRing = [
  { id:"I-CHN-1",  sequenceIndex:0,  type:"chance",   name:"Chance",        color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"I-P-001",  sequenceIndex:1,  type:"property", name:"Bayern Munich", color:"red",       buyPrice:4200, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-P-002",  sequenceIndex:2,  type:"property", name:"Hong Kong",     color:"yellow",    buyPrice:2900, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-PORT-1", sequenceIndex:3,  type:"portal",   name:"Portal",        color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"O-PORT-1" },
  { id:"I-P-003",  sequenceIndex:4,  type:"property", name:"Crystal Palace",color:"orange",    buyPrice:2800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-P-004",  sequenceIndex:5,  type:"property", name:"LSG",           color:"pink",      buyPrice:2500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-P-005",  sequenceIndex:6,  type:"property", name:"Napoli",        color:"purple",    buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-P-006",  sequenceIndex:7,  type:"property", name:"Sporting CP",   color:"purple",    buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-BON-1",  sequenceIndex:8,  type:"bonus",    name:"Bonus",         color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"I-P-007",  sequenceIndex:9,  type:"property", name:"Barcelona",     color:"red",       buyPrice:4200, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-P-008",  sequenceIndex:10, type:"property", name:"Ajax",          color:"red",       buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-PORT-2", sequenceIndex:11, type:"portal",   name:"Portal",        color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"O-PORT-2" },
  { id:"I-P-009",  sequenceIndex:12, type:"property", name:"Ireland",       color:"black",     buyPrice:2800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-REP-1",  sequenceIndex:13, type:"republic", name:"Republic",      color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"I-PORT-3", sequenceIndex:14, type:"portal",   name:"Portal",        color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"O-PORT-3" },
  { id:"I-P-010",  sequenceIndex:15, type:"property", name:"Mumbai City",   color:"pinkBrown", buyPrice:3500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-CHN-2",  sequenceIndex:16, type:"chance",   name:"Chance",        color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"I-P-011",  sequenceIndex:17, type:"property", name:"Marseille",     color:"orange",    buyPrice:2800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-PORT-4", sequenceIndex:18, type:"portal",   name:"Portal",        color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"O-PORT-4" },
  { id:"I-P-012",  sequenceIndex:19, type:"property", name:"Uganda",        color:"yellow",    buyPrice:2800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-P-013",  sequenceIndex:20, type:"property", name:"Porto",         color:"purple",    buyPrice:2800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-P-014",  sequenceIndex:21, type:"property", name:"GT",            color:"pink",      buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-FIN-1",  sequenceIndex:22, type:"fine",     name:"Fine",          color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"I-P-015",  sequenceIndex:23, type:"property", name:"Juventus",      color:"red",       buyPrice:3500, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-P-016",  sequenceIndex:24, type:"property", name:"PSV",           color:"purple",    buyPrice:2800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-PORT-5", sequenceIndex:25, type:"portal",   name:"Portal",        color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"O-PORT-5" },
  { id:"I-P-017",  sequenceIndex:26, type:"property", name:"Zimbabwe",      color:"black",     buyPrice:2800, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-REP-2",  sequenceIndex:27, type:"republic", name:"Republic",      color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:null       },
  { id:"I-P-018",  sequenceIndex:28, type:"property", name:"Santos",        color:"pink",      buyPrice:3000, baseRent:100,  rentL1:200,  rentL2:300,  rentL3:400,  pairedPortalId:null       },
  { id:"I-PORT-6", sequenceIndex:29, type:"portal",   name:"Portal",        color:null,        buyPrice:null, baseRent:null, rentL1:null, rentL2:null, rentL3:null, pairedPortalId:"O-PORT-6" },
];


// ════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════

const getSquareById = (id) =>
  outerRing.find(sq => sq.id === id) ||
  innerRing.find(sq => sq.id === id) || null;

const getSquareByIndex = (ring, index) =>
  ring === "outer" ? outerRing[index] || null : innerRing[index] || null;

const getPortalDestination = (portalId) => portalMap[portalId] || null;

const getAllProperties = () => [
  ...outerRing.filter(sq => sq.type === "property"),
  ...innerRing.filter(sq => sq.type === "property"),
];

// Calculate the max properties any single player may own
const getMaxPropertiesPerPlayer = (playerCount) =>
  Math.floor(70 / playerCount);

// Check if threshold-based pairing is unlocked for a player
// colorGroup = "yellow" | "red" | "orange" | "black" | "purple"
const isThresholdPairingUnlocked = (colorGroup, ownedPropertyIds) => {
  const group = COLOR_GROUPS[colorGroup];
  if (!group || group.type !== "threshold") return false;
  const owned = ownedPropertyIds.filter(id => group.propertyIds.includes(id));
  return owned.length >= group.threshold;
};

// Check if a specific Pink pair is complete for a player
const isPinkPairComplete = (pairConfig, ownedPropertyIds) =>
  pairConfig.properties.every(id => ownedPropertyIds.includes(id));

// Check if a specific PinkBrown pair is complete for a player
const isPinkBrownPairComplete = (pairConfig, ownedPropertyIds) =>
  pairConfig.properties.every(id => ownedPropertyIds.includes(id));

// Find which Pink pair a property belongs to (if any)
const findPinkPair = (squareId) => {
  for (const pair of COLOR_GROUPS.pink.pairs) {
    if (pair.properties.includes(squareId)) return pair;
  }
  return null;
};

// Find which PinkBrown pair a property belongs to (if any)
const findPinkBrownPair = (squareId) => {
  for (const pair of COLOR_GROUPS.pinkBrown.pairs) {
    if (pair.properties.includes(squareId)) return pair;
  }
  return null;
};

const getBoardSummary = () => ({
  outerRingTotal:  outerRing.length,
  innerRingTotal:  innerRing.length,
  totalSquares:    outerRing.length + innerRing.length,
  totalProperties: getAllProperties().length,
  outerProperties: outerRing.filter(sq => sq.type === "property").length,
  innerProperties: innerRing.filter(sq => sq.type === "property").length,
  outerPortals:    outerRing.filter(sq => sq.type === "portal").length,
  innerPortals:    innerRing.filter(sq => sq.type === "portal").length,
  colorBreakdown: {
    yellow:    COLOR_GROUPS.yellow.propertyIds.length,
    red:       COLOR_GROUPS.red.propertyIds.length,
    orange:    COLOR_GROUPS.orange.propertyIds.length,
    black:     COLOR_GROUPS.black.propertyIds.length,
    purple:    COLOR_GROUPS.purple.propertyIds.length,
    pink:      COLOR_GROUPS.pink.pairs.reduce((acc, p) => acc + p.properties.length, 0),
    pinkBrown: COLOR_GROUPS.pinkBrown.pairs.reduce((acc, p) => acc + p.properties.length, 0),
  },
});

// ════════════════════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════════════════════

module.exports = {
  outerRing,
  innerRing,
  portalMap,
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
  getBoardSummary,
};