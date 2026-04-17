import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../services/socket';
import { outerRing, innerRing, COLOR_GROUPS } from '../data/boardData';

const socket = getSocket();

const COLOR_MAP = {
  yellow:'#e6b800', red:'#e03030', orange:'#f07020',
  black:'#555555', purple:'#7c3aed', pink:'#e879a0', pinkBrown:'#a05050',
};
const TYPE_COLOR = {
  start:'#22c55e', jail:'#ef4444', portal:'#06b6d4',
  upgrader:'#a855f7', chance:'#f59e0b', republic:'#3b82f6', bonus:'#10b981', fine:'#f43f5e',
};
const TYPE_ICON = {
  start:'GO', jail:'⚖', portal:'⟁', upgrader:'↑', chance:'?', republic:'R', bonus:'$', fine:'✕',
};
const getBg = sq => sq.type === 'property'
  ? (COLOR_MAP[sq.color] || '#888')
  : (TYPE_COLOR[sq.type] || '#444');

// ── helpers ──────────────────────────────────────────────────
const getAllSquares = () => [
  ...outerRing.map(sq => ({ ...sq, ring: 'outer' })),
  ...innerRing.map(sq => ({ ...sq, ring: 'inner' })),
];

const getGroupInfo = (color, ownedPropertyIds = []) => {
  const group = COLOR_GROUPS[color];
  if (!group) return null;
  if (group.type === 'threshold') {
    const owned = ownedPropertyIds.filter(id => group.propertyIds.includes(id)).length;
    return { total: group.totalProperties, owned, threshold: group.threshold };
  }
  if (group.type === 'pairing' || group.type === 'pairing_selfbonus') {
    let totalInGroup = 0, ownedInGroup = 0;
    group.pairs.forEach(pair => {
      totalInGroup  += pair.properties.length;
      ownedInGroup  += pair.properties.filter(id => ownedPropertyIds.includes(id)).length;
    });
    return { total: totalInGroup, owned: ownedInGroup, threshold: null };
  }
  return null;
};

