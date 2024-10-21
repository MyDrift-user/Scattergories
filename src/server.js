// src/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));  // Serve static files

let lobbies = {};  // Store lobbies and players
let userSessions = {};  // Map session IDs to user data (playertag, lobbyId)

io.on('connection', (socket) => {
    console.log(`New user connected: ${socket.id}`);

    // Handle creating a lobby
    socket.on('createLobby', () => {
        const lobbyId = uuidv4();  // Generate unique lobby ID
        lobbies[lobbyId] = [];  // Initialize the lobby with an empty array of players

        console.log(`Lobby created: ${lobbyId}`);
        socket.emit('lobbyCreated', lobbyId);  // Send the lobby ID back to the creator
    });

    // Handle joining an existing lobby
    socket.on('joinLobby', ({ lobbyId, playertag, sessionId }) => {
        if (lobbies[lobbyId]) {
            const existingPlayer = lobbies[lobbyId].find(player => player.sessionId === sessionId);

            // If the player is already in the lobby, don't add them again
            if (!existingPlayer) {
                lobbies[lobbyId].push({ sessionId, playertag });  // Add player to the lobby
            }

            userSessions[sessionId] = { lobbyId, playertag };  // Map session ID to lobby and playertag
            socket.join(lobbyId);  // Join the lobby room
            console.log(`${playertag} joined lobby: ${lobbyId}`);

            // Notify everyone in the lobby about the current players
            io.to(lobbyId).emit('updateLobby', lobbies[lobbyId]);
        } else {
            console.log(`Attempt to join non-existent lobby: ${lobbyId}`);
            socket.emit('errorMessage', 'Lobby does not exist');
        }
    });

    // Handle leaving a lobby
    socket.on('leaveLobby', ({ lobbyId, sessionId }) => {
        if (lobbies[lobbyId]) {
            // Remove the player from the lobby
            lobbies[lobbyId] = lobbies[lobbyId].filter(player => player.sessionId !== sessionId);

            // Notify other players in the lobby about the updated list
            io.to(lobbyId).emit('updateLobby', lobbies[lobbyId]);

            // If the lobby is empty, delete it
            if (lobbies[lobbyId].length === 0) {
                delete lobbies[lobbyId];
                console.log(`Lobby ${lobbyId} deleted (empty)`);
            }

            console.log(`User ${sessionId} left lobby: ${lobbyId}`);
        }
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
