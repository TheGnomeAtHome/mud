// player-trading.js - Player-to-Player Trading System
// Handles secure trades between players

import { auth, db } from './firebase-init.js';
import { doc, getDoc, updateDoc, setDoc, deleteDoc, arrayUnion, arrayRemove, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { logToTerminal } from './ui.js';
import { APP_ID } from './config.js';
import { gameItems, gamePlayers } from './data-loader.js';
import { broadcastToRoom } from './game.js';

// Trade session structure
class TradeSession {
    constructor(initiatorId, partnerId, roomId) {
        this.id = `${initiatorId}_${partnerId}_${Date.now()}`;
        this.initiatorId = initiatorId;
        this.partnerId = partnerId;
        this.roomId = roomId;
        this.initiatorOffer = { items: [], gold: 0, confirmed: false };
        this.partnerOffer = { items: [], gold: 0, confirmed: false };
        this.status = 'pending'; // pending, active, completed, cancelled
        this.createdAt = Date.now();
        this.timeout = null;
    }
}

// Active trade sessions
export const activeTrades = new Map();

// Trade listeners for real-time updates
const tradeListeners = new Map();

// ===== TRADE INITIATION =====

/**
 * Request trade with another player
 */
export async function initiatePlayerTrade(initiatorId, partnerName, currentRoomId) {
    try {
        // Find partner in same room
        const partner = Object.values(gamePlayers).find(p => 
            p.name.toLowerCase() === partnerName.toLowerCase() && 
            p.currentRoom === currentRoomId &&
            p.userId !== initiatorId
        );
        
        if (!partner) {
            logToTerminal(`${partnerName} is not here.`, 'error');
            return false;
        }
        
        // Check if either player is already trading
        if (isPlayerTrading(initiatorId)) {
            logToTerminal("You're already in a trade. Cancel it first with 'cancel trade'.", 'error');
            return false;
        }
        
        if (isPlayerTrading(partner.userId)) {
            logToTerminal(`${partner.name} is already trading with someone else.`, 'error');
            return false;
        }
        
        // Create trade session
        const session = new TradeSession(initiatorId, partner.userId, currentRoomId);
        
        // Store in Firestore for persistence
        const tradeRef = doc(db, `artifacts/${APP_ID}/public/data/mud-active-trades`, session.id);
        await setDoc(tradeRef, {
            initiatorId,
            partnerId: partner.userId,
            roomId: currentRoomId,
            initiatorOffer: session.initiatorOffer,
            partnerOffer: session.partnerOffer,
            status: 'pending',
            createdAt: session.createdAt
        });
        
        // Store locally
        activeTrades.set(session.id, session);
        
        // Set timeout
        session.timeout = setTimeout(() => {
            cancelPlayerTrade(initiatorId, 'timeout');
        }, 60000); // 60 second timeout for acceptance
        
        // Notify both players
        const initiatorPlayer = gamePlayers[initiatorId];
        logToTerminal(`<span class="text-yellow-400">You request to trade with ${partner.name}.</span>`, 'system');
        
        // Notify partner (they'll see this via their game listener)
        broadcastToRoom(currentRoomId, 
            `<span class="text-yellow-400">${initiatorPlayer.name} wants to trade with ${partner.name}.</span>`,
            'system',
            partner.userId
        );
        
        logToTerminal(`Waiting for ${partner.name} to respond... (60 seconds)`, 'info');
        logToTerminal(`${partner.name}: Type "accept trade" or "decline trade"`, 'info', partner.userId);
        
        return session.id;
    } catch (error) {
        console.error('Error initiating trade:', error);
        logToTerminal('Failed to initiate trade.', 'error');
        return false;
    }
}

/**
 * Accept trade request
 */
export async function acceptTradeRequest(playerId) {
    // Find pending trade where player is the partner
    const session = Array.from(activeTrades.values()).find(s => 
        s.partnerId === playerId && s.status === 'pending'
    );
    
    if (!session) {
        logToTerminal("You don't have any pending trade requests.", 'error');
        return false;
    }
    
    // Clear timeout
    if (session.timeout) {
        clearTimeout(session.timeout);
    }
    
    // Update status
    session.status = 'active';
    
    // Update in Firestore
    const tradeRef = doc(db, `artifacts/${APP_ID}/public/data/mud-active-trades`, session.id);
    await updateDoc(tradeRef, { status: 'active' });
    
    // Set new timeout for trade completion (5 minutes)
    session.timeout = setTimeout(() => {
        cancelPlayerTrade(playerId, 'timeout');
    }, 300000);
    
    // Notify both players
    const initiator = gamePlayers[session.initiatorId];
    const partner = gamePlayers[session.partnerId];
    
    logToTerminal(`<span class="text-green-400">You accept the trade with ${initiator.name}.</span>`, 'system');
    logToTerminal(`<span class="text-green-400">${partner.name} accepted your trade request!</span>`, 'system', session.initiatorId);
    
    // Show trade UI
    displayTradeWindow(session.initiatorId, session);
    displayTradeWindow(session.partnerId, session);
    
    return true;
}

/**
 * Decline trade request
 */
export async function declineTradeRequest(playerId) {
    const session = Array.from(activeTrades.values()).find(s => 
        s.partnerId === playerId && s.status === 'pending'
    );
    
    if (!session) {
        logToTerminal("You don't have any pending trade requests.", 'error');
        return false;
    }
    
    const initiator = gamePlayers[session.initiatorId];
    
    logToTerminal(`You decline the trade with ${initiator.name}.`, 'system');
    logToTerminal(`${gamePlayers[playerId].name} declined your trade request.`, 'system', session.initiatorId);
    
    await cancelPlayerTrade(playerId, 'declined');
    return true;
}

// ===== TRADE MANAGEMENT =====

/**
 * Add item to trade offer
 */
export async function offerTradeItem(playerId, itemName) {
    const session = getPlayerTradeSession(playerId);
    if (!session) {
        logToTerminal("You're not currently trading.", 'error');
        return false;
    }
    
    if (session.status !== 'active') {
        logToTerminal("Wait for the other player to accept first.", 'error');
        return false;
    }
    
    // Get player data
    const playerRef = doc(db, `artifacts/${APP_ID}/public/data/mud-players`, playerId);
    const playerDoc = await getDoc(playerRef);
    const playerData = playerDoc.data();
    
    // Find item in inventory
    const item = playerData.inventory.find(i => 
        i.name.toLowerCase().includes(itemName.toLowerCase()) ||
        i.id === itemName.toLowerCase()
    );
    
    if (!item) {
        logToTerminal(`You don't have "${itemName}" in your inventory.`, 'error');
        return false;
    }
    
    // Check if item is tradeable
    const itemData = gameItems[item.id];
    if (itemData && itemData.bound) {
        logToTerminal(`${item.name} is bound to you and cannot be traded.`, 'error');
        return false;
    }
    
    if (itemData && itemData.tradeable === false) {
        logToTerminal(`${item.name} cannot be traded.`, 'error');
        return false;
    }
    
    // Add to offer
    const isInitiator = session.initiatorId === playerId;
    const offer = isInitiator ? session.initiatorOffer : session.partnerOffer;
    
    // Check if already offered
    if (offer.items.some(i => i.id === item.id)) {
        logToTerminal(`You've already offered ${item.name}.`, 'error');
        return false;
    }
    
    offer.items.push(item);
    offer.confirmed = false; // Reset confirmation when offer changes
    
    // Reset other player's confirmation too
    if (isInitiator) {
        session.partnerOffer.confirmed = false;
    } else {
        session.initiatorOffer.confirmed = false;
    }
    
    // Update in Firestore
    const tradeRef = doc(db, `artifacts/${APP_ID}/public/data/mud-active-trades`, session.id);
    await updateDoc(tradeRef, {
        initiatorOffer: session.initiatorOffer,
        partnerOffer: session.partnerOffer
    });
    
    logToTerminal(`<span class="text-cyan-400">You add ${item.name} to the trade.</span>`, 'system');
    
    // Update trade windows
    displayTradeWindow(session.initiatorId, session);
    displayTradeWindow(session.partnerId, session);
    
    return true;
}

/**
 * Add gold to trade offer
 */
export async function offerTradeGold(playerId, amount) {
    const session = getPlayerTradeSession(playerId);
    if (!session) {
        logToTerminal("You're not currently trading.", 'error');
        return false;
    }
    
    if (amount < 0) {
        logToTerminal("Nice try, but you can't offer negative gold.", 'error');
        return false;
    }
    
    // Check if player has enough gold
    const playerRef = doc(db, `artifacts/${APP_ID}/public/data/mud-players`, playerId);
    const playerDoc = await getDoc(playerRef);
    const playerData = playerDoc.data();
    const playerGold = playerData.money || 0;
    
    if (amount > playerGold) {
        logToTerminal(`You only have ${playerGold} gold.`, 'error');
        return false;
    }
    
    // Update offer
    const isInitiator = session.initiatorId === playerId;
    const offer = isInitiator ? session.initiatorOffer : session.partnerOffer;
    
    offer.gold = amount;
    offer.confirmed = false;
    
    // Reset confirmations
    session.initiatorOffer.confirmed = false;
    session.partnerOffer.confirmed = false;
    
    // Update in Firestore
    const tradeRef = doc(db, `artifacts/${APP_ID}/public/data/mud-active-trades`, session.id);
    await updateDoc(tradeRef, {
        initiatorOffer: session.initiatorOffer,
        partnerOffer: session.partnerOffer
    });
    
    logToTerminal(`<span class="text-cyan-400">You offer ${amount} gold.</span>`, 'system');
    
    // Update trade windows
    displayTradeWindow(session.initiatorId, session);
    displayTradeWindow(session.partnerId, session);
    
    return true;
}

/**
 * Remove item from offer
 */
export async function removeTradeItem(playerId, itemName) {
    const session = getPlayerTradeSession(playerId);
    if (!session) return false;
    
    const isInitiator = session.initiatorId === playerId;
    const offer = isInitiator ? session.initiatorOffer : session.partnerOffer;
    
    const itemIndex = offer.items.findIndex(i => 
        i.name.toLowerCase().includes(itemName.toLowerCase()) ||
        i.id === itemName.toLowerCase()
    );
    
    if (itemIndex === -1) {
        logToTerminal(`You haven't offered "${itemName}".`, 'error');
        return false;
    }
    
    const removedItem = offer.items.splice(itemIndex, 1)[0];
    offer.confirmed = false;
    session.initiatorOffer.confirmed = false;
    session.partnerOffer.confirmed = false;
    
    // Update in Firestore
    const tradeRef = doc(db, `artifacts/${APP_ID}/public/data/mud-active-trades`, session.id);
    await updateDoc(tradeRef, {
        initiatorOffer: session.initiatorOffer,
        partnerOffer: session.partnerOffer
    });
    
    logToTerminal(`<span class="text-cyan-400">You remove ${removedItem.name} from the trade.</span>`, 'system');
    
    displayTradeWindow(session.initiatorId, session);
    displayTradeWindow(session.partnerId, session);
    
    return true;
}

/**
 * Confirm trade offer
 */
export async function confirmTrade(playerId) {
    const session = getPlayerTradeSession(playerId);
    if (!session) {
        logToTerminal("You're not currently trading.", 'error');
        return false;
    }
    
    const isInitiator = session.initiatorId === playerId;
    const offer = isInitiator ? session.initiatorOffer : session.partnerOffer;
    const otherOffer = isInitiator ? session.partnerOffer : session.initiatorOffer;
    
    offer.confirmed = true;
    
    // Update in Firestore
    const tradeRef = doc(db, `artifacts/${APP_ID}/public/data/mud-active-trades`, session.id);
    await updateDoc(tradeRef, {
        initiatorOffer: session.initiatorOffer,
        partnerOffer: session.partnerOffer
    });
    
    logToTerminal(`<span class="text-green-400">You confirm the trade.</span>`, 'system');
    
    const otherPlayerId = isInitiator ? session.partnerId : session.initiatorId;
    const playerName = gamePlayers[playerId].name;
    logToTerminal(`<span class="text-yellow-400">${playerName} has confirmed the trade.</span>`, 'system', otherPlayerId);
    
    // If both confirmed, execute trade
    if (session.initiatorOffer.confirmed && session.partnerOffer.confirmed) {
        await executeTrade(session);
    } else {
        logToTerminal("Waiting for other player to confirm...", 'info');
    }
    
    displayTradeWindow(session.initiatorId, session);
    displayTradeWindow(session.partnerId, session);
    
    return true;
}

/**
 * Execute the trade (atomic operation)
 */
async function executeTrade(session) {
    try {
        const initiatorRef = doc(db, `artifacts/${APP_ID}/public/data/mud-players`, session.initiatorId);
        const partnerRef = doc(db, `artifacts/${APP_ID}/public/data/mud-players`, session.partnerId);
        
        const initiatorDoc = await getDoc(initiatorRef);
        const partnerDoc = await getDoc(partnerRef);
        
        const initiatorData = initiatorDoc.data();
        const partnerData = partnerDoc.data();
        
        // Verify both players have what they offered
        const initiatorGold = initiatorData.money || 0;
        const partnerGold = partnerData.money || 0;
        
        if (initiatorGold < session.initiatorOffer.gold) {
            logToTerminal("Trade failed: Insufficient gold.", 'error', session.initiatorId);
            logToTerminal(`${gamePlayers[session.initiatorId].name} doesn't have enough gold.`, 'error', session.partnerId);
            await cancelPlayerTrade(session.initiatorId, 'failed');
            return false;
        }
        
        if (partnerGold < session.partnerOffer.gold) {
            logToTerminal("Trade failed: Insufficient gold.", 'error', session.partnerId);
            logToTerminal(`${gamePlayers[session.partnerId].name} doesn't have enough gold.`, 'error', session.initiatorId);
            await cancelPlayerTrade(session.partnerId, 'failed');
            return false;
        }
        
        // Execute transfers
        // Initiator gives to Partner
        for (const item of session.initiatorOffer.items) {
            await updateDoc(initiatorRef, {
                inventory: arrayRemove(item)
            });
            await updateDoc(partnerRef, {
                inventory: arrayUnion(item)
            });
        }
        
        // Partner gives to Initiator
        for (const item of session.partnerOffer.items) {
            await updateDoc(partnerRef, {
                inventory: arrayRemove(item)
            });
            await updateDoc(initiatorRef, {
                inventory: arrayUnion(item)
            });
        }
        
        // Exchange gold
        await updateDoc(initiatorRef, {
            money: initiatorGold - session.initiatorOffer.gold + session.partnerOffer.gold
        });
        
        await updateDoc(partnerRef, {
            money: partnerGold - session.partnerOffer.gold + session.initiatorOffer.gold
        });
        
        // Notify players
        const initiatorName = gamePlayers[session.initiatorId].name;
        const partnerName = gamePlayers[session.partnerId].name;
        
        logToTerminal(`<span class="text-green-400 font-bold">✅ Trade complete with ${partnerName}!</span>`, 'system', session.initiatorId);
        logToTerminal(`<span class="text-green-400 font-bold">✅ Trade complete with ${initiatorName}!</span>`, 'system', session.partnerId);
        
        // Show what was received
        if (session.partnerOffer.items.length > 0 || session.partnerOffer.gold > 0) {
            const itemNames = session.partnerOffer.items.map(i => i.name).join(', ');
            const goldText = session.partnerOffer.gold > 0 ? `${session.partnerOffer.gold} gold` : '';
            const received = [itemNames, goldText].filter(x => x).join(', ');
            logToTerminal(`You received: ${received}`, 'system', session.initiatorId);
        }
        
        if (session.initiatorOffer.items.length > 0 || session.initiatorOffer.gold > 0) {
            const itemNames = session.initiatorOffer.items.map(i => i.name).join(', ');
            const goldText = session.initiatorOffer.gold > 0 ? `${session.initiatorOffer.gold} gold` : '';
            const received = [itemNames, goldText].filter(x => x).join(', ');
            logToTerminal(`You received: ${received}`, 'system', session.partnerId);
        }
        
        // Clean up
        session.status = 'completed';
        const tradeRef = doc(db, `artifacts/${APP_ID}/public/data/mud-active-trades`, session.id);
        await deleteDoc(tradeRef);
        
        activeTrades.delete(session.id);
        
        if (session.timeout) {
            clearTimeout(session.timeout);
        }
        
        return true;
    } catch (error) {
        console.error('Error executing trade:', error);
        logToTerminal('Trade failed due to an error.', 'error', session.initiatorId);
        logToTerminal('Trade failed due to an error.', 'error', session.partnerId);
        return false;
    }
}

/**
 * Cancel ongoing trade
 */
export async function cancelPlayerTrade(playerId, reason = 'cancelled') {
    const session = getPlayerTradeSession(playerId);
    if (!session) {
        logToTerminal("You're not in a trade.", 'error');
        return false;
    }
    
    const initiatorName = gamePlayers[session.initiatorId]?.name || 'Player';
    const partnerName = gamePlayers[session.partnerId]?.name || 'Player';
    
    const messages = {
        cancelled: 'Trade cancelled.',
        timeout: 'Trade timed out.',
        moved: 'Trade cancelled (player moved rooms).',
        declined: 'Trade declined.',
        failed: 'Trade failed.'
    };
    
    const message = messages[reason] || messages.cancelled;
    
    logToTerminal(message, 'system', session.initiatorId);
    logToTerminal(message, 'system', session.partnerId);
    
    // Clean up
    session.status = 'cancelled';
    const tradeRef = doc(db, `artifacts/${APP_ID}/public/data/mud-active-trades`, session.id);
    await deleteDoc(tradeRef);
    
    activeTrades.delete(session.id);
    
    if (session.timeout) {
        clearTimeout(session.timeout);
    }
    
    return true;
}

// ===== UTILITY FUNCTIONS =====

function isPlayerTrading(playerId) {
    return Array.from(activeTrades.values()).some(s => 
        (s.initiatorId === playerId || s.partnerId === playerId) &&
        (s.status === 'pending' || s.status === 'active')
    );
}

function getPlayerTradeSession(playerId) {
    return Array.from(activeTrades.values()).find(s => 
        (s.initiatorId === playerId || s.partnerId === playerId) &&
        (s.status === 'pending' || s.status === 'active')
    );
}

/**
 * Display trade window to player
 */
function displayTradeWindow(playerId, session) {
    const isInitiator = session.initiatorId === playerId;
    const myOffer = isInitiator ? session.initiatorOffer : session.partnerOffer;
    const theirOffer = isInitiator ? session.partnerOffer : session.initiatorOffer;
    
    const initiatorName = gamePlayers[session.initiatorId]?.name || 'Player 1';
    const partnerName = gamePlayers[session.partnerId]?.name || 'Player 2';
    const otherPlayerName = isInitiator ? partnerName : initiatorName;
    
    logToTerminal(`<div class="border-2 border-cyan-400 p-4 my-2 bg-black bg-opacity-50">`, 'system', playerId);
    logToTerminal(`<div class="text-center text-xl text-cyan-400 mb-4">Trading with ${otherPlayerName}</div>`, 'system', playerId);
    
    logToTerminal(`<div class="grid grid-cols-2 gap-4">`, 'system', playerId);
    
    // Your offer
    logToTerminal(`<div class="border border-green-400 p-2">`, 'system', playerId);
    logToTerminal(`<div class="text-green-400 font-bold mb-2">Your Offer ${myOffer.confirmed ? '✅' : ''}</div>`, 'system', playerId);
    
    if (myOffer.items.length === 0 && myOffer.gold === 0) {
        logToTerminal(`<div class="text-gray-500">Nothing offered yet</div>`, 'system', playerId);
    } else {
        myOffer.items.forEach(item => {
            logToTerminal(`<div>• ${item.name}</div>`, 'system', playerId);
        });
        if (myOffer.gold > 0) {
            logToTerminal(`<div>• ${myOffer.gold} gold</div>`, 'system', playerId);
        }
    }
    logToTerminal(`</div>`, 'system', playerId);
    
    // Their offer
    logToTerminal(`<div class="border border-yellow-400 p-2">`, 'system', playerId);
    logToTerminal(`<div class="text-yellow-400 font-bold mb-2">Their Offer ${theirOffer.confirmed ? '✅' : ''}</div>`, 'system', playerId);
    
    if (theirOffer.items.length === 0 && theirOffer.gold === 0) {
        logToTerminal(`<div class="text-gray-500">Nothing offered yet</div>`, 'system', playerId);
    } else {
        theirOffer.items.forEach(item => {
            logToTerminal(`<div>• ${item.name}</div>`, 'system', playerId);
        });
        if (theirOffer.gold > 0) {
            logToTerminal(`<div>• ${theirOffer.gold} gold</div>`, 'system', playerId);
        }
    }
    logToTerminal(`</div>`, 'system', playerId);
    
    logToTerminal(`</div>`, 'system', playerId);
    logToTerminal(`</div>`, 'system', playerId);
    
    // Commands
    if (!myOffer.confirmed) {
        logToTerminal(`💡 offer <item> | offer <amount> gold | confirm trade | cancel trade`, 'info', playerId);
    } else {
        logToTerminal(`⏳ Waiting for ${otherPlayerName} to confirm...`, 'info', playerId);
    }
}

export {
    TradeSession,
    isPlayerTrading,
    getPlayerTradeSession,
    displayTradeWindow
};
