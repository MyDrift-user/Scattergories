// src/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let lobbies = {};
let userSessions = {};

io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);

    socket.on('createLobby', ({ playertag, sessionId }) => {
        const lobbyId = uuidv4();
        lobbies[lobbyId] = [{ sessionId, playertag, isHost: true }];

        console.log(`Lobby created: ${lobbyId} by ${playertag}`);
        userSessions[sessionId] = { lobbyId, playertag, isHost: true };
        socket.join(lobbyId);
        socket.emit('lobbyCreated', lobbyId);

        io.to(lobbyId).emit('updateLobby', lobbies[lobbyId]);
    });

    socket.on('joinLobby', ({ lobbyId, playertag, sessionId }) => {
        if (lobbies[lobbyId]) {
            const existingPlayer = lobbies[lobbyId].find(player => player.sessionId === sessionId);

            if (!existingPlayer) {
                lobbies[lobbyId].push({ sessionId, playertag });
            }

            userSessions[sessionId] = { lobbyId, playertag };
            socket.join(lobbyId);
            console.log(`${playertag} joined lobby: ${lobbyId}`);

            io.to(lobbyId).emit('updateLobby', lobbies[lobbyId]);
        } else {
            console.log(`Attempt to join non-existent lobby: ${lobbyId}`);
            socket.emit('errorMessage', 'Lobby does not exist');
        }
    });

    socket.on('renamePlayer', ({ sessionId, newPlayertag }) => {
        const lobbyId = userSessions[sessionId].lobbyId;
        
        const player = lobbies[lobbyId].find(player => player.sessionId === sessionId);
        if (player) {
            player.playertag = newPlayertag;
            console.log(`${sessionId} renamed to ${newPlayertag}`);

            io.to(lobbyId).emit('updateLobby', lobbies[lobbyId]);
        } else {
            console.log(`Player with session ID ${sessionId} not found`);
        }
    });

    socket.on('leaveLobby', ({ lobbyId, sessionId }) => {
        if (lobbies[lobbyId]) {
            lobbies[lobbyId] = lobbies[lobbyId].filter(player => player.sessionId !== sessionId);

            io.to(lobbyId).emit('updateLobby', lobbies[lobbyId]);

            if (lobbies[lobbyId].length === 0) {
                delete lobbies[lobbyId];
                console.log(`Lobby ${lobbyId} deleted (empty)`);
            }

            console.log(`User ${sessionId} left lobby: ${lobbyId}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});