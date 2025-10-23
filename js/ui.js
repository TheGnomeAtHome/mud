// UI Module - Handles terminal output and UI interactions

// DOM elements
const output = document.getElementById('terminal-output');
const input = document.getElementById('command-input');
const userInfo = document.getElementById('user-info');

// Terminal output function (exported for use in other modules)
export function logToTerminal(message, cssClass = 'game') {
    const line = document.createElement('div');
    line.className = cssClass;
    line.innerHTML = message;
    
    // Add ARIA live region attribute for combat and urgent messages in screen reader mode
    const screenReaderMode = localStorage.getItem('screenReaderMode') === 'true';
    if (screenReaderMode) {
        // Combat, error, and urgent messages should be assertive (interrupt immediately)
        if (cssClass === 'combat' || cssClass === 'combat-log' || cssClass === 'error' || cssClass === 'success') {
            line.setAttribute('aria-live', 'assertive');
        } else {
            // Other messages are polite (wait for pause)
            line.setAttribute('aria-live', 'polite');
        }
    }
    
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

export function initializeUI() {
    
    // Update user info display
    function updateUserInfo(playerName, hp, maxHp, level, roomName, playerClass = '', playerRace = '') {
        const hpPercent = Math.round((hp / maxHp) * 100);
        let hpColor = '#00ff41';
        if (hpPercent < 30) hpColor = '#ff4444';
        else if (hpPercent < 70) hpColor = '#ffaa00';
        
        let classRaceInfo = '';
        if (playerRace || playerClass) {
            classRaceInfo = ` | <span class="text-purple-400">${playerRace || 'Human'} ${playerClass || 'Adventurer'}</span>`;
        }
        
        userInfo.innerHTML = `
            <span class="text-cyan-400">${playerName}</span>${classRaceInfo} | 
            Level: <span class="text-yellow-400">${level}</span> | 
            HP: <span style="color: ${hpColor}">${hp}/${maxHp}</span> | 
            Room: <span class="text-green-400">${roomName}</span>
        `;
    }
    
    // Clear terminal
    function clearTerminal() {
        output.innerHTML = '';
    }
    
    // Focus input
    function focusInput() {
        input.focus();
    }
    
    // Enable/disable input
    function setInputEnabled(enabled) {
        input.disabled = !enabled;
        if (enabled) focusInput();
    }
    
    return {
        logToTerminal,
        updateUserInfo,
        clearTerminal,
        focusInput,
        setInputEnabled,
        input,
        output,
        userInfo
    };
}
