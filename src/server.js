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
        lobbies[lobbyId] = {
            players: [{ sessionId, playertag, isHost: true }],
            categories: [],
            letter: '',
            answers: {},
            gameState: 'waiting'
        };

        console.log(`Lobby created: ${lobbyId} by ${playertag}`);
        userSessions[sessionId] = { lobbyId, playertag, isHost: true };
        socket.join(lobbyId);
        socket.emit('lobbyCreated', lobbyId);

        io.to(lobbyId).emit('updateLobby', lobbies[lobbyId].players);
    });

    socket.on('joinLobby', ({ lobbyId, playertag, sessionId }) => {
        if (lobbies[lobbyId]) {
            const existingPlayer = lobbies[lobbyId].players.find(player => player.sessionId === sessionId);

            if (!existingPlayer) {
                lobbies[lobbyId].players.push({ sessionId, playertag });
            }

            userSessions[sessionId] = { lobbyId, playertag };
            socket.join(lobbyId);
            console.log(`${playertag} joined lobby: ${lobbyId}`);

            io.to(lobbyId).emit('updateLobby', lobbies[lobbyId].players);
        } else {
            console.log(`Attempt to join non-existent lobby: ${lobbyId}`);
            socket.emit('errorMessage', 'Lobby does not exist');
        }
    });

    socket.on('renamePlayer', ({ sessionId, newPlayertag }) => {
        const lobbyId = userSessions[sessionId].lobbyId;

        const player = lobbies[lobbyId].players.find(player => player.sessionId === sessionId);
        if (player) {
            player.playertag = newPlayertag;
            console.log(`${sessionId} renamed to ${newPlayertag}`);

            io.to(lobbyId).emit('updateLobby', lobbies[lobbyId].players);
        } else {
            console.log(`Player with session ID ${sessionId} not found`);
        }
    });

    socket.on('leaveLobby', ({ lobbyId, sessionId }) => {
        if (lobbies[lobbyId]) {
            lobbies[lobbyId].players = lobbies[lobbyId].players.filter(player => player.sessionId !== sessionId);

            io.to(lobbyId).emit('updateLobby', lobbies[lobbyId].players);

            if (lobbies[lobbyId].players.length === 0) {
                delete lobbies[lobbyId];
                console.log(`Lobby ${lobbyId} deleted (empty)`);
            }

            console.log(`User ${sessionId} left lobby: ${lobbyId}`);
        }
    });

    socket.on('startGame', ({ lobbyId }) => {
        if (lobbies[lobbyId]) {
            lobbies[lobbyId].gameState = 'collectingCategories';
            io.to(lobbyId).emit('enterCategories');
            console.log(`Game started in lobby: ${lobbyId}`);
        }
    });

    socket.on('submitCategory', ({ lobbyId, sessionId, category }) => {
        if (lobbies[lobbyId] && lobbies[lobbyId].gameState === 'collectingCategories') {
            lobbies[lobbyId].categories.push({ sessionId, category });
            console.log(`Category submitted by ${sessionId}: ${category}`);

            // Check if all players have submitted categories
            if (lobbies[lobbyId].categories.length === lobbies[lobbyId].players.length) {
                lobbies[lobbyId].gameState = 'collectingAnswers';

                // Generate a random letter
                const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
                lobbies[lobbyId].letter = randomLetter;

                // Notify players to enter their answers
                io.to(lobbyId).emit('startAnswerPhase', {
                    categories: lobbies[lobbyId].categories.map(c => c.category),
                    letter: randomLetter
                });
                console.log(`All categories received. Starting answer phase with letter: ${randomLetter}`);
            }
        }
    });

    socket.on('submitAnswers', ({ lobbyId, sessionId, answers }) => {
        if (lobbies[lobbyId] && lobbies[lobbyId].gameState === 'collectingAnswers') {
            lobbies[lobbyId].answers[sessionId] = answers;
            console.log(`Answers submitted by ${sessionId}: ${JSON.stringify(answers)}`);

            // Check if all players have submitted answers
            if (Object.keys(lobbies[lobbyId].answers).length === lobbies[lobbyId].players.length) {
                lobbies[lobbyId].gameState = 'reviewing';

                // Calculate scores (optional)
                const scores = calculateScores(lobbies[lobbyId]);

                // Send results to players
                io.to(lobbyId).emit('showResults', {
                    answers: lobbies[lobbyId].answers,
                    categories: lobbies[lobbyId].categories,
                    players: lobbies[lobbyId].players,
                    scores
                });
                console.log(`All answers received. Showing results.`);
            }
        }
    });

    socket.on('backToLobby', ({ lobbyId }) => {
        if (lobbies[lobbyId]) {
            // Reset game data but keep the players
            lobbies[lobbyId].categories = [];
            lobbies[lobbyId].letter = '';
            lobbies[lobbyId].answers = {};
            lobbies[lobbyId].gameState = 'waiting';

            // Notify players to go back to the lobby
            io.to(lobbyId).emit('backToLobby');
            console.log(`Players returned to lobby: ${lobbyId}`);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Handle player disconnection if necessary
    });
});

// Function to calculate scores with letter validation
function calculateScores(lobby) {
    const scores = {};
    const answersByCategory = {};

    const randomLetter = lobby.letter.toLowerCase();

    // Organize answers by category and validate answers
    lobby.categories.forEach((_, index) => {
        answersByCategory[index] = {};
        for (const sessionId in lobby.answers) {
            let answer = lobby.answers[sessionId][`answer${index}`].trim();
            if (!answer) {
                answer = '---'; // Placeholder for empty answer
            }
            const answerLower = answer.toLowerCase();

            // Validate if the answer starts with the random letter
            if (answerLower.startsWith(randomLetter)) {
                // Valid answer, proceed
            } else {
                // Invalid answer, mark accordingly
                answer = `Invalid (${answer})`;
                lobby.answers[sessionId][`answer${index}`] = answer; // Update the answer to reflect invalidity
            }

            if (!answersByCategory[index][answer]) {
                answersByCategory[index][answer] = [];
            }
            answersByCategory[index][answer].push(sessionId);
        }
    });

    // Calculate scores
    for (const sessionId in lobby.answers) {
        scores[sessionId] = 0;
        lobby.categories.forEach((_, index) => {
            const answer = lobby.answers[sessionId][`answer${index}`];
            const answerLower = answer.toLowerCase();

            // Check if the answer is valid (does not start with 'Invalid' and starts with the random letter)
            if (answer.startsWith('Invalid') || !answerLower.startsWith(randomLetter)) {
                // Invalid answer, no points awarded for this category
                return; // Continue to next category
            }

            // Check uniqueness
            if (answersByCategory[index][answer].length === 1) {
                // Unique and valid answer
                scores[sessionId] += 1;
            }
        });
    }

    return scores;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
