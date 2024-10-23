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
    const lobbyId = getTextFromEditableDiv('lobbyIdField');
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
    const playertag = document.getElementById('playertagInput').value;
    if (playertag) {
        const sessionId = saveSession(playertag);
        console.log(`Joining lobby ${currentLobbyId} with playertag: ${playertag}, session: ${sessionId}`);
        socket.emit('joinLobby', { lobbyId: currentLobbyId, playertag, sessionId });
        switchToLobby(currentLobbyId);
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