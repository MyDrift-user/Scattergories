// public/script.js
const socket = io();

let currentLobbyId = '';

function saveSession(playertag) {
    const sessionId = localStorage.getItem('sessionId') || generateSessionId();
    localStorage.setItem('sessionId', sessionId);
    localStorage.setItem('playertag', playertag);
    return sessionId;
}

function getSessionId() {
    return localStorage.getItem('sessionId');
}

function getSavedplayertag() {
    return localStorage.getItem('playertag');
}

function generateSessionId() {
    return 'xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function copyToClipboard(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
}

function switchToLobby(lobbyId) {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('enterplayertag').style.display = 'none';
    document.getElementById('lobby').style.display = 'block';
    document.getElementById('lobbyIdDisplay').textContent = lobbyId;
    history.pushState(null, '', `/?lobbyId=${lobbyId}`);
}

document.getElementById('copyLobbyIdBtn').addEventListener('click', () => {
    const lobbyId = document.getElementById('lobbyIdDisplay').textContent;
    copyToClipboard(lobbyId);
});

document.getElementById('copyLobbyLinkBtn').addEventListener('click', () => {
    const lobbyId = document.getElementById('lobbyIdDisplay').textContent;
    const lobbyLink = `${window.location.origin}/?lobbyId=${lobbyId}`;
    copyToClipboard(lobbyLink);
});

function switchToplayertagInput() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('enterplayertag').style.display = 'block';
}

function switchToMainMenu() {
    document.getElementById('mainMenu').style.display = 'block';
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('enterplayertag').style.display = 'none';
    document.getElementById('enterCategory').style.display = 'none';
    document.getElementById('answerPhase').style.display = 'none';
    document.getElementById('resultsPhase').style.display = 'none';
    history.pushState(null, '', `/`);
}

document.getElementById('createLobbyBtn').addEventListener('click', () => {
    const playertag = getSavedplayertag() || prompt("Enter your player tag to create a lobby:");
    if (playertag) {
        const sessionId = saveSession(playertag);
        console.log(`Creating lobby with playertag: ${playertag}, session: ${sessionId}`);
        socket.emit('createLobby', { playertag, sessionId });
    }
});

document.getElementById('joinLobbyBtn').addEventListener('click', () => {
    const lobbyId = document.getElementById('lobbyIdField').value.trim();
    if (lobbyId) {
        currentLobbyId = lobbyId;
        console.log(`Trying to join lobby with ID: ${lobbyId}`);
        let playertag = getSavedplayertag();
        if (playertag) {
            const sessionId = getSessionId();
            console.log(`Joining lobby ${lobbyId} with saved playertag: ${playertag}, session: ${sessionId}`);
            socket.emit('joinLobby', { lobbyId, playertag, sessionId });
            switchToLobby(lobbyId);
        } else {
            switchToplayertagInput();
        }
    } else {
        alert("Please enter a valid lobby ID!");
    }
});

socket.on('lobbyCreated', (lobbyId) => {
    console.log(`Lobby created with ID: ${lobbyId}`);
    currentLobbyId = lobbyId;
    switchToplayertagInput();
});

socket.on('lobbyJoined', (lobbyId) => {
    console.log(`Joined lobby with ID: ${lobbyId}`);
    switchToLobby(lobbyId);
});

socket.on('rejoinLobby', (lobbyId) => {
    console.log(`Rejoined lobby with ID: ${lobbyId}`);
    switchToLobby(lobbyId);
});

socket.on('updateLobby', (players) => {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';
    const sessionId = getSessionId();
    let isHost = false;

    players.forEach(player => {
        const li = document.createElement('li');
        if (player.sessionId === sessionId) {
            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = player.playertag;
            nameInput.disabled = true;
            const editButton = document.createElement('button');
            editButton.textContent = 'Edit';
            let isEditing = false;
            editButton.addEventListener('click', () => {
                if (isEditing) {
                    const newPlayertag = nameInput.value;
                    socket.emit('renamePlayer', { sessionId, newPlayertag });
                    nameInput.disabled = true;
                    editButton.textContent = 'Edit';
                    isEditing = false;
                } else {
                    nameInput.disabled = false;
                    nameInput.focus();
                    editButton.textContent = 'Confirm';
                    isEditing = true;
                }
            });
            li.appendChild(nameInput);
            li.appendChild(editButton);
        } else {
            li.textContent = player.playertag;
        }

        if (player.isHost) {
            li.classList.add('host');
            if (player.sessionId === sessionId) {
                isHost = true;
            }
        }
        playerList.appendChild(li);
    });

    // Show the "Start Game" button only if the current user is the host
    const startGameBtn = document.getElementById('startGameBtn');
    if (isHost) {
        startGameBtn.style.display = 'block';
    } else {
        startGameBtn.style.display = 'none';
    }
});

socket.on('errorMessage', (message) => {
    alert(message);
    console.log(`Error: ${message}`);
});

document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
    const sessionId = getSessionId();
    socket.emit('leaveLobby', { lobbyId: currentLobbyId, sessionId });
    switchToMainMenu();
});

document.getElementById('submitplayertagBtn').addEventListener('click', () => {
    const playertag = document.getElementById('playertagInput').value.trim();
    if (playertag) {
        const sessionId = saveSession(playertag);
        console.log(`Joining lobby ${currentLobbyId} with playertag: ${playertag}, session: ${sessionId}`);
        socket.emit('joinLobby', { lobbyId: currentLobbyId, playertag, sessionId });
        switchToLobby(currentLobbyId);
    } else {
        alert("Please enter a valid player tag!");
    }
});

