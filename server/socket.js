// ============================================================
// socket.js — Server-side Socket.IO handler
// ============================================================
const gameEngine = require('./gameEngine');

// In-memory store — all active rooms live here
// Structure: { [roomCode]: gameState }
const rooms = {};

// Map of socketId → { roomCode, username }
// Used to handle disconnects gracefully
const socketPlayerMap = {};

module.exports = (io) => {

  io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.id);

    // ─────────────────────────────────────────────────────
    // CREATE ROOM
    // Called by the host when they click "Create Game"
    // ─────────────────────────────────────────────────────
    socket.on('create_room', ({ username, tokenStyle, tokenColor, mode }) => {
      try {
        const roomCode = gameEngine.generateRoomCode();
        const hostPlayer = {
          id: socket.id,
          username,
          tokenStyle: tokenStyle || 'car',
          tokenColor: tokenColor || 'red',
          isBot: false,
        };
        rooms[roomCode] = {
          mode,
          status: 'waiting',
          players: [hostPlayer],
          gameState: null,
        };
        socketPlayerMap[socket.id] = { roomCode, username };
        socket.join(roomCode);
        socket.emit('room_created', { roomCode, players: rooms[roomCode].players });
        console.log(`🏠 Room created: ${roomCode} by ${username}`);
      } catch (err) {
        console.error('create_room error:', err);
        socket.emit('error', { message: 'Failed to create room.' });
      }
    });

    // ─────────────────────────────────────────────────────
    // JOIN ROOM
    // Called by other players when they enter a room code
    // ─────────────────────────────────────────────────────
    socket.on('join_room', ({ roomCode, username, tokenStyle, tokenColor }) => {
      try {
        const room = rooms[roomCode];
        if (!room) {
          socket.emit('error', { message: 'Room not found.' });
          return;
        }
        if (room.status !== 'waiting') {
          // If the game is active and this username is already a player,
          // redirect them to rejoin instead of blocking them
          const existingPlayer = room.gameState?.players?.find(p => p.username === username);
          if (existingPlayer) {
            // Treat as a rejoin
            const oldSocketId = existingPlayer.id;
            room.gameState.players = room.gameState.players.map(p =>
              p.username === username ? { ...p, id: socket.id } : p
            );
            room.gameState.turnOrder = room.gameState.turnOrder.map(id =>
              id === oldSocketId ? socket.id : id
            );
            delete socketPlayerMap[oldSocketId];
            socketPlayerMap[socket.id] = { roomCode, username };
            socket.join(roomCode);
            socket.emit('state_updated', { gameState: room.gameState });
            console.log(`🔄 ${username} silently rejoined active game in room ${roomCode}`);
            return;
          }
          socket.emit('error', { message: 'Game already in progress.' });
          return;
        }
        if (room.players.length >= 6) {
          socket.emit('error', { message: 'Room is full (max 6 players).' });
          return;
        }
        const existingLobbyPlayer = room.players.find(p => p.username === username);
        if (existingLobbyPlayer) {
          // Player already in lobby but reconnected with a new socket ID
          existingLobbyPlayer.id = socket.id;
          delete socketPlayerMap[existingLobbyPlayer.id];
          socketPlayerMap[socket.id] = { roomCode, username };
          socket.join(roomCode);
          socket.emit('player_joined', { players: room.players });
          io.to(roomCode).emit('lobby_updated', { players: room.players });
          console.log(`🔄 ${username} re-joined lobby ${roomCode} with new socket`);
          return;
        }
        const newPlayer = {
          id: socket.id,
          username,
          tokenStyle: tokenStyle || 'car',
          tokenColor: tokenColor || 'blue',
          isBot: false,
        };
        room.players.push(newPlayer);
        socketPlayerMap[socket.id] = { roomCode, username };
        socket.join(roomCode);
        io.to(roomCode).emit('player_joined', { players: room.players });
        io.to(roomCode).emit('lobby_updated', { players: room.players });
        console.log(`👤 ${username} joined room ${roomCode}`);
      } catch (err) {
        console.error('join_room error:', err);
        socket.emit('error', { message: 'Failed to join room.' });
      }
    });

    // ─────────────────────────────────────────────────────
    // START GAME
    // Called by host when everyone is ready
    // ─────────────────────────────────────────────────────
    socket.on('start_game', ({ roomCode }) => {
      try {
        const room = rooms[roomCode];
        if (!room) {
          socket.emit('error', { message: 'Room not found.' });
          return;
        }
        if (room.players.length < 2) {
          socket.emit('error', { message: 'Need at least 2 players to start.' });
          return;
        }

        // Create initial game state
        let gameState = gameEngine.createInitialGameState(
          roomCode,
          room.mode || 'classic',
          room.players
        );

        // Set random turn order
        gameState = gameEngine.setTurnOrder(gameState);

        room.gameState = gameState;
        room.status = 'active';

        io.to(roomCode).emit('game_started', { gameState });
        console.log(`🎮 Game started in room ${roomCode}`);
      } catch (err) {
        console.error('start_game error:', err);
        socket.emit('error', { message: 'Failed to start game.' });
      }
    });

    // ─────────────────────────────────────────────────────
    // REJOIN GAME
    // Called when a player refreshes or reconnects
    // ─────────────────────────────────────────────────────
    socket.on('rejoin_game', ({ roomCode, username }) => {
      try {
        const room = rooms[roomCode];
        if (!room) {
          socket.emit('error', { message: 'Room no longer exists.' });
          return;
        }

        // Check player exists in game state
        const playerInGame = room.gameState?.players?.find(p => p.username === username);
        if (!playerInGame) {
          socket.emit('error', { message: 'Player not found in this room.' });
          return;
        }

        // Update socket ID mapping (their socket ID changed on reconnect)
        const oldSocketId = playerInGame.id;
        if (oldSocketId !== socket.id) {
          room.gameState.players = room.gameState.players.map(p =>
            p.username === username ? { ...p, id: socket.id } : p
          );
          room.gameState.turnOrder = room.gameState.turnOrder.map(id =>
            id === oldSocketId ? socket.id : id
          );
          delete socketPlayerMap[oldSocketId];
        }

        socketPlayerMap[socket.id] = { roomCode, username };
        socket.join(roomCode);

        // Send current game state back to the rejoining player
        socket.emit('state_updated', { gameState: room.gameState });
        console.log(`🔄 ${username} rejoined room ${roomCode}`);
      } catch (err) {
        console.error('rejoin_game error:', err);
        socket.emit('error', { message: 'Failed to rejoin game.' });
      }
    });

    // ─────────────────────────────────────────────────────
    // ROLL DICE
    // Separate event (not player_action) for rolling
    // ─────────────────────────────────────────────────────
    socket.on('roll_dice', ({ roomCode }) => {
      try {
        const room = rooms[roomCode];
        if (!room?.gameState) {
          socket.emit('error', { message: 'Game not found.' });
          return;
        }

        // Only the current player can roll
        const currentPlayerId = gameEngine.getCurrentPlayerId(room.gameState);
        if (socket.id !== currentPlayerId) {
          socket.emit('error', { message: 'It is not your turn.' });
          return;
        }

        const newState = gameEngine.rollDice(room.gameState);
        room.gameState = newState;

        io.to(roomCode).emit('state_updated', { gameState: newState });

        if (newState.status === 'finished') {
          io.to(roomCode).emit('game_over', { winnerId: newState.winner });
        }
      } catch (err) {
        console.error('roll_dice error:', err);
        socket.emit('error', { message: 'Failed to roll dice.' });
      }
    });

    // ─────────────────────────────────────────────────────
    // PLAYER ACTION
    // All in-game decisions go through here
    // ─────────────────────────────────────────────────────
    socket.on('player_action', ({ roomCode, action, ...data }) => {
      try {
        const room = rooms[roomCode];
        if (!room?.gameState) {
          socket.emit('error', { message: 'Game not found.' });
          return;
        }

        const gs = room.gameState;
        const currentPlayerId = gameEngine.getCurrentPlayerId(gs);
        const actingPlayer = gs.players.find(p => p.id === socket.id);

        if (!actingPlayer) {
          socket.emit('error', { message: 'Player not found.' });
          return;
        }

        // Actions that require it to be your turn.
        // NOTE: borrow_from_bank and refuse_borrow are intentionally excluded —
        // the engine validates the pendingPayment ownership internally.
        const turnRequiredActions = [
          'buy_property',
          'skip_buying',
          'pay_jail_fine',
          'skip_jail_turn',
          'use_discount_pay',
          'declare_blocker',
          'use_color_l1_card',   // legacy direct action (kept for back-compat)
          'use_level2_any_card', // legacy direct action (kept for back-compat)
          'use_card',            // new unified card action
        ];

        if (turnRequiredActions.includes(action) && socket.id !== currentPlayerId) {
          socket.emit('error', { message: 'It is not your turn.' });
          return;
        }

        let newState = gs;

        switch (action) {

          // ── Property ──────────────────────────────────
          case 'buy_property':
            newState = gameEngine.buyProperty(gs, actingPlayer.id, data.useDiscountCard || false);
            break;

          case 'skip_buying':
            newState = gameEngine.skipBuying(gs, actingPlayer.id);
            break;

          // ── Jail ──────────────────────────────────────
          case 'pay_jail_fine':
            newState = gameEngine.payJailFine(gs, actingPlayer.id);
            break;

          case 'skip_jail_turn':
            newState = gameEngine.skipJailTurn(gs, actingPlayer.id);
            break;

          // ── Cards ─────────────────────────────────────
          case 'use_discount_pay':
            newState = gameEngine.useDiscountPayCard(gs, actingPlayer.id);
            break;

          case 'declare_blocker':
            newState = gameEngine.declareBlocker(gs, actingPlayer.id, data.declaredNumber);
            break;

          // Legacy direct card actions (kept for back-compat)
          case 'use_color_l1_card':
            newState = gameEngine.useColorL1Card(gs, actingPlayer.id, data.targetSquareId);
            break;

          case 'use_level2_any_card':
            newState = gameEngine.useLevel2AnyCard(gs, actingPlayer.id, data.targetSquareId);
            break;

          // ── NEW: Unified card action from EventCardModal ──
          // Emitted as: { action: 'use_card', cardType: 'color_l1' | 'level2_any', targetSquareId }
          case 'use_card': {
            const { cardType, targetSquareId } = data;
            if (cardType === 'color_l1') {
              newState = gameEngine.useColorL1Card(gs, actingPlayer.id, targetSquareId);
            } else if (cardType === 'level2_any') {
              newState = gameEngine.useLevel2AnyCard(gs, actingPlayer.id, targetSquareId);
            } else {
              socket.emit('error', { message: `Unknown card type: ${cardType}` });
              return;
            }
            break;
          }

          // ── Bank Borrowing ─────────────────────────────
          // Not turn-restricted — any player who has a pendingPayment can borrow.
          // The engine validates that the pendingPayment belongs to the acting player.
          case 'borrow_from_bank':
            newState = gameEngine.borrowFromBank(gs, actingPlayer.id, data.amount);
            break;

          // ── NEW: Refuse to borrow — player surrenders / gets eliminated ──
          // Emitted as: { action: 'refuse_borrow' }
          case 'refuse_borrow':
            newState = gameEngine.eliminatePlayer(gs, actingPlayer.id);
            console.log(`💀 ${actingPlayer.username} refused to borrow and was eliminated.`);
            break;

          default:
            socket.emit('error', { message: `Unknown action: ${action}` });
            return;
        }

        room.gameState = newState;
        io.to(roomCode).emit('state_updated', { gameState: newState });

        // Check win condition after every action
        if (newState.status === 'finished') {
          io.to(roomCode).emit('game_over', { winnerId: newState.winner });
        }

      } catch (err) {
        console.error('player_action error:', err.message);
        socket.emit('error', { message: 'Action failed: ' + err.message });
      }
    });

    // ─────────────────────────────────────────────────────
    // REJOIN LOBBY
    // Called by any player already in the room when Lobby
    // component mounts — ensures their socket is subscribed
    // to the room channel so broadcasts reach them
    // ─────────────────────────────────────────────────────
    socket.on('rejoin_lobby', ({ roomCode }) => {
      const room = rooms[roomCode];
      if (!room) return;
      socket.join(roomCode);
      socket.emit('lobby_updated', { players: room.players });
      console.log(`🔁 Socket ${socket.id} rejoined lobby channel ${roomCode}`);
    });

    // ─────────────────────────────────────────────────────
    // DISCONNECT
    // Clean up when a player's socket drops
    // ─────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`❌ Socket disconnected: ${socket.id} — reason: ${reason}`);

      // Ignore transport-level reconnect attempts
      if (reason === 'transport close' || reason === 'ping timeout') {
        console.log(`⏳ Temporary disconnect for ${socket.id} — waiting for rejoin`);
        return;
      }

      const mapping = socketPlayerMap[socket.id];
      if (!mapping) return;

      const { roomCode, username } = mapping;
      delete socketPlayerMap[socket.id];

      const room = rooms[roomCode];
      if (!room?.gameState) return;

      // Eliminate the player from the game
      const player = room.gameState.players.find(p => p.username === username);
      if (!player || player.isEliminated) return;

      const newState = gameEngine.playerLeft(room.gameState, player.id);
      room.gameState = newState;

      io.to(roomCode).emit('state_updated', { gameState: newState });
      io.to(roomCode).emit('player_left', { message: `${username} left the game.` });

      if (newState.status === 'finished') {
        io.to(roomCode).emit('game_over', { winnerId: newState.winner });
      }

      // Clean up room if everyone is gone
      const activeSockets = Object.values(socketPlayerMap).filter(m => m.roomCode === roomCode);
      if (activeSockets.length === 0) {
        delete rooms[roomCode];
        console.log(`🗑️ Room ${roomCode} deleted — all players gone`);
      }
    });

  }); // end io.on('connection')

}; // end module.exports