// ── Square ───────────────────────────────────────────────────
const Square = ({ sq, players, onClick }) => {
  const here = players.filter(
    p => p.ring === sq.ring && p.positionIndex === sq.sequenceIndex && !p.isEliminated
  );
  return (
    <div onClick={() => onClick(sq)} title={sq.name} style={{
      background: getBg(sq), border: '1px solid rgba(255,255,255,0.18)', borderRadius: 3,
      minHeight: 32, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', cursor: 'pointer', padding: 1, overflow: 'hidden',
    }}>
      <div style={{
        fontSize: 6, color: '#fff', fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
        textShadow: '0 1px 3px rgba(0,0,0,0.9)', wordBreak: 'break-word', padding: '0 1px',
      }}>
        {TYPE_ICON[sq.type] || sq.name?.slice(0, 7)}
      </div>
      {here.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:1, marginTop:1, justifyContent:'center' }}>
          {here.map((p, i) => (
            <div key={i} style={{
              width:7, height:7, borderRadius:'50%',
              background: p.tokenColor, border:'1px solid #fff', flexShrink:0,
            }} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── PlayerCard ───────────────────────────────────────────────
const PlayerCard = ({ player, isCurrent, isMe }) => (
  <div style={{
    background: isCurrent ? 'rgba(212,160,23,0.15)' : 'rgba(255,255,255,0.06)',
    border: isCurrent ? '1.5px solid #d4a017' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8, padding: '8px 12px', marginBottom: 6,
  }}>
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{
        width:12, height:12, borderRadius:'50%',
        background: player.tokenColor, border:'1.5px solid #fff', flexShrink:0,
      }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          color:'#fff', fontWeight:600, fontSize:12,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
        }}>
          {player.username}{isMe ? ' (you)' : ''}{isCurrent ? ' 🎯' : ''}
        </div>
        <div style={{ color:'#8fb8d8', fontSize:10, marginTop:1 }}>
          ₹{(player.balance || 0).toLocaleString()} · {(player.ownedProperties || []).length} props
        </div>
      </div>
    </div>
    {player.isJailed && (
      <div style={{ color:'#fca5a5', fontSize:9, marginTop:3 }}>⚖ In Jail</div>
    )}
    {(player.heldCards || []).length > 0 && (
      <div style={{ color:'#fde68a', fontSize:9, marginTop:3 }}>
        🃏 {player.heldCards.map(c => c.cardId).join(', ')}
      </div>
    )}
  </div>
);

// ── PropertyPopup (Buy/Skip) ──────────────────────────────────
const PropertyPopup = ({ gameState, me, currentSquare, onBuy, onSkip }) => {
  if (!currentSquare || currentSquare.type !== 'property') return null;
  const propInfo  = gameState.properties?.[currentSquare.id];
  const owner     = propInfo?.ownerId
    ? gameState.players?.find(p => p.id === propInfo.ownerId) : null;
  const isOwned   = !!owner;
  const isMine    = owner?.id === me?.id;
  const myOwned   = me?.ownedProperties || [];
  const groupInfo = getGroupInfo(currentSquare.color, myOwned);
  const colorHex  = COLOR_MAP[currentSquare.color] || '#888';
  const canAfford = (me?.balance || 0) >= (currentSquare.buyPrice || 0);
  const rentLevels = [
    { label:'Base',    value: currentSquare.baseRent },
    { label:'Level 1', value: currentSquare.rentL1   },
    { label:'Level 2', value: currentSquare.rentL2   },
    { label:'Level 3', value: currentSquare.rentL3   },
  ];
  return (
    <div style={PP.overlay}>
      <div style={PP.modal}>
        <div style={{ ...PP.header, background: colorHex }}>
          <div style={PP.colorTag}>{currentSquare.color?.toUpperCase()}</div>
          <div style={PP.propName}>{currentSquare.name}</div>
          <div style={PP.propPrice}>₹{currentSquare.buyPrice?.toLocaleString()}</div>
        </div>
        <div style={PP.body}>
          {isOwned ? (
            <div style={{ ...PP.statusBadge, background: isMine ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', border:`1px solid ${isMine ? '#22c55e' : '#ef4444'}` }}>
              <span style={{ color: isMine ? '#86efac' : '#fca5a5', fontWeight:700, fontSize:12 }}>
                {isMine ? '✅ You own this property' : `❌ Owned by ${owner?.username}`}
              </span>
              {!isMine && (
                <div style={{ color:'#fca5a5', fontSize:10, marginTop:3 }}>
                  Rent due: ₹{rentLevels[propInfo?.upgradeLevel || 0]?.value?.toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...PP.statusBadge, background:'rgba(59,130,246,0.15)', border:'1px solid #3b82f6' }}>
              <span style={{ color:'#93c5fd', fontWeight:700, fontSize:12 }}>🏠 Available to buy</span>
            </div>
          )}
          <div style={PP.section}>
            <div style={PP.sectionTitle}>RENT LEVELS</div>
            <div style={PP.rentGrid}>
              {rentLevels.map((r, i) => (
                <div key={i} style={{
                  ...PP.rentCell,
                  background: (propInfo?.upgradeLevel||0)===i ? 'rgba(212,160,23,0.2)' : 'rgba(255,255,255,0.04)',
                  border:     (propInfo?.upgradeLevel||0)===i ? '1px solid #d4a017'     : '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ color:'#8fb8d8', fontSize:9 }}>{r.label}</div>
                  <div style={{ color:'#fff', fontWeight:700, fontSize:12 }}>₹{r.value?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
          {groupInfo && (
            <div style={PP.section}>
              <div style={PP.sectionTitle}>
                <span style={{ color:colorHex }}>■</span> {currentSquare.color?.toUpperCase()} GROUP PROGRESS
              </div>
              <div style={PP.progressRow}>
                <div style={PP.progressBar}>
                  <div style={{ ...PP.progressFill, width:`${(groupInfo.owned/groupInfo.total)*100}%`, background:colorHex }} />
                </div>
                <div style={{ color:'#fff', fontSize:11, fontWeight:700, minWidth:40, textAlign:'right' }}>
                  {groupInfo.owned}/{groupInfo.total}
                </div>
              </div>
              {groupInfo.threshold && (
                <div style={{ color:'#8fb8d8', fontSize:9, marginTop:4 }}>
                  Own {groupInfo.threshold}+ to unlock double rent bonus
                </div>
              )}
              {!groupInfo.threshold && (
                <div style={{ color:'#8fb8d8', fontSize:9, marginTop:4 }}>
                  Complete the pair to unlock evolved rent
                </div>
              )}
            </div>
          )}
          {groupInfo && groupInfo.owned > 0 && (
            <div style={PP.section}>
              <div style={PP.sectionTitle}>YOUR {currentSquare.color?.toUpperCase()} PROPERTIES</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {getAllSquares()
                  .filter(sq => sq.color === currentSquare.color && myOwned.includes(sq.id))
                  .map(sq => (
                    <div key={sq.id} style={{ ...PP.propTag, background:colorHex+'33', border:`1px solid ${colorHex}` }}>
                      {sq.name}
                    </div>
                  ))}
              </div>
            </div>
          )}
          <div style={PP.balanceRow}>
            <span style={{ color:'#8fb8d8', fontSize:11 }}>Your balance</span>
            <span style={{ color: canAfford ? '#86efac' : '#fca5a5', fontWeight:700, fontSize:13 }}>
              ₹{(me?.balance || 0).toLocaleString()}
            </span>
          </div>
          {!isOwned && (
            <div style={PP.btnRow}>
              <button onClick={onBuy} disabled={!canAfford}
                style={{ ...PP.btnBuy, opacity: canAfford ? 1 : 0.4, cursor: canAfford ? 'pointer' : 'not-allowed' }}>
                🏠 Buy for ₹{currentSquare.buyPrice?.toLocaleString()}
              </button>
              <button onClick={onSkip} style={PP.btnSkip}>⏭ Skip</button>
            </div>
          )}
          {isOwned && isMine  && <button onClick={onSkip} style={{ ...PP.btnSkip, width:'100%', marginTop:8 }}>✓ Continue</button>}
          {isOwned && !isMine && <button onClick={onSkip} style={{ ...PP.btnSkip, width:'100%', marginTop:8 }}>✓ Pay & Continue</button>}
        </div>
      </div>
    </div>
  );
};

const PP = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)' },
  modal:       { background:'#0f2035', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, width:340, maxWidth:'95vw', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.6)' },
  header:      { padding:'20px 20px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:4 },
  colorTag:    { fontSize:9, fontWeight:800, letterSpacing:2, color:'rgba(255,255,255,0.7)', background:'rgba(0,0,0,0.25)', padding:'2px 8px', borderRadius:20 },
  propName:    { color:'#fff', fontWeight:800, fontSize:20, textAlign:'center', textShadow:'0 2px 8px rgba(0,0,0,0.4)' },
  propPrice:   { color:'rgba(255,255,255,0.85)', fontSize:14, fontWeight:600 },
  body:        { padding:'16px 20px 20px' },
  statusBadge: { borderRadius:8, padding:'8px 12px', marginBottom:12, textAlign:'center' },
  section:     { marginBottom:12 },
  sectionTitle:{ color:'#d4a017', fontSize:9, fontWeight:700, letterSpacing:1.5, marginBottom:6 },
  rentGrid:    { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:4 },
  rentCell:    { borderRadius:6, padding:'6px 4px', textAlign:'center' },
  progressRow: { display:'flex', alignItems:'center', gap:8 },
  progressBar: { flex:1, height:8, background:'rgba(255,255,255,0.08)', borderRadius:4, overflow:'hidden' },
  progressFill:{ height:'100%', borderRadius:4, transition:'width 0.4s ease' },
  propTag:     { fontSize:10, color:'#fff', padding:'3px 8px', borderRadius:12 },
  balanceRow:  { display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 12px', marginBottom:10 },
  btnRow:      { display:'flex', gap:8, marginTop:4 },
  btnBuy:      { flex:2, background:'#1e6b3c', color:'#fff', border:'none', borderRadius:10, padding:'11px', fontWeight:700, fontSize:13, cursor:'pointer' },
  btnSkip:     { flex:1, background:'rgba(255,255,255,0.08)', color:'#fff', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10, padding:'11px', fontWeight:600, fontSize:12, cursor:'pointer' },
};

// ── RentModal ─────────────────────────────────────────────────
const RentModal = ({ rentInfo, me, onDismiss }) => {
  if (!rentInfo) return null;
  const { ownerUsername, propertyName, propertyColor, rentAmount, newBalance, usedBlocker, usedDiscount } = rentInfo;
  const colorHex   = COLOR_MAP[propertyColor] || '#888';
  const isBlocked  = usedBlocker;
  const couldAfford = newBalance >= 0;

  return (
    <div style={RM.overlay}>
      <div style={RM.modal}>
        <div style={{ ...RM.header, background: isBlocked ? '#1e3a1e' : 'rgba(239,68,68,0.15)' }}>
          <div style={{ fontSize:32, marginBottom:4 }}>{isBlocked ? '🛡️' : '💸'}</div>
          <div style={{ color: isBlocked ? '#86efac' : '#fca5a5', fontWeight:800, fontSize:18 }}>
            {isBlocked ? 'Rent Blocked!' : 'Rent Paid!'}
          </div>
        </div>
        <div style={RM.body}>
          <div style={{ ...RM.propRow, borderLeft:`3px solid ${colorHex}` }}>
            <div style={{ color:'#8fb8d8', fontSize:10 }}>PROPERTY</div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:14 }}>{propertyName}</div>
            <div style={{ color: colorHex, fontSize:10, textTransform:'capitalize' }}>{propertyColor}</div>
          </div>
          <div style={RM.infoRow}>
            <span style={{ color:'#8fb8d8', fontSize:12 }}>Owner</span>
            <span style={{ color:'#fde68a', fontWeight:700, fontSize:12 }}>{ownerUsername}</span>
          </div>
          <div style={RM.infoRow}>
            <span style={{ color:'#8fb8d8', fontSize:12 }}>Rent charged</span>
            <span style={{ color: isBlocked ? '#86efac' : '#fca5a5', fontWeight:700, fontSize:16 }}>
              {isBlocked ? '₹0 (Blocked!)' : `₹${rentAmount?.toLocaleString()}`}
            </span>
          </div>
          {usedDiscount && !isBlocked && (
            <div style={RM.discountBadge}>🎟️ 50% Discount Pay card used — saved ₹{rentAmount?.toLocaleString()}</div>
          )}
          {isBlocked && (
            <div style={RM.blockerBadge}>🛡️ Your Blocker card matched the dice roll — rent completely waived!</div>
          )}
          <div style={{ ...RM.balanceRow, borderColor: couldAfford ? 'rgba(134,239,172,0.3)' : 'rgba(252,165,165,0.3)' }}>
            <span style={{ color:'#8fb8d8', fontSize:11 }}>Your new balance</span>
            <span style={{ color: couldAfford ? '#86efac' : '#fca5a5', fontWeight:800, fontSize:15 }}>
              ₹{newBalance?.toLocaleString()}
            </span>
          </div>
          <button onClick={onDismiss} style={RM.btn}>✓ OK</button>
        </div>
      </div>
    </div>
  );
};

const RM = {
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1001, backdropFilter:'blur(4px)' },
  modal:        { background:'#0f2035', border:'1px solid rgba(255,255,255,0.12)', borderRadius:16, width:320, maxWidth:'95vw', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.6)' },
  header:       { padding:'24px 20px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:4, borderBottom:'1px solid rgba(255,255,255,0.08)' },
  body:         { padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:10 },
  propRow:      { background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'10px 12px', paddingLeft:12 },
  infoRow:      { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' },
  discountBadge:{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:8, padding:'8px 12px', color:'#6ee7b7', fontSize:11, textAlign:'center' },
  blockerBadge: { background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.3)', borderRadius:8, padding:'8px 12px', color:'#93c5fd', fontSize:11, textAlign:'center' },
  balanceRow:   { display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'10px 12px', border:'1px solid' },
  btn:          { width:'100%', background:'#1a3c5e', color:'#fff', border:'1px solid rgba(255,255,255,0.2)', borderRadius:10, padding:'11px', fontWeight:700, fontSize:13, cursor:'pointer', marginTop:4 },
};

// ── EventCardModal ────────────────────────────────────────────
// Shown to the player who just drew a Chance / Republic / Upgrader card.
// For color_l1 and level2_any upgrader cards: renders a property selector
// so the player can immediately pick which property to upgrade.
//
// cardEvent shape:
//   type: 'chance_card' | 'republic_card' | 'upgrader_card_received' | 'upgrader_no_supply'
//   card: { text, effectType, amount?, cardId?, color? }
//   diceTotal: number
//   playerId: string

const CARD_THEMES = {
  chance_card: {
    accent:    '#f59e0b',
    accentDim: 'rgba(245,158,11,0.15)',
    border:    'rgba(245,158,11,0.35)',
    icon:      '?',
    iconBg:    'rgba(245,158,11,0.18)',
    label:     'CHANCE CARD',
  },
  republic_card: {
    accent:    '#3b82f6',
    accentDim: 'rgba(59,130,246,0.15)',
    border:    'rgba(59,130,246,0.35)',
    icon:      'R',
    iconBg:    'rgba(59,130,246,0.18)',
    label:     'REPUBLIC CARD',
  },
  upgrader_card_received: {
    accent:    '#a855f7',
    accentDim: 'rgba(168,85,247,0.15)',
    border:    'rgba(168,85,247,0.35)',
    icon:      '↑',
    iconBg:    'rgba(168,85,247,0.18)',
    label:     'UPGRADER CARD',
  },
  upgrader_no_supply: {
    accent:    '#6b7280',
    accentDim: 'rgba(107,114,128,0.15)',
    border:    'rgba(107,114,128,0.3)',
    icon:      '✕',
    iconBg:    'rgba(107,114,128,0.18)',
    label:     'UPGRADER',
  },
};

const getEffectDescription = (card, type) => {
  if (!card) return null;
  if (type === 'upgrader_no_supply') return { tag: '😔 No cards left', desc: 'The bank has run out of this card type. Better luck next time!' };

  const { effectType, amount, color, cardId } = card;
  switch (effectType) {
    case 'money_gain':    return { tag: '💰 Cash Bonus',      desc: `You receive ₹${amount?.toLocaleString()} from the bank!` };
    case 'money_loss':    return { tag: '💸 Cash Penalty',    desc: `You pay ₹${amount?.toLocaleString()} to the bank.` };
    case 'go_to_jail':    return { tag: '⚖️ Go to Jail',      desc: 'You are sent to Jail! Pay ₹500 or skip your next turn.' };
    case 'move_to_start': return { tag: '🔄 Back to Start',   desc: 'Your token is moved back to the GO square.' };
    case 'discount_pay':  return { tag: '🎟️ Discount Pay',    desc: 'Added to your hand. Use this to pay only 50% rent once!' };
    case 'discount_buy':  return { tag: '🏷️ Discount Buy',    desc: 'Added to your hand. Use this to buy any property at 50% off!' };
    case 'blocker':       return { tag: '🛡️ Blocker Card',    desc: 'Added to your hand. Declare a number before rolling — if it matches, your rent is waived!' };
    case 'level2_any':    return { tag: '⬆️ Level 2 Upgrade', desc: 'Select one of your Level 1 properties below to upgrade it to Level 2 instantly!' };
    case 'color_l1':      return { tag: `🎨 ${color?.toUpperCase()} Level 1`, desc: `Select one of your base-level ${color} properties below to upgrade it to Level 1 instantly!` };
    default:              return { tag: '🃏 Card Drawn',       desc: card.text || 'Effect applied.' };
  }
};

const isHeldCard = (card) => {
  if (!card) return false;
  const held = ['discount_pay', 'discount_buy', 'blocker', 'level2_any', 'color_l1'];
  return held.includes(card.effectType) || held.includes(card.cardId);
};

// Cards that require choosing a target property immediately
const isPropertySelectorCard = (card) => {
  if (!card) return false;
  return card.effectType === 'color_l1' || card.effectType === 'level2_any';
};

const EventCardModal = ({ cardEvent, me, gameState, onDismiss, onUseCard }) => {
  const [selectedPropId, setSelectedPropId] = useState(null);

  if (!cardEvent) return null;

  const theme    = CARD_THEMES[cardEvent.type] || CARD_THEMES.chance_card;
  const card     = cardEvent.card;
  const effect   = getEffectDescription(card, cardEvent.type);
  const held     = isHeldCard(card);
  const noSupply = cardEvent.type === 'upgrader_no_supply';
  const needsSelector = isPropertySelectorCard(card);

  // ── Build the eligible property list for selector ──
  const eligibleProperties = (() => {
    if (!needsSelector || !me || !gameState) return [];
    const allSq = getAllSquares();

    if (card.effectType === 'color_l1') {
      // Must be: owned by me, color matches card, currently at Level 0, not pink/pinkBrown
      return allSq.filter(sq => {
        if (sq.type !== 'property') return false;
        if (sq.color !== card.color) return false;
        if (!me.ownedProperties.includes(sq.id)) return false;
        const prop = gameState.properties?.[sq.id];
        return prop && prop.upgradeLevel === 0;
      });
    }

    if (card.effectType === 'level2_any') {
      // Must be: owned by me, currently at Level 1, not pink/pinkBrown
      return allSq.filter(sq => {
        if (sq.type !== 'property') return false;
        if (sq.color === 'pink' || sq.color === 'pinkBrown') return false;
        if (!me.ownedProperties.includes(sq.id)) return false;
        const prop = gameState.properties?.[sq.id];
        return prop && prop.upgradeLevel === 1;
      });
    }

    return [];
  })();

  const handleUseCard = () => {
    if (!selectedPropId) return;
    onUseCard(card.effectType, selectedPropId);
    onDismiss();
  };

  return (
    <div style={EC.overlay}>
      <div style={{ ...EC.modal, borderColor: theme.border }}>

        {/* ── Header strip ── */}
        <div style={{ ...EC.header, background: theme.accentDim, borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ ...EC.typeBadge, background: theme.iconBg, border: `1px solid ${theme.border}`, color: theme.accent }}>
            {theme.label}
          </div>
          <div style={{ ...EC.bigIcon, background: theme.iconBg, border: `2px solid ${theme.accent}`, color: theme.accent }}>
            {theme.icon}
          </div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, marginTop:2 }}>
            Dice roll: <span style={{ color: theme.accent, fontWeight:700 }}>{cardEvent.diceTotal}</span>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={EC.body}>

          {/* Card text */}
          {card?.text && !noSupply && (
            <div style={{ ...EC.cardTextBox, borderLeft: `3px solid ${theme.accent}` }}>
              <div style={{ color:'#8fb8d8', fontSize:9, letterSpacing:1, marginBottom:4 }}>CARD TEXT</div>
              <div style={{ color:'#fff', fontSize:13, fontWeight:600, lineHeight:1.5 }}>{card.text}</div>
            </div>
          )}

          {/* Effect summary */}
          {effect && (
            <div style={{ ...EC.effectBox, background: theme.accentDim, border: `1px solid ${theme.border}` }}>
              <div style={{ color: theme.accent, fontWeight:800, fontSize:13, marginBottom:4 }}>
                {effect.tag}
              </div>
              <div style={{ color:'#cbd5e1', fontSize:11, lineHeight:1.5 }}>
                {effect.desc}
              </div>
            </div>
          )}

          {/* ── Property Selector for color_l1 / level2_any ── */}
          {needsSelector && (
            <div>
              <div style={{ color:'#d4a017', fontSize:9, fontWeight:700, letterSpacing:1.5, marginBottom:8 }}>
                SELECT PROPERTY TO UPGRADE
              </div>

              {eligibleProperties.length === 0 ? (
                <div style={{
                  background:'rgba(107,114,128,0.12)', border:'1px solid rgba(107,114,128,0.3)',
                  borderRadius:8, padding:'12px', textAlign:'center',
                }}>
                  <div style={{ color:'#9ca3af', fontSize:12, fontWeight:600 }}>No eligible properties</div>
                  <div style={{ color:'#6b7280', fontSize:10, marginTop:4 }}>
                    {card.effectType === 'color_l1'
                      ? `You have no base-level ${card.color} properties to upgrade.`
                      : 'You have no Level 1 properties to upgrade.'}
                  </div>
                  <div style={{ color:'#8fb8d8', fontSize:10, marginTop:6 }}>
                    Card has been added to your hand — use it later.
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:180, overflowY:'auto' }}>
                  {eligibleProperties.map(sq => {
                    const colorHex = COLOR_MAP[sq.color] || '#888';
                    const prop     = gameState.properties?.[sq.id];
                    const isSelected = selectedPropId === sq.id;
                    return (
                      <div
                        key={sq.id}
                        onClick={() => setSelectedPropId(sq.id)}
                        style={{
                          display:'flex', alignItems:'center', gap:10,
                          background: isSelected ? `${colorHex}22` : 'rgba(255,255,255,0.04)',
                          border: `1.5px solid ${isSelected ? colorHex : 'rgba(255,255,255,0.1)'}`,
                          borderRadius:8, padding:'8px 12px', cursor:'pointer',
                          transition:'all 0.15s ease',
                        }}
                      >
                        <div style={{
                          width:10, height:10, borderRadius:2, background:colorHex, flexShrink:0,
                        }} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{
                            color:'#fff', fontWeight:600, fontSize:12,
                            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                          }}>{sq.name}</div>
                          <div style={{ color:'#8fb8d8', fontSize:9, marginTop:1 }}>
                            Level {prop?.upgradeLevel ?? 0} →&nbsp;
                            <span style={{ color: colorHex, fontWeight:700 }}>
                              Level {(prop?.upgradeLevel ?? 0) + 1}
                            </span>
                            &nbsp;· New rent: ₹{
                              prop?.upgradeLevel === 0
                                ? sq.rentL1?.toLocaleString()
                                : sq.rentL2?.toLocaleString()
                            }
                          </div>
                        </div>
                        {isSelected && (
                          <div style={{ color: colorHex, fontSize:14, fontWeight:800 }}>✓</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Confirm upgrade button */}
              {eligibleProperties.length > 0 && (
                <button
                  onClick={handleUseCard}
                  disabled={!selectedPropId}
                  style={{
                    ...EC.btn,
                    marginTop:10,
                    background: selectedPropId ? theme.accentDim : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedPropId ? theme.border : 'rgba(255,255,255,0.1)'}`,
                    color: selectedPropId ? theme.accent : '#6b7280',
                    cursor: selectedPropId ? 'pointer' : 'not-allowed',
                    opacity: selectedPropId ? 1 : 0.6,
                  }}
                >
                  ⬆ Upgrade Selected Property
                </button>
              )}

              {/* Skip / save for later */}
              <button
                onClick={onDismiss}
                style={{
                  ...EC.btn,
                  marginTop: eligibleProperties.length > 0 ? 6 : 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#8fb8d8',
                  cursor: 'pointer',
                }}
              >
                🃏 Save to hand — use later
              </button>
            </div>
          )}

          {/* Non-selector cards: "Card added to hand" notice */}
          {held && !noSupply && !needsSelector && (
            <div style={EC.handNotice}>
              <span style={{ fontSize:14 }}>🃏</span>
              <span style={{ color:'#fde68a', fontSize:11, fontWeight:600 }}>
                Card added to your hand — use it anytime from the action menu.
              </span>
            </div>
          )}

          {/* No-supply notice */}
          {noSupply && (
            <div style={{ ...EC.effectBox, background:'rgba(107,114,128,0.1)', border:'1px solid rgba(107,114,128,0.3)' }}>
              <div style={{ color:'#9ca3af', fontWeight:700, fontSize:12 }}>Bank Supply: 0</div>
              <div style={{ color:'#6b7280', fontSize:11, marginTop:3 }}>
                No {cardEvent.cardId} cards remain in the bank. No card awarded this turn.
              </div>
            </div>
          )}

          {/* Balance — only for money events */}
          {(card?.effectType === 'money_gain' || card?.effectType === 'money_loss') && me && (
            <div style={EC.balanceRow}>
              <span style={{ color:'#8fb8d8', fontSize:11 }}>Your balance</span>
              <span style={{ color:'#86efac', fontWeight:800, fontSize:14 }}>
                ₹{(me?.balance || 0).toLocaleString()}
              </span>
            </div>
          )}

          {/* Default dismiss — only shown for non-selector cards */}
          {!needsSelector && (
            <button
              onClick={onDismiss}
              style={{ ...EC.btn, background: theme.accentDim, border: `1px solid ${theme.border}`, color: theme.accent }}
            >
              ✓ Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const EC = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1003, backdropFilter:'blur(4px)' },
  modal:       { background:'#0f2035', border:'1px solid', borderRadius:16, width:340, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.7)' },
  header:      { padding:'20px 20px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:8 },
  typeBadge:   { fontSize:9, fontWeight:800, letterSpacing:2, padding:'3px 10px', borderRadius:20 },
  bigIcon:     { width:52, height:52, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900 },
  body:        { padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:10 },
  cardTextBox: { background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'10px 12px' },
  effectBox:   { borderRadius:10, padding:'12px 14px' },
  handNotice:  { display:'flex', alignItems:'center', gap:8, background:'rgba(253,230,138,0.08)', border:'1px solid rgba(253,230,138,0.2)', borderRadius:8, padding:'8px 12px' },
  balanceRow:  { display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'10px 12px', border:'1px solid rgba(134,239,172,0.2)' },
  btn:         { width:'100%', borderRadius:10, padding:'11px', fontWeight:700, fontSize:13, cursor:'pointer', marginTop:4 },
};


// ════════════════════════════════════════════════════════════
// ── BorrowModal ───────────────────────────────────────────────
// Shows when lastEvent.type is 'insufficient_funds_rent' or
// 'insufficient_funds_fine'. The game would break without this —
// the player is stuck in 'action' phase with a pendingPayment
// they can't pay and no UI to borrow.
//
// borrowContext shape (built from lastEvent in Game component):
//   type: 'rent' | 'fine'
//   amountDue: number
//   ownerName: string | null
//   propertyName: string | null
//   currentBalance: number
// ════════════════════════════════════════════════════════════

const BORROW_UNIT = 10000;

const BorrowModal = ({ borrowContext, me, onBorrow, onEliminate }) => {
  const [borrowAmount, setBorrowAmount] = useState(BORROW_UNIT);

  if (!borrowContext) return null;

  const { type, amountDue, ownerName, propertyName, currentBalance } = borrowContext;
  const isRent      = type === 'rent';
  const shortfall   = Math.max(0, amountDue - (me?.balance ?? currentBalance ?? 0));
  // Minimum borrow: enough multiples of 10k to cover the shortfall
  const minBorrow   = Math.ceil(shortfall / BORROW_UNIT) * BORROW_UNIT || BORROW_UNIT;
  const balanceAfterBorrow = (me?.balance ?? 0) + borrowAmount;
  const canPayAfterBorrow  = balanceAfterBorrow >= amountDue;

  const increment = () => setBorrowAmount(prev => prev + BORROW_UNIT);
  const decrement = () => setBorrowAmount(prev => Math.max(minBorrow, prev - BORROW_UNIT));

  return (
    <div style={BM.overlay}>
      <div style={BM.modal}>

        {/* ── Header ── */}
        <div style={BM.header}>
          <div style={{ fontSize:36, marginBottom:4 }}>🏦</div>
          <div style={{ color:'#fca5a5', fontWeight:800, fontSize:18 }}>
            Insufficient Funds
          </div>
          <div style={{ color:'#8fb8d8', fontSize:11, marginTop:4, textAlign:'center', lineHeight:1.5 }}>
            {isRent
              ? `You owe rent on ${propertyName} to ${ownerName}. Borrow from the bank to pay.`
              : `You must pay the ₹500 fine. Borrow from the bank to cover it.`}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={BM.body}>

          {/* What you owe */}
          <div style={BM.infoGrid}>
            <div style={BM.infoCell}>
              <div style={{ color:'#8fb8d8', fontSize:9, letterSpacing:1 }}>
                {isRent ? 'RENT DUE' : 'FINE AMOUNT'}
              </div>
              <div style={{ color:'#fca5a5', fontWeight:800, fontSize:16 }}>
                ₹{amountDue?.toLocaleString()}
              </div>
            </div>
            <div style={BM.infoCell}>
              <div style={{ color:'#8fb8d8', fontSize:9, letterSpacing:1 }}>YOUR BALANCE</div>
              <div style={{ color:'#fca5a5', fontWeight:800, fontSize:16 }}>
                ₹{(me?.balance ?? currentBalance ?? 0).toLocaleString()}
              </div>
            </div>
            <div style={BM.infoCell}>
              <div style={{ color:'#8fb8d8', fontSize:9, letterSpacing:1 }}>SHORTFALL</div>
              <div style={{ color:'#f97316', fontWeight:800, fontSize:16 }}>
                ₹{shortfall.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Borrow rule reminder */}
          <div style={BM.ruleBadge}>
            <span style={{ fontSize:12 }}>💡</span>
            <span style={{ color:'#fde68a', fontSize:10, lineHeight:1.5 }}>
              When you borrow, <strong>ALL active players</strong> receive the same amount from the bank.
              Borrowed money does not need to be repaid.
            </span>
          </div>

          {/* Amount selector */}
          <div>
            <div style={{ color:'#d4a017', fontSize:9, fontWeight:700, letterSpacing:1.5, marginBottom:8 }}>
              BORROW AMOUNT (multiples of ₹10,000)
            </div>
            <div style={BM.selectorRow}>
              <button
                onClick={decrement}
                disabled={borrowAmount <= minBorrow}
                style={{
                  ...BM.arrowBtn,
                  opacity: borrowAmount <= minBorrow ? 0.35 : 1,
                  cursor: borrowAmount <= minBorrow ? 'not-allowed' : 'pointer',
                }}
              >−</button>

              <div style={BM.amountDisplay}>
                <div style={{ color:'#fff', fontWeight:800, fontSize:20 }}>
                  ₹{borrowAmount.toLocaleString()}
                </div>
                <div style={{ color: canPayAfterBorrow ? '#86efac' : '#fca5a5', fontSize:9, marginTop:2 }}>
                  {canPayAfterBorrow ? '✓ Enough to pay' : '✗ Still not enough'}
                </div>
              </div>

              <button onClick={increment} style={{ ...BM.arrowBtn, cursor:'pointer' }}>+</button>
            </div>
          </div>

          {/* Balance preview */}
          <div style={BM.previewBox}>
            <div style={BM.previewRow}>
              <span style={{ color:'#8fb8d8', fontSize:11 }}>Your balance after borrow</span>
              <span style={{ color:'#86efac', fontWeight:700, fontSize:13 }}>
                ₹{balanceAfterBorrow.toLocaleString()}
              </span>
            </div>
            <div style={BM.previewRow}>
              <span style={{ color:'#8fb8d8', fontSize:11 }}>
                {isRent ? 'Rent' : 'Fine'} after payment
              </span>
              <span style={{ color: canPayAfterBorrow ? '#86efac' : '#fca5a5', fontWeight:700, fontSize:13 }}>
                ₹{Math.max(0, balanceAfterBorrow - amountDue).toLocaleString()} remaining
              </span>
            </div>
          </div>

          {/* Borrow button */}
          <button
            onClick={() => onBorrow(borrowAmount)}
            style={{
              ...BM.btnBorrow,
              opacity: 1,
              cursor: 'pointer',
            }}
          >
            🏦 Borrow ₹{borrowAmount.toLocaleString()} & Pay {isRent ? 'Rent' : 'Fine'}
          </button>

          {/* Refuse / Eliminate */}
          <button
            onClick={onEliminate}
            style={BM.btnEliminate}
          >
            ☠ Refuse & Surrender
          </button>
          <div style={{ color:'#6b7280', fontSize:9, textAlign:'center', marginTop:2 }}>
            Refusing will eliminate you from the game. All your properties return to the bank.
          </div>
        </div>
      </div>
    </div>
  );
};

const BM = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1005, backdropFilter:'blur(4px)' },
  modal:       { background:'#0f2035', border:'1px solid rgba(239,68,68,0.3)', borderRadius:16, width:340, maxWidth:'95vw', maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.7)' },
  header:      { padding:'24px 20px 16px', display:'flex', flexDirection:'column', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(239,68,68,0.07)' },
  body:        { padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:12 },
  infoGrid:    { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 },
  infoCell:    { background:'rgba(255,255,255,0.05)', borderRadius:8, padding:'8px 6px', textAlign:'center' },
  ruleBadge:   { display:'flex', alignItems:'flex-start', gap:8, background:'rgba(253,230,138,0.07)', border:'1px solid rgba(253,230,138,0.2)', borderRadius:8, padding:'10px 12px' },
  selectorRow: { display:'flex', alignItems:'center', gap:10 },
  arrowBtn:    { width:40, height:40, borderRadius:10, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:20, fontWeight:700, cursor:'pointer', flexShrink:0 },
  amountDisplay:{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10, padding:'10px', textAlign:'center' },
  previewBox:  { background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 },
  previewRow:  { display:'flex', justifyContent:'space-between', alignItems:'center' },
  btnBorrow:   { width:'100%', background:'#1e6b3c', color:'#fff', border:'none', borderRadius:10, padding:'12px', fontWeight:700, fontSize:13 },
  btnEliminate:{ width:'100%', background:'rgba(239,68,68,0.1)', color:'#fca5a5', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'10px', fontWeight:600, fontSize:12, cursor:'pointer', marginTop:2 },
};


// ════════════════════════════════════════════════════════════
//  Game Component
// ════════════════════════════════════════════════════════════

const safeParse = (raw) => {
  try {
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

const Game = () => {
  const { roomCode } = useParams();
  const { state }    = useLocation();
  const navigate     = useNavigate();

  const savedRoom      = sessionStorage.getItem('monopoly_room');
  const savedPlayerRaw = sessionStorage.getItem('monopoly_player');
  const savedPlayer    = safeParse(savedPlayerRaw);
  const myUsername     = savedPlayer?.username || '';

  const getInitialState = () => {
    if (state?.gameState) return state.gameState;
    return safeParse(sessionStorage.getItem('monopoly_gamestate'));
  };

  const [gameState,     setGameState]     = useState(getInitialState);
  const [selected,      setSelected]      = useState(null);
  const [log,           setLog]           = useState([]);
  const [status,        setStatus]        = useState(gameState ? 'playing' : 'reconnecting');
  const [showPropPopup, setShowPropPopup] = useState(false);
  const [currentSquare, setCurrentSquare] = useState(null);
  const [rentInfo,      setRentInfo]      = useState(null);
  const [cardEvent,     setCardEvent]     = useState(null);
  // ── NEW: borrow context — set when server signals insufficient funds ──
  const [borrowContext, setBorrowContext] = useState(null);

  const logRef      = useRef(null);
  const rejoinedRef = useRef(false);

  const doRejoin = useCallback(() => {
    if (rejoinedRef.current) return;
    if (!savedRoom || !myUsername) return;
    rejoinedRef.current = true;
    socket.emit('rejoin_game', { roomCode: savedRoom, username: myUsername });
  }, [savedRoom, myUsername]);

  useEffect(() => {
    if (socket.connected) {
      if (!gameState) doRejoin();
    } else {
      socket.connect();
      socket.once('connect', () => { if (!gameState) doRejoin(); });
    }

    const onGameStarted = ({ gameState: gs }) => {
      if (gs) sessionStorage.setItem('monopoly_gamestate', JSON.stringify(gs));
      setGameState(gs);
      setStatus('playing');
    };

    const onStateUpdated = ({ gameState: gs }) => {
      if (gs) sessionStorage.setItem('monopoly_gamestate', JSON.stringify(gs));
      setGameState(gs);
      setStatus('playing');
      if (gs.lastEvent?.message) setLog(p => [...p.slice(-49), gs.lastEvent.message]);

      const me = gs.players?.find(p => p.username === myUsername);

      // ── Rent Modal ──
      if (gs.lastEvent?.type === 'rent_paid' && gs.lastEvent?.payerId === me?.id) {
        setRentInfo({
          ownerUsername: gs.lastEvent.ownerUsername,
          propertyName:  gs.lastEvent.propertyName,
          propertyColor: gs.lastEvent.propertyColor,
          rentAmount:    gs.lastEvent.rentAmount,
          newBalance:    me?.balance,
          usedBlocker:   gs.lastEvent.usedBlocker  || false,
          usedDiscount:  gs.lastEvent.usedDiscount  || false,
        });
        setShowPropPopup(false);
        setBorrowContext(null);
        return;
      }

      // ── Borrow Modal: triggered when player can't afford rent or fine ──
      if (
        (gs.lastEvent?.type === 'insufficient_funds_rent' ||
         gs.lastEvent?.type === 'insufficient_funds_fine') &&
        gs.lastEvent?.payerId === me?.id
      ) {
        const evt = gs.lastEvent;
        setBorrowContext({
          type:           evt.type === 'insufficient_funds_rent' ? 'rent' : 'fine',
          amountDue:      evt.rentDue ?? evt.fineAmount ?? 0,
          ownerName:      evt.ownerName ?? null,
          propertyName:   evt.propertyName ?? null,
          currentBalance: me?.balance ?? 0,
        });
        setShowPropPopup(false);
        setCardEvent(null);
        return;
      }

      // Clear borrow modal once the payment has been resolved
      if (
        gs.lastEvent?.type === 'bank_borrow' ||
        gs.lastEvent?.type === 'fine_paid' ||
        gs.lastEvent?.type === 'rent_paid'
      ) {
        setBorrowContext(null);
      }

      // ── Event Card Modal — shown only to the player who drew the card ──
      const cardTypes = ['chance_card', 'republic_card', 'upgrader_card_received', 'upgrader_no_supply'];
      if (cardTypes.includes(gs.lastEvent?.type) && gs.lastEvent?.playerId === me?.id) {
        setCardEvent({
          type:      gs.lastEvent.type,
          card:      gs.lastEvent.card   || null,
          cardId:    gs.lastEvent.cardId || null,
          diceTotal: gs.lastEvent.diceTotal,
          playerId:  gs.lastEvent.playerId,
        });
        setShowPropPopup(false);
        return;
      }

      // ── Buy/Skip popup on action phase ──
      if (gs.currentPhase === 'action') {
        const allSquares = getAllSquares();
        if (me) {
          const sq = allSquares.find(
            s => s.ring === me.ring && s.sequenceIndex === me.positionIndex
          );
          const currentTurnId = gs.turnOrder?.[gs.currentPlayerIndex];
          if (sq && sq.type === 'property' && currentTurnId === me?.id) {
            setCurrentSquare(sq);
            setShowPropPopup(true);
          }
        }
      } else {
        setShowPropPopup(false);
      }
    };

    const onGameOver = ({ winnerId }) => {
      const gs = gameState;
      const winner = gs?.players?.find(p => p.id === winnerId);
      alert('🏆 Game over! Winner: ' + (winner?.username || winnerId));
      sessionStorage.removeItem('monopoly_room');
      sessionStorage.removeItem('monopoly_player');
      sessionStorage.removeItem('monopoly_gamestate');
      navigate('/dashboard');
    };

    const onPlayerLeft = ({ message }) => setLog(p => [...p.slice(-49), message]);

    const onError = ({ message }) => {
      if (message === 'Room no longer exists.' || message === 'Player not found in this room.') {
        sessionStorage.removeItem('monopoly_room');
        sessionStorage.removeItem('monopoly_player');
        sessionStorage.removeItem('monopoly_gamestate');
        navigate('/dashboard');
      }
    };

    const onReconnect = () => { rejoinedRef.current = false; doRejoin(); };

    socket.on('game_started',  onGameStarted);
    socket.on('state_updated', onStateUpdated);
    socket.on('game_over',     onGameOver);
    socket.on('player_left',   onPlayerLeft);
    socket.on('error',         onError);
    socket.io.on('reconnect',  onReconnect);

    return () => {
      socket.off('game_started',  onGameStarted);
      socket.off('state_updated', onStateUpdated);
      socket.off('game_over',     onGameOver);
      socket.off('player_left',   onPlayerLeft);
      socket.off('error',         onError);
      socket.io.off('reconnect',  onReconnect);
    };
  }, [navigate, doRejoin, gameState, myUsername]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  if (status === 'reconnecting') {
    return (
      <div style={S.loading}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'2rem', marginBottom:16 }}>🔄</div>
          <div>Reconnecting to game...</div>
          <div style={{ fontSize:'0.85rem', color:'#8fb8d8', marginTop:8 }}>Please wait</div>
        </div>
      </div>
    );
  }

  if (!gameState) return <div style={S.loading}>Loading game...</div>;

  const {
    players = [], currentPlayerIndex = 0,
    currentPhase = 'roll', lastDiceRoll, turnOrder = [],
  } = gameState;

  const currentPlayerId = turnOrder[currentPlayerIndex];
  const currentPlayer   = players.find(p => p.id === currentPlayerId);
  const me              = players.find(p => p.username === myUsername);
  const myId            = me?.id || '';
  const isMyTurn        = currentPlayerId === myId;

  const outer  = outerRing.map(sq => ({ ...sq, ring:'outer' }));
  const inner  = innerRing.map(sq => ({ ...sq, ring:'inner' }));
  const top    = outer.slice(0, 16);
  const right  = outer.slice(16, 31);
  const bottom = [...outer.slice(31, 47)].reverse();
  const left   = [...outer.slice(47, 62)].reverse();

  const sqProps = { players, onClick: setSelected };
  const emit    = (action, extra = {}) =>
    socket.emit('player_action', { roomCode, action, ...extra });

  const handleBuy  = () => { emit('buy_property'); setShowPropPopup(false); };
  const handleSkip = () => { emit('skip_buying');  setShowPropPopup(false); };

  // ── Handlers for new modals ──
  const handleBorrow = (amount) => {
    emit('borrow_from_bank', { amount });
    // Don't close borrowContext manually — wait for state_updated
    // to confirm the payment went through (rent_paid / fine_paid)
  };

  const handleEliminate = () => {
    emit('refuse_borrow');
    setBorrowContext(null);
  };

  // Called when player confirms a property upgrade from EventCardModal
  const handleUseCard = (effectType, targetSquareId) => {
    if (effectType === 'color_l1') {
      emit('use_card', { cardType: 'color_l1', targetSquareId });
    } else if (effectType === 'level2_any') {
      emit('use_card', { cardType: 'level2_any', targetSquareId });
    }
  };

  return (
    <div style={S.root}>

      {/* ── Borrow Modal — highest priority, blocks all other interaction ── */}
      {borrowContext && isMyTurn && (
        <BorrowModal
          borrowContext={borrowContext}
          me={me}
          onBorrow={handleBorrow}
          onEliminate={handleEliminate}
        />
      )}

      {/* ── Rent Modal ── */}
      {!borrowContext && rentInfo && (
        <RentModal rentInfo={rentInfo} me={me} onDismiss={() => setRentInfo(null)} />
      )}

      {/* ── Event Card Modal ── */}
      {!borrowContext && cardEvent && (
        <EventCardModal
          cardEvent={cardEvent}
          me={me}
          gameState={gameState}
          onDismiss={() => setCardEvent(null)}
          onUseCard={handleUseCard}
        />
      )}

      {/* ── Jail Modal ── */}
      {(() => {
        const isMyJailTurn =
          (gameState?.currentPhase === 'jail_decision' || gameState?.currentPhase === 'roll') &&
          isMyTurn &&
          me?.isJailed;

        const justJailed =
          gameState?.lastEvent?.type === 'sent_to_jail' &&
          gameState?.lastEvent?.playerId === me?.id;

        if (!isMyJailTurn && !justJailed) return null;
        if (borrowContext) return null; // borrow takes priority

        return (
          <div style={JM.overlay}>
            <div style={JM.modal}>
              <div style={JM.header}>
                <div style={{ fontSize: 40, marginBottom: 6 }}>⚖️</div>
                <div style={{ color: '#fca5a5', fontWeight: 800, fontSize: 20 }}>
                  {justJailed && !isMyJailTurn ? 'Sent to Jail!' : 'You Are in Jail'}
                </div>
                <div style={{ color: '#8fb8d8', fontSize: 12, marginTop: 4, textAlign: 'center', lineHeight: 1.5 }}>
                  {justJailed && !isMyJailTurn
                    ? 'You landed on the Jail square. On your next turn, pay ₹500 to roll or skip.'
                    : 'Choose an option to continue your turn.'}
                </div>
              </div>
              <div style={JM.body}>
                <div style={JM.balanceRow}>
                  <span style={{ color: '#8fb8d8', fontSize: 11 }}>Your balance</span>
                  <span style={{
                    color: (me?.balance || 0) >= 500 ? '#86efac' : '#fca5a5',
                    fontWeight: 800, fontSize: 14,
                  }}>
                    ₹{(me?.balance || 0).toLocaleString()}
                  </span>
                </div>
                {isMyJailTurn && (
                  <>
                    <div style={{
                      ...JM.optionBox,
                      borderColor: (me?.balance || 0) >= 500 ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)',
                      background:  (me?.balance || 0) >= 500 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>💸 Pay ₹500 Fine</div>
                        <div style={{ color: '#8fb8d8', fontSize: 11, marginTop: 3 }}>Pay the fine and roll the dice this turn</div>
                        {(me?.balance || 0) < 500 && (
                          <div style={{ color: '#fca5a5', fontSize: 10, marginTop: 3 }}>⚠ Not enough balance — borrow from bank first</div>
                        )}
                      </div>
                      <button
                        onClick={() => emit('pay_jail_fine')}
                        disabled={(me?.balance || 0) < 500}
                        style={{
                          ...JM.btn,
                          background: (me?.balance || 0) >= 500 ? '#1e6b3c' : '#374151',
                          color:      (me?.balance || 0) >= 500 ? '#fff'    : '#6b7280',
                          cursor:     (me?.balance || 0) >= 500 ? 'pointer'  : 'not-allowed',
                        }}
                      >Pay & Roll</button>
                    </div>
                    <div style={{ ...JM.optionBox, borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>⏭ Skip This Turn</div>
                        <div style={{ color: '#8fb8d8', fontSize: 11, marginTop: 3 }}>Skip your turn — you'll be freed automatically after 1 skip</div>
                      </div>
                      <button onClick={() => emit('skip_jail_turn')} style={{ ...JM.btn, background: 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                        Skip
                      </button>
                    </div>
                  </>
                )}
                {justJailed && !isMyJailTurn && (
                  <button
                    onClick={() => {
                      setGameState(gs => ({ ...gs, lastEvent: { ...gs.lastEvent, type: 'jail_noted' } }));
                    }}
                    style={{ ...JM.btn, width: '100%', background: '#7f1d1d', padding: '12px', fontSize: 13 }}
                  >✓ Understood</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Property Popup (Buy/Skip) ── */}
      {!borrowContext && showPropPopup && isMyTurn && currentPhase === 'action' && (
        <PropertyPopup
          gameState={gameState}
          me={me}
          currentSquare={currentSquare}
          onBuy={handleBuy}
          onSkip={handleSkip}
        />
      )}

      {/* ── Board ── */}
      <div style={S.boardWrap}>
        <div style={S.outerWrap}>
          <div style={S.topRow}>
            {top.map(sq => <Square key={sq.id} sq={sq} {...sqProps} />)}
          </div>
          <div style={S.midBand}>
            <div style={S.leftCol}>
              {left.map(sq => <Square key={sq.id} sq={sq} {...sqProps} />)}
            </div>
            <div style={S.innerWrap}>
              <div style={S.innerLabel}>INNER RING</div>
              <div style={S.innerGrid}>
                {inner.map(sq => <Square key={sq.id} sq={sq} {...sqProps} />)}
              </div>
            </div>
            <div style={S.rightCol}>
              {right.map(sq => <Square key={sq.id} sq={sq} {...sqProps} />)}
            </div>
          </div>
          <div style={S.bottomRow}>
            {bottom.map(sq => <Square key={sq.id} sq={sq} {...sqProps} />)}
          </div>
        </div>

        {/* Legend */}
        <div style={S.legend}>
          {[...Object.entries(COLOR_MAP), ...Object.entries(TYPE_COLOR)].map(([name, color]) => (
            <div key={name} style={S.legendItem}>
              <div style={{ width:9, height:9, borderRadius:2, background:color, border:'1px solid rgba(255,255,255,0.3)' }} />
              <span style={{ fontSize:8, color:'#8fb8d8', textTransform:'capitalize' }}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Side Panel ── */}
      <div style={S.panel}>
        <div style={S.turnBox}>
          <div style={{ color:'#d4a017', fontWeight:700, fontSize:13 }}>
            {isMyTurn ? '🎯 Your turn!' : '⏳ ' + (currentPlayer?.username || '...') + "'s turn"}
          </div>
          {lastDiceRoll && (
            <div style={{ color:'#fff', fontSize:18, marginTop:4 }}>
              🎲 {lastDiceRoll[0]} + {lastDiceRoll[1]} = {lastDiceRoll[0] + lastDiceRoll[1]}
            </div>
          )}
          <div style={{ color:'#8fb8d8', fontSize:10, marginTop:3 }}>Phase: {currentPhase}</div>
        </div>

        {isMyTurn && (
          <div style={S.actions}>
            {currentPhase === 'roll' && !me?.isJailed && (
              <button style={S.btnGreen} onClick={() => socket.emit('roll_dice', { roomCode })}>
                🎲 Roll Dice
              </button>
            )}
            {(currentPhase === 'roll' || currentPhase === 'jail_decision') && me?.isJailed && <>
              <button style={S.btnGreen} onClick={() => emit('pay_jail_fine')}>💰 Pay ₹500 & Roll</button>
              <button style={S.btnGray}  onClick={() => emit('skip_jail_turn')}>⏭ Skip Turn</button>
            </>}
            {currentPhase === 'action' && !showPropPopup && !borrowContext && <>
              <button style={S.btnGreen} onClick={() => emit('buy_property')}>🏠 Buy Property</button>
              <button style={S.btnGray}  onClick={() => emit('skip_buying')}>⏭ Skip</button>
            </>}
            {currentPhase === 'action' && borrowContext && (
              <div style={{ color:'#fca5a5', fontSize:11, textAlign:'center', padding:'8px', background:'rgba(239,68,68,0.1)', borderRadius:6, border:'1px solid rgba(239,68,68,0.25)' }}>
                ⚠ Waiting for borrow decision…
              </div>
            )}
          </div>
        )}

        {selected && (
          <div style={S.infoBox}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ color:'#fff', fontWeight:700, fontSize:12 }}>{selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:14, padding:0 }}>✕</button>
            </div>
            <div style={{ color:'#8fb8d8', fontSize:10, marginTop:5, lineHeight:1.6 }}>
              {selected.type === 'property' && <>
                <div>Color: <span style={{ color: COLOR_MAP[selected.color] || '#fff' }}>{selected.color}</span></div>
                <div>Buy: ₹{selected.buyPrice?.toLocaleString()}</div>
                <div>Rents: ₹{selected.baseRent} / ₹{selected.rentL1} / ₹{selected.rentL2} / ₹{selected.rentL3}</div>
                {gameState.properties[selected.id] && (() => {
                  const own   = gameState.properties[selected.id];
                  const owner = players.find(p => p.id === own.ownerId);
                  return (
                    <div style={{ marginTop:3, color: owner?.username === myUsername ? '#86efac' : '#fca5a5' }}>
                      Owned by {owner?.username || '?'} · Level {own.upgradeLevel}
                    </div>
                  );
                })()}
              </>}
              {selected.type === 'portal'   && <div>Teleports to paired portal on the other ring!</div>}
              {selected.type === 'upgrader' && <div>Draw an Upgrader card based on dice total.</div>}
              {selected.type === 'chance'   && <div>Draw a Chance card based on dice total.</div>}
              {selected.type === 'republic' && <div>Draw a Republic card based on dice total.</div>}
              {selected.type === 'jail'     && <div>Go to Jail! Pay ₹500 or skip one turn.</div>}
              {selected.type === 'bonus'    && <div>Collect ₹500 from the bank!</div>}
              {selected.type === 'fine'     && <div>Pay ₹500 to the bank.</div>}
              {selected.type === 'start'    && <div>Collect ₹2000 each time you pass GO.</div>}
            </div>
          </div>
        )}

        <div style={S.sectionLabel}>PLAYERS ({players.filter(p => !p.isEliminated).length})</div>
        {players.map(p => (
          <PlayerCard
            key={p.id} player={p}
            isCurrent={turnOrder[currentPlayerIndex] === p.id}
            isMe={p.username === myUsername}
          />
        ))}

        <div style={S.sectionLabel}>EVENT LOG</div>
        <div ref={logRef} style={S.logBox}>
          {log.length === 0
            ? <div style={{ color:'#444', fontSize:10 }}>Events will appear here...</div>
            : log.map((entry, i) => (
              <div key={i} style={{ color:'#8fb8d8', fontSize:10, marginBottom:3, paddingBottom:3, borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                {entry}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
};

const S = {
  root:        { display:'flex', minHeight:'100vh', background:'#0a1628', color:'#fff', fontFamily:'sans-serif', padding:10, gap:10, boxSizing:'border-box' },
  loading:     { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a1628', color:'#fff', fontSize:'1.3rem' },
  boardWrap:   { flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:6 },
  outerWrap:   { display:'flex', flexDirection:'column', gap:2, background:'rgba(255,255,255,0.04)', borderRadius:8, padding:4, flex:1 },
  topRow:      { display:'grid', gridTemplateColumns:'repeat(16, 1fr)', gap:2 },
  midBand:     { display:'flex', flex:1, gap:2 },
  leftCol:     { display:'grid', gridTemplateRows:'repeat(15, 1fr)', gap:2, width:36, flexShrink:0 },
  rightCol:    { display:'grid', gridTemplateRows:'repeat(15, 1fr)', gap:2, width:36, flexShrink:0 },
  innerWrap:   { flex:1, display:'flex', flexDirection:'column', background:'rgba(0,0,0,0.25)', borderRadius:6, padding:6 },
  innerLabel:  { color:'#d4a017', fontSize:9, fontWeight:700, textAlign:'center', letterSpacing:2, marginBottom:5 },
  innerGrid:   { display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:2, flex:1 },
  bottomRow:   { display:'grid', gridTemplateColumns:'repeat(16, 1fr)', gap:2 },
  legend:      { display:'flex', flexWrap:'wrap', gap:5 },
  legendItem:  { display:'flex', alignItems:'center', gap:3 },
  panel:       { width:210, flexShrink:0, display:'flex', flexDirection:'column', overflowY:'auto', maxHeight:'100vh' },
  turnBox:     { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(212,160,23,0.35)', borderRadius:8, padding:'10px 12px', marginBottom:8, textAlign:'center' },
  actions:     { display:'flex', flexDirection:'column', gap:5, marginBottom:8 },
  btnGreen:    { background:'#1e6b3c', color:'#fff', border:'none', borderRadius:7, padding:'9px', fontWeight:700, fontSize:12, cursor:'pointer' },
  btnGray:     { background:'rgba(255,255,255,0.1)', color:'#fff', border:'1px solid rgba(255,255,255,0.18)', borderRadius:7, padding:'7px', fontWeight:600, fontSize:11, cursor:'pointer' },
  infoBox:     { background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.13)', borderRadius:7, padding:'9px 11px', marginBottom:8 },
  sectionLabel:{ color:'#d4a017', fontWeight:700, fontSize:10, letterSpacing:1, marginBottom:5 },
  logBox:      { flex:1, minHeight:100, maxHeight:180, overflowY:'auto', background:'rgba(0,0,0,0.35)', borderRadius:7, padding:7 },
};

const JM = {
  overlay:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1002, backdropFilter:'blur(4px)' },
  modal:      { background:'#0f2035', border:'1px solid rgba(239,68,68,0.3)', borderRadius:16, width:340, maxWidth:'95vw', overflow:'hidden', boxShadow:'0 24px 64px rgba(0,0,0,0.7)' },
  header:     { padding:'24px 24px 16px', display:'flex', flexDirection:'column', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.08)', background:'rgba(239,68,68,0.08)' },
  body:       { padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:10 },
  balanceRow: { display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.04)', borderRadius:8, padding:'8px 12px', border:'1px solid rgba(255,255,255,0.08)' },
  optionBox:  { display:'flex', alignItems:'center', gap:12, border:'1px solid', borderRadius:10, padding:'12px 14px' },
  btn:        { flexShrink:0, border:'none', borderRadius:8, padding:'8px 14px', fontWeight:700, fontSize:12, color:'#fff' },
};

export default Game;