window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const lobbyId = urlParams.get('lobbyId');
    let sessionId = getSessionId();
    let playertag = getSavedplayertag();
    if (lobbyId) {
        currentLobbyId = lobbyId;
        if (!playertag) {
            switchToplayertagInput();
        } else {
            console.log(`Joining lobby ${lobbyId} with playertag: ${playertag}, session: ${sessionId}`);
            socket.emit('joinLobby', { lobbyId, playertag, sessionId });
            switchToLobby(lobbyId);
        }
    }
};

// Game Logic

document.getElementById('startGameBtn').addEventListener('click', () => {
    socket.emit('startGame', { lobbyId: currentLobbyId });
});

socket.on('enterCategories', () => {
    // Hide other sections and show the category input
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('enterCategory').style.display = 'block';
});

document.getElementById('submitCategoryBtn').addEventListener('click', () => {
    const category = document.getElementById('categoryInput').value.trim();
    if (category) {
        socket.emit('submitCategory', {
            lobbyId: currentLobbyId,
            sessionId: getSessionId(),
            category
        });
        document.getElementById('enterCategory').style.display = 'none';
        document.getElementById('loadingIndicator').style.display = 'block';
        // Optionally, show a waiting message
    } else {
        alert('Please enter a category.');
    }
});

// Handle the start of the answer phase
socket.on('startAnswerPhase', ({ categories, letter }) => {
    // Hide other sections and show the answers input
    document.getElementById('enterCategory').style.display = 'none';
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('answerPhase').style.display = 'block';
    document.getElementById('randomLetterDisplay').textContent = letter;

    const answersForm = document.getElementById('answersForm');
    answersForm.innerHTML = '';
    categories.forEach((category, index) => {
        const div = document.createElement('div');
        div.innerHTML = `
            <label>${category}</label>
            <input type="text" name="answer${index}" required data-letter="${letter.toLowerCase()}">
            <span class="validation-message"></span>
        `;
        answersForm.appendChild(div);
    });

    // Add input event listeners for client-side validation
    const inputs = answersForm.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            const requiredLetter = input.dataset.letter;
            const value = input.value.trim().toLowerCase();
            const validationMessage = input.nextElementSibling;

            if (value && !value.startsWith(requiredLetter)) {
                validationMessage.textContent = `Answer must start with "${requiredLetter.toUpperCase()}"`;
            } else {
                validationMessage.textContent = '';
            }
        });
    });
});

// When submitting answers
document.getElementById('submitAnswersBtn').addEventListener('click', () => {
    const formData = new FormData(document.getElementById('answersForm'));
    const answers = {};
    let allValid = true;

    formData.forEach((value, key) => {
        const input = document.querySelector(`input[name="${key}"]`);
        const requiredLetter = input.dataset.letter;
        const valueTrimmed = value.trim();
        if (valueTrimmed && !valueTrimmed.toLowerCase().startsWith(requiredLetter)) {
            allValid = false;
            input.nextElementSibling.textContent = `Answer must start with "${requiredLetter.toUpperCase()}"`;
        } else {
            input.nextElementSibling.textContent = '';
        }
        answers[key] = valueTrimmed;
    });

    if (allValid) {
        socket.emit('submitAnswers', {
            lobbyId: currentLobbyId,
            sessionId: getSessionId(),
            answers
        });
        document.getElementById('answerPhase').style.display = 'none';
        document.getElementById('loadingIndicator').style.display = 'block';
        // Optionally, show a waiting message
    }
});

// When showing results
socket.on('showResults', ({ answers, categories, players, scores, letter }) => {
    // Hide other sections and show the results
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('answerPhase').style.display = 'none';
    document.getElementById('resultsPhase').style.display = 'block';

    const resultsTable = document.getElementById('resultsTable');
    resultsTable.innerHTML = '';

    // Generate table headers
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Player</th>';
    categories.forEach(c => {
        const th = document.createElement('th');
        th.textContent = c.category;
        headerRow.appendChild(th);
    });
    // Add a column for scores
    headerRow.innerHTML += '<th>Score</th>';
    resultsTable.appendChild(headerRow);

    // Generate rows for each player
    players.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${player.playertag}</td>`;
        categories.forEach((_, index) => {
            const td = document.createElement('td');
            let answerText = answers[player.sessionId][`answer${index}`];
            if (!answerText) {
                answerText = '---';
            }

            // Highlight invalid answers
            if (answerText.startsWith('Invalid')) {
                td.classList.add('invalid-answer');
            }

            td.textContent = answerText;
            row.appendChild(td);
        });
        // Display the player's score
        const scoreTd = document.createElement('td');
        scoreTd.textContent = scores[player.sessionId] || 0;
        row.appendChild(scoreTd);

        resultsTable.appendChild(row);
    });
});

document.getElementById('backToLobbyBtn').addEventListener('click', () => {
    // Reset game state and go back to lobby
    document.getElementById('resultsPhase').style.display = 'none';
    document.getElementById('lobby').style.display = 'block';
    socket.emit('backToLobby', { lobbyId: currentLobbyId });
});

socket.on('backToLobby', () => {
    // Reset any game-specific UI elements if necessary
    document.getElementById('resultsPhase').style.display = 'none';
    document.getElementById('lobby').style.display = 'block';
});
