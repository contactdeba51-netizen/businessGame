import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';

const socket = getSocket();
const TOKEN_STYLES = ['🚗','🐶','🍎','🎩','⛵','🏆','👟','🌟'];
const TOKEN_COLORS = ['red','blue','green','yellow','purple','orange','white','black','pink','teal'];

const Lobby = () => {
  const { roomCode }            = useParams();
  const { state }               = useLocation();
  const navigate                = useNavigate();
  const isHost                  = state?.isHost || false;
  const [players, setPlayers]   = useState(state?.players || (state?.player ? [state.player] : []));
  const [myToken, setMyToken]   = useState({ style: '🚗', color: state?.player?.tokenColor || 'red' });
  const [error, setError]       = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    console.log('🎮 Lobby mounted');
    console.log('   socket.connected:', socket.connected);
    console.log('   socket.id:', socket.id);
    console.log('   roomCode:', roomCode);
    console.log('   isHost:', isHost);

    // 👇 FIX 3 — reconnect if socket dropped
    if (!socket.connected) {
  console.log('🔌 Socket not connected, connecting now...');
  socket.connect();
}

// Rejoin the Socket.IO room channel so broadcasts reach this socket
socket.emit('rejoin_lobby', { roomCode });

    const onLobbyUpdated = ({ players }) => {
      console.log('📋 lobby_updated received, players:', players.length);
      setPlayers(players);
    };

    const onGameStarted = ({ gameState }) => {
      console.log('🚀 game_started received in Lobby!');
      console.log('   navigating to /game/' + roomCode);
      sessionStorage.setItem('monopoly_gamestate', JSON.stringify(gameState));
      navigate(`/game/${roomCode}`, { state: { gameState } });
    };

    const onError = ({ message }) => {
      console.log('❌ error received in Lobby:', message);
      setError(message);
      setStarting(false);
    };

    const onRoomClosed = ({ message }) => {
      console.log('🚪 room_closed received:', message);
      alert(message);
      sessionStorage.removeItem('monopoly_room');
      sessionStorage.removeItem('monopoly_player');
      navigate('/dashboard');
    };

    const onConnect = () => {
      console.log('🔌 Socket (re)connected in Lobby, new id:', socket.id);
    };

    const onDisconnect = (reason) => {
      console.log('💔 Socket disconnected in Lobby, reason:', reason);
    };

    socket.on('lobby_updated', onLobbyUpdated);
    socket.on('game_started',  onGameStarted);
    socket.on('error',         onError);
    socket.on('room_closed',   onRoomClosed);
    socket.on('connect',       onConnect);
    socket.on('disconnect',    onDisconnect);

    return () => {
      console.log('🧹 Lobby unmounting...');
      socket.off('lobby_updated', onLobbyUpdated);
      socket.off('game_started',  onGameStarted);
      socket.off('error',         onError);
      socket.off('room_closed',   onRoomClosed);
      socket.off('connect',       onConnect);
      socket.off('disconnect',    onDisconnect);
    };
  }, [roomCode, navigate, isHost]);

  const handleTokenChange = (style, color) => {
    setMyToken({ style, color });
    socket.emit('update_token', { roomCode, tokenStyle: style, tokenColor: color });
  };

  const handleStartGame = () => {
    if (players.length < 2) { setError('Need at least 2 players to start.'); return; }
    setStarting(true);
    socket.emit('start_game', { roomCode });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🎲 Game Lobby</h1>
        <div style={styles.codeBox}>
          <p style={styles.codeLabel}>Room Code</p>
          <p style={styles.codeText}>{roomCode}</p>
          <p style={styles.codeHint}>Share this code with your friends!</p>
        </div>
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Players ({players.filter(Boolean).length})</h3>
          <div style={styles.playersList}>
            {players.filter(Boolean).map((player, i) => (
              <div key={i} style={styles.playerRow}>
                <span style={styles.playerToken}>{myToken.style}</span>
                <span style={styles.playerName}>
                  {player.username}
                  {player.isHost && <span style={styles.hostBadge}> 👑 Host</span>}
                </span>
                <span style={{ ...styles.colorDot, backgroundColor: player.tokenColor }} />
              </div>
            ))}
          </div>
        </div>
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Choose Your Token</h3>
          <div style={styles.tokenGrid}>
            {TOKEN_STYLES.map((style, i) => (
              <button key={i} onClick={() => handleTokenChange(style, myToken.color)}
                style={{ ...styles.tokenBtn,
                  backgroundColor: myToken.style===style ? '#1a3c5e' : '#f0f4f8',
                  color: myToken.style===style ? '#fff' : '#1a3c5e',
                }}>
                {style}
              </button>
            ))}
          </div>
          <h3 style={styles.sectionTitle}>Choose Your Colour</h3>
          <div style={styles.colorGrid}>
            {TOKEN_COLORS.map((color, i) => (
              <button key={i} onClick={() => handleTokenChange(myToken.style, color)}
                style={{ ...styles.colorBtn, backgroundColor: color,
                  border: myToken.color===color ? '3px solid #1a3c5e' : '3px solid transparent',
                }} />
            ))}
          </div>
        </div>
        {isHost ? (
          <button style={styles.startBtn} onClick={handleStartGame} disabled={starting}>
            {starting ? 'Starting...' : '🚀 Start Game'}
          </button>
        ) : (
          <div style={styles.waiting}>⏳ Waiting for host to start the game...</div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container:    { minHeight:'100vh', backgroundColor:'#1a3c5e', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  card:         { backgroundColor:'#fff', borderRadius:'20px', padding:'40px', width:'100%', maxWidth:'560px', boxShadow:'0 8px 32px rgba(0,0,0,0.3)' },
  title:        { textAlign:'center', color:'#1a3c5e', fontSize:'2rem', marginBottom:'20px' },
  codeBox:      { backgroundColor:'#eaf2fb', borderRadius:'12px', padding:'20px', textAlign:'center', marginBottom:'24px', border:'2px solid #b8d4ea' },
  codeLabel:    { color:'#555', fontSize:'0.9rem', margin:0 },
  codeText:     { color:'#1a3c5e', fontSize:'2.5rem', fontWeight:'bold', letterSpacing:'8px', margin:'8px 0' },
  codeHint:     { color:'#555', fontSize:'0.85rem', margin:0 },
  error:        { backgroundColor:'#fdf0f0', color:'#8b1a1a', padding:'12px', borderRadius:'8px', marginBottom:'16px', fontSize:'0.9rem', textAlign:'center' },
  section:      { marginBottom:'24px' },
  sectionTitle: { color:'#1a3c5e', fontSize:'1.1rem', marginBottom:'12px' },
  playersList:  { display:'flex', flexDirection:'column', gap:'8px' },
  playerRow:    { display:'flex', alignItems:'center', gap:'12px', backgroundColor:'#f0f4f8', padding:'10px 16px', borderRadius:'8px' },
  playerToken:  { fontSize:'1.4rem' },
  playerName:   { flex:1, color:'#1a3c5e', fontWeight:'bold' },
  hostBadge:    { color:'#d4a017', fontSize:'0.85rem' },
  colorDot:     { width:'20px', height:'20px', borderRadius:'50%', border:'2px solid #ccc' },
  tokenGrid:    { display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'16px' },
  tokenBtn:     { width:'48px', height:'48px', borderRadius:'8px', border:'none', fontSize:'1.5rem', cursor:'pointer' },
  colorGrid:    { display:'flex', flexWrap:'wrap', gap:'8px' },
  colorBtn:     { width:'36px', height:'36px', borderRadius:'50%', cursor:'pointer' },
  startBtn:     { width:'100%', padding:'16px', backgroundColor:'#1e6b3c', color:'#fff', border:'none', borderRadius:'12px', fontSize:'1.1rem', fontWeight:'bold', cursor:'pointer' },
  waiting:      { textAlign:'center', color:'#555', fontSize:'1rem', padding:'16px', backgroundColor:'#f0f4f8', borderRadius:'12px' },
};

export default Lobby;