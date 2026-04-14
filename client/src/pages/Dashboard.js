import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../services/socket';

const socket = getSocket();

const Dashboard = () => {
  const { user, logout }        = useAuth();
  const navigate                = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [joining, setJoining]   = useState(false);
  const [error, setError]       = useState('');

  const handleCreateRoom = () => {
    setError('');
    socket.off('room_created');
    socket.off('error');

    socket.emit('create_room', {
      username:    user.username,
      mode:        'online',
      playerCount: 4,
    });

    socket.once('room_created', ({ roomCode, player }) => {
      sessionStorage.setItem('monopoly_room',   roomCode);
      sessionStorage.setItem('monopoly_player', JSON.stringify(player));
      navigate(`/lobby/${roomCode}`, { state: { isHost: true, player } });
    });

    socket.once('error', ({ message }) => setError(message));
  };

  const handleJoinRoom = () => {
    if (!roomCode.trim()) { setError('Please enter a room code.'); return; }
    setJoining(true);
    setError('');
    socket.off('player_joined');
    socket.off('error');

    socket.emit('join_room', {
      roomCode: roomCode.toUpperCase(),
      username: user.username,
    });

    socket.once('player_joined', ({ players }) => {
  setJoining(false);
  const me = players.find(p => p.username === user.username);
  const code = roomCode.toUpperCase();
  sessionStorage.setItem('monopoly_room',   code);
  sessionStorage.setItem('monopoly_player', JSON.stringify(me));
  navigate(`/lobby/${code}`, { state: { isHost: false, player: me, players } });
});

    socket.once('error', ({ message }) => {
      setJoining(false);
      setError(message);
    });
  };

  const handleLogout = () => {
    logout(); // socket.disconnect() is now inside logout()
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.logo}>🎲 Monopoly</h1>
        <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>
      <div style={styles.welcome}>
        <h2 style={styles.welcomeText}>Welcome, {user?.username}! 👋</h2>
      </div>
      <div style={styles.statsRow}>
        {[
          { label: 'Games Played', value: user?.stats?.gamesPlayed || 0 },
          { label: 'Wins',         value: user?.stats?.wins        || 0 },
          { label: 'Losses',       value: user?.stats?.losses      || 0 },
          { label: 'Money Earned', value: `₹${user?.stats?.totalMoneyEarned || 0}` },
        ].map(({ label, value }) => (
          <div key={label} style={styles.statCard}>
            <div style={styles.statNumber}>{value}</div>
            <div style={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <div style={styles.playSection}>
        <div style={styles.playCard}>
          <h3 style={styles.playTitle}>🏠 Create Room</h3>
          <p style={styles.playDesc}>Start a new game and invite friends with a room code</p>
          <button style={styles.primaryBtn} onClick={handleCreateRoom}>Create Room</button>
        </div>
        <div style={styles.playCard}>
          <h3 style={styles.playTitle}>🚪 Join Room</h3>
          <p style={styles.playDesc}>Enter a room code to join your friend's game</p>
          <input
            style={styles.codeInput}
            type="text"
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={e => setRoomCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button style={styles.primaryBtn} onClick={handleJoinRoom} disabled={joining}>
            {joining ? 'Joining...' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container:   { minHeight: '100vh', backgroundColor: '#f0f4f8' },
  header:      { backgroundColor: '#1a3c5e', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo:        { color: '#d4a017', fontSize: '1.8rem', margin: 0 },
  logoutBtn:   { backgroundColor: 'transparent', color: '#fff', border: '2px solid #fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' },
  welcome:     { padding: '32px 32px 0' },
  welcomeText: { color: '#1a3c5e', fontSize: '1.8rem' },
  statsRow:    { display: 'flex', gap: '16px', padding: '24px 32px', flexWrap: 'wrap' },
  statCard:    { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', textAlign: 'center', minWidth: '120px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flex: 1 },
  statNumber:  { fontSize: '1.8rem', fontWeight: 'bold', color: '#1a3c5e' },
  statLabel:   { fontSize: '0.85rem', color: '#555', marginTop: '4px' },
  error:       { backgroundColor: '#fdf0f0', color: '#8b1a1a', padding: '12px 32px', margin: '0 32px', borderRadius: '8px', fontSize: '0.9rem' },
  playSection: { display: 'flex', gap: '24px', padding: '24px 32px', flexWrap: 'wrap' },
  playCard:    { backgroundColor: '#fff', padding: '32px', borderRadius: '16px', flex: 1, minWidth: '280px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', textAlign: 'center' },
  playTitle:   { color: '#1a3c5e', fontSize: '1.4rem', marginBottom: '12px' },
  playDesc:    { color: '#555', fontSize: '0.95rem', marginBottom: '20px', lineHeight: '1.5' },
  codeInput:   { width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #b8d4ea', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '4px', fontWeight: 'bold', marginBottom: '12px', boxSizing: 'border-box' },
  primaryBtn:  { width: '100%', padding: '14px', backgroundColor: '#1a3c5e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' },
};

export default Dashboard;