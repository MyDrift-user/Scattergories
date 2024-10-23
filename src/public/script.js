const socket = io();

let currentLobbyId = '';  // Store current lobby ID after creation

// Save session ID and playertag to localStorage
function saveSession(playertag) {
    const sessionId = localStorage.getItem('sessionId') || generateSessionId();
    localStorage.setItem('sessionId', sessionId);
    localStorage.setItem('playertag', playertag);
    return sessionId;
}

// Retrieve session ID from localStorage
function getSessionId() {
    return localStorage.getItem('sessionId');
}

// Retrieve playertag from localStorage
function getSavedplayertag() {
    return localStorage.getItem('playertag');
}

// Generate a random session ID (persistent per browser session)
function generateSessionId() {
    return 'xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Copy text to clipboard
function copyToClipboard(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
}

// Switch to the lobby view (hide main menu, show lobby)
function switchToLobby(lobbyId) {
    document.getElementById('mainMenu').style.display = 'none';  // Hide the main menu
    document.getElementById('enterplayertag').style.display = 'none';  // Hide playertag input form
    document.getElementById('lobby').style.display = 'block';  // Show the lobby

    document.getElementById('lobbyIdDisplay').textContent = lobbyId;  // Display the lobby ID

    // Update the URL with the lobby ID, without reloading the page
    history.pushState(null, '', `/?lobbyId=${lobbyId}`);
}

// Copy Lobby ID to Clipboard
document.getElementById('copyLobbyIdBtn').addEventListener('click', () => {
    const lobbyId = document.getElementById('lobbyIdDisplay').textContent;
    copyToClipboard(lobbyId);
});

// Copy Lobby Link to Clipboard
document.getElementById('copyLobbyLinkBtn').addEventListener('click', () => {
    const lobbyId = document.getElementById('lobbyIdDisplay').textContent;
    const lobbyLink = `${window.location.origin}/?lobbyId=${lobbyId}`;
    copyToClipboard(lobbyLink);
});

// Switch to the playertag input view
function switchToplayertagInput() {
    document.getElementById('mainMenu').style.display = 'none';  // Hide main menu
    document.getElementById('enterplayertag').style.display = 'block';  // Show playertag input form
}

// Switch to the main menu (hide lobby, show main menu)
function switchToMainMenu() {
    document.getElementById('mainMenu').style.display = 'block';  // Show the main menu
    document.getElementById('lobby').style.display = 'none';  // Hide the lobby
    document.getElementById('enterplayertag').style.display = 'none';  // Hide playertag input form

    // Reset the URL to the base path
    history.pushState(null, '', `/`);
}

// Create a new lobby
document.getElementById('createLobbyBtn').addEventListener('click', () => {
    const playertag = getSavedplayertag() || prompt("Enter your player tag to create a lobby:");
    if (playertag) {
        const sessionId = saveSession(playertag);  // Save session ID and playertag
        console.log(`Creating lobby with playertag: ${playertag}, session: ${sessionId}`);
        socket.emit('createLobby', { playertag, sessionId });
    }
});

// Join an existing lobby from the homepage form
document.getElementById('joinLobbyBtn').addEventListener('click', () => {
    const lobbyId = getTextFromEditableDiv('lobbyIdField');  // Get lobby ID from text input
    if (lobbyId) {
        currentLobbyId = lobbyId;  // Store lobby ID for later use
        console.log(`Trying to join lobby with ID: ${lobbyId}`);

        // Check if the playertag is already saved
        let playertag = getSavedplayertag();
        if (playertag) {
            // If playertag is already saved, join the lobby immediately
            const sessionId = getSessionId();
            console.log(`Joining lobby ${lobbyId} with saved playertag: ${playertag}, session: ${sessionId}`);
            socket.emit('joinLobby', { lobbyId, playertag, sessionId });
            switchToLobby(lobbyId);  // Switch to the lobby view
        } else {
            // If no playertag is saved, prompt for playertag
            switchToplayertagInput();
        }
    } else {
        alert("Please enter a valid lobby ID!");
    }
});

// Handle lobby creation, show playertag input form
socket.on('lobbyCreated', (lobbyId) => {
    console.log(`Lobby created with ID: ${lobbyId}`);
    currentLobbyId = lobbyId;  // Store the lobby ID for later
    switchToplayertagInput();  // Prompt the lobby creator for their playertag
});

// Handle joining a lobby and switch to lobby view
socket.on('lobbyJoined', (lobbyId) => {
    console.log(`Joined lobby with ID: ${lobbyId}`);
    switchToLobby(lobbyId);  // Switch to lobby view dynamically
});

// Handle rejoining a lobby
socket.on('rejoinLobby', (lobbyId) => {
    console.log(`Rejoined lobby with ID: ${lobbyId}`);
    switchToLobby(lobbyId);  // Switch to lobby view dynamically
});

// Update player list when receiving the 'updateLobby' event
socket.on('updateLobby', (players) => {
    const playerList = document.getElementById('playerList');
    playerList.innerHTML = '';  // Clear the player list

    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.playertag;  // Just the player's name, no extra text

        // Apply the host class to the host's username
        if (player.isHost) {
            li.classList.add('host');
        }

        playerList.appendChild(li);  // Add player to the list
    });

    console.log('Updated player list:', players);
});

// Handle error messages
socket.on('errorMessage', (message) => {
    alert(message);
    console.log(`Error: ${message}`);
});

// Leave the lobby and switch back to the main menu
document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
    const sessionId = getSessionId();
    socket.emit('leaveLobby', { lobbyId: currentLobbyId, sessionId });  // Notify server to remove the player
    switchToMainMenu();  // Switch back to the main menu
});

// Handle playertag submission for both creator and joiners
document.getElementById('submitplayertagBtn').addEventListener('click', () => {
    const playertag = document.getElementById('playertagInput').value;
    if (playertag) {
        const sessionId = saveSession(playertag);  // Save the playertag and session ID
        console.log(`Joining lobby ${currentLobbyId} with playertag: ${playertag}, session: ${sessionId}`);
        socket.emit('joinLobby', { lobbyId: currentLobbyId, playertag, sessionId });

        // Switch to the lobby view after the user submits their playertag
        switchToLobby(currentLobbyId);
    }
});

// Check for a lobbyId in the URL and handle playertag entry
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const lobbyId = urlParams.get('lobbyId');
    let sessionId = getSessionId();
    let playertag = getSavedplayertag();

    if (lobbyId) {
        currentLobbyId = lobbyId;  // Store the lobby ID for later use

        // If no playertag is saved, show the playertag input form
        if (!playertag) {
            switchToplayertagInput();  // Prompt the user for a playertag
        } else {
            // If playertag is already saved, join the lobby immediately
            console.log(`Joining lobby ${lobbyId} with playertag: ${playertag}, session: ${sessionId}`);
            socket.emit('joinLobby', { lobbyId, playertag, sessionId });
            switchToLobby(lobbyId);  // Switch to lobby view directly
        }
    }
};
