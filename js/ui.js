// UI Module - Handles terminal output and UI interactions
export function initializeUI() {
    const output = document.getElementById('terminal-output');
    const input = document.getElementById('command-input');
    const userInfo = document.getElementById('user-info');
    
    // Terminal output function
    function logToTerminal(message, cssClass = 'game') {
        const line = document.createElement('div');
        line.className = cssClass;
        line.innerHTML = message;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }
    
    // Update user info display
    function updateUserInfo(playerName, hp, maxHp, level, roomName) {
        const hpPercent = Math.round((hp / maxHp) * 100);
        let hpColor = '#00ff41';
        if (hpPercent < 30) hpColor = '#ff4444';
        else if (hpPercent < 70) hpColor = '#ffaa00';
        
        userInfo.innerHTML = `
            <span class="text-cyan-400">${playerName}</span> | 
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
