// trading.js - Advanced Trading System Module
// Handles buying, selling, haggling, and player-to-player trades

import { auth, db } from './firebase-init.js';
import { doc, getDoc, updateDoc, setDoc, deleteDoc, arrayUnion, arrayRemove, increment } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { logToTerminal } from './ui.js';
import { APP_ID } from './config.js';
import { gameItems, gameNpcs, gamePlayers } from './data-loader.js';
import { callGeminiForText } from './ai.js';

// ===== CONFIGURATION =====
export const TRADE_SETTINGS = {
    DEFAULT_BUY_RATE: 0.40,        // NPCs pay 40% of item value by default
    HAGGLE_ATTEMPTS: 3,             // Max haggle attempts per transaction
    TRADE_TIMEOUT: 60000,           // Trade timeout in ms (60 seconds)
    REPUTATION_DECAY: 0.01,         // Daily reputation decay
    PRICE_VOLATILITY: 0.10,         // Price fluctuation range
    BULK_DISCOUNT_THRESHOLD: 5,     // Items needed for bulk discount
    BULK_DISCOUNT_RATE: 0.10,       // 10% off bulk purchases
    CRITICAL_SUCCESS_CHANCE: 0.05,  // 5% chance of amazing deal
    CRITICAL_FAILURE_CHANCE: 0.05   // 5% chance of offending merchant
};

// Reputation thresholds
export const REP_LEVELS = {
    STRANGER: { min: 0, max: 99, discount: 0, name: "Stranger" },
    ACQUAINTANCE: { min: 100, max: 299, discount: 0.05, name: "Acquaintance" },
    FRIEND: { min: 300, max: 599, discount: 0.10, name: "Friend" },
    TRUSTED: { min: 600, max: 999, discount: 0.15, name: "Trusted" },
    PARTNER: { min: 1000, max: Infinity, discount: 0.20, name: "Partner" }
};

// Active trade sessions (player-to-player)
export const activeTrades = new Map();

// Haggle session data (player haggling with NPC)
export const haggleSessions = new Map();

// ===== UTILITY FUNCTIONS =====

/**
 * Get player's reputation with a specific merchant
 */
export async function getMerchantReputation(playerId, merchantId) {
    try {
        const repRef = doc(db, `artifacts/${APP_ID}/public/data/mud-merchant-reputation`, `${playerId}_${merchantId}`);
        const repDoc = await getDoc(repRef);
        
        if (repDoc.exists()) {
            return repDoc.data().points || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting merchant reputation:', error);
        return 0;
    }
}

/**
 * Update player's reputation with merchant
 */
export async function updateMerchantReputation(playerId, merchantId, pointsDelta) {
    try {
        const repRef = doc(db, `artifacts/${APP_ID}/public/data/mud-merchant-reputation`, `${playerId}_${merchantId}`);
        const repDoc = await getDoc(repRef);
        
        const currentPoints = repDoc.exists() ? (repDoc.data().points || 0) : 0;
        const newPoints = Math.max(0, currentPoints + pointsDelta);
        
        await setDoc(repRef, {
            playerId,
            merchantId,
            points: newPoints,
            lastUpdated: Date.now()
        }, { merge: true });
        
        return newPoints;
    } catch (error) {
        console.error('Error updating merchant reputation:', error);
        return 0;
    }
}

/**
 * Get reputation level from points
 */
export function getReputationLevel(points) {
    for (const level of Object.values(REP_LEVELS)) {
        if (points >= level.min && points <= level.max) {
            return level;
        }
    }
    return REP_LEVELS.STRANGER;
}

/**
 * Calculate final price with all modifiers
 */
export function calculatePrice(basePrice, options = {}) {
    let price = basePrice;
    const {
        reputation = 0,
        merchantGreed = 0,
        priceModifier = 1.0,
        isBulk = false,
        rarity = 'common'
    } = options;
    
    // Apply merchant's price modifier (supply/demand)
    price *= priceModifier;
    
    // Apply reputation discount
    const repLevel = getReputationLevel(reputation);
    price *= (1 - repLevel.discount);
    
    // Apply merchant greed (increases price)
    price *= (1 + merchantGreed);
    
    // Apply bulk discount if applicable
    if (isBulk) {
        price *= (1 - TRADE_SETTINGS.BULK_DISCOUNT_RATE);
    }
    
    // Rarity multiplier
    const rarityMultipliers = {
        common: 1.0,
        uncommon: 1.5,
        rare: 2.5,
        epic: 5.0,
        legendary: 10.0
    };
    price *= rarityMultipliers[rarity] || 1.0;
    
    return Math.round(price);
}

/**
 * Calculate haggle success chance
 */
export function calculateHaggleChance(options = {}) {
    const {
        playerCHA = 10,
        reputation = 0,
        discountRequested = 0.10,
        merchantGreed = 0.10,
        merchantMood = 1.0
    } = options;
    
    // Base chance
    let chance = 0.30;
    
    // Charisma bonus (3% per point above 10)
    chance += (playerCHA - 10) * 0.03;
    
    // Reputation bonus
    const repLevel = getReputationLevel(reputation);
    chance += repLevel.discount;
    
    // Discount requested penalty
    if (discountRequested <= 0.10) {
        chance -= 0.05;
    } else if (discountRequested <= 0.20) {
        chance -= 0.15;
    } else if (discountRequested <= 0.30) {
        chance -= 0.30;
    } else {
        chance -= 0.50;
    }
    
    // Merchant greed penalty
    chance -= merchantGreed;
    
    // Merchant mood modifier
    chance *= merchantMood;
    
    // Clamp between 5% and 95%
    return Math.max(0.05, Math.min(0.95, chance));
}

// ===== BUYING FROM NPCS =====

/**
 * List items an NPC is selling
 */
export function listMerchantInventory(npc, playerId) {
    if (!npc.sells || npc.sells.length === 0) {
        logToTerminal(`${npc.shortName || npc.name} isn't selling anything.`, 'error');
        return;
    }
    
    getMerchantReputation(playerId, npc.id).then(reputation => {
        const repLevel = getReputationLevel(reputation);
        
        logToTerminal(`<span class="text-cyan-400">═══ ${npc.shortName || npc.name}'s Inventory ═══</span>`, 'system');
        logToTerminal(`Your status: ${repLevel.name} (${repLevel.discount * 100}% discount)`, 'system');
        logToTerminal('', 'system');
        
        npc.sells.forEach(itemId => {
            const item = gameItems[itemId];
            if (!item) return;
            
            const basePrice = item.cost || 0;
            const finalPrice = calculatePrice(basePrice, {
                reputation,
                merchantGreed: npc.greed || 0,
                priceModifier: npc.priceModifiers?.[itemId] || 1.0,
                rarity: item.rarity
            });
            
            const priceDisplay = finalPrice === basePrice 
                ? `${finalPrice}g`
                : `<span class="line-through text-gray-500">${basePrice}g</span> ${finalPrice}g`;
            
            logToTerminal(`  ${item.name} - ${priceDisplay}`, 'system');
        });
        
        logToTerminal('', 'system');
        if (npc.haggleable !== false) {
            logToTerminal(`💡 Tip: Use "haggle <price> for <item> from ${npc.shortName}" to negotiate`, 'info');
        }
    });
}

/**
 * Buy item from NPC at list price
 */
export async function buyFromNPC(playerId, npc, item, quantity = 1) {
    try {
        const playerRef = doc(db, `artifacts/${APP_ID}/public/data/mud-players`, playerId);
        const playerDoc = await getDoc(playerRef);
        
        if (!playerDoc.exists()) {
            logToTerminal("Error: Player data not found.", 'error');
            return false;
        }
        
        const playerData = playerDoc.data();
        const playerGold = playerData.money || 0;
        
        // Check if NPC sells this item
        if (!npc.sells || !npc.sells.includes(item.id)) {
            logToTerminal(`${npc.shortName || npc.name} doesn't sell ${item.name}.`, 'error');
            return false;
        }
        
        // Calculate final price
        const reputation = await getMerchantReputation(playerId, npc.id);
        const pricePerItem = calculatePrice(item.cost, {
            reputation,
            merchantGreed: npc.greed || 0,
            priceModifier: npc.priceModifiers?.[item.id] || 1.0,
            isBulk: quantity >= TRADE_SETTINGS.BULK_DISCOUNT_THRESHOLD,
            rarity: item.rarity
        });
        
        const totalPrice = pricePerItem * quantity;
        
        // Check if player can afford
        if (playerGold < totalPrice) {
            logToTerminal(`You need ${totalPrice} gold but only have ${playerGold} gold.`, 'error');
            return false;
        }
        
        // Execute purchase
        const newGold = playerGold - totalPrice;
        const updateData = { money: newGold };
        
        // Add items to inventory
        for (let i = 0; i < quantity; i++) {
            updateData.inventory = arrayUnion({
                id: item.id,
                name: item.name,
                cost: pricePerItem,
                movable: item.movable
            });
        }
        
        await updateDoc(playerRef, updateData);
        
        // Update reputation
        const repGain = Math.floor(totalPrice / 10);
        await updateMerchantReputation(playerId, npc.id, repGain + 2); // +2 bonus for fair trade
        
        // Log transaction
        logToTerminal(`<span class="text-green-400">You purchase ${quantity > 1 ? quantity + 'x ' : ''}${item.name} from ${npc.shortName || npc.name} for ${totalPrice} gold.</span>`, 'system');
        
        if (quantity >= TRADE_SETTINGS.BULK_DISCOUNT_THRESHOLD) {
            logToTerminal(`You received a ${TRADE_SETTINGS.BULK_DISCOUNT_RATE * 100}% bulk discount!`, 'info');
        }
        
        return true;
    } catch (error) {
        console.error('Error buying from NPC:', error);
        logToTerminal('An error occurred during the purchase.', 'error');
        return false;
    }
}

// ===== HAGGLING =====

/**
 * Initiate or continue haggle session
 */
export async function haggleWithNPC(playerId, npc, item, offeredPrice, playerData) {
    try {
        // Check if merchant allows haggling
        if (npc.haggleable === false) {
            logToTerminal(`${npc.shortName || npc.name} looks at you sternly. "The price is the price. No negotiations."`, 'npc');
            return;
        }
        
        // Check if NPC sells this item
        if (!npc.sells || !npc.sells.includes(item.id)) {
            logToTerminal(`${npc.shortName || npc.name} doesn't sell ${item.name}.`, 'error');
            return;
        }
        
        const sessionKey = `${playerId}_${npc.id}_${item.id}`;
        let session = haggleSessions.get(sessionKey);
        
        // Initialize session if new
        if (!session) {
            const reputation = await getMerchantReputation(playerId, npc.id);
            const basePrice = item.cost;
            const listPrice = calculatePrice(basePrice, {
                reputation,
                merchantGreed: npc.greed || 0,
                priceModifier: npc.priceModifiers?.[item.id] || 1.0,
                rarity: item.rarity
            });
            
            session = {
                playerId,
                npcId: npc.id,
                itemId: item.id,
                basePrice,
                listPrice,
                currentPrice: listPrice,
                attemptsLeft: TRADE_SETTINGS.HAGGLE_ATTEMPTS,
                reputation,
                startTime: Date.now()
            };
            
            haggleSessions.set(sessionKey, session);
        }
        
        // Check if out of attempts
        if (session.attemptsLeft <= 0) {
            logToTerminal(`${npc.shortName || npc.name} shakes their head. "I've made my final offer. Take it or leave it."`, 'npc');
            return;
        }
        
        // Validate offered price
        if (offeredPrice >= session.currentPrice) {
            logToTerminal(`That's more than the current price of ${session.currentPrice} gold. Just buy it normally!`, 'error');
            return;
        }
        
        if (offeredPrice < session.basePrice * 0.5) {
            logToTerminal(`${npc.shortName || npc.name} laughs. "That's insulting! I won't even dignify that with a response."`, 'npc');
            session.attemptsLeft--;
            return;
        }
        
        // Calculate discount requested
        const discountRequested = (session.currentPrice - offeredPrice) / session.currentPrice;
        
        // Calculate success chance
        const successChance = calculateHaggleChance({
            playerCHA: playerData.cha || 10,
            reputation: session.reputation,
            discountRequested,
            merchantGreed: npc.greed || 0.1,
            merchantMood: 1.0
        });
        
        const roll = Math.random();
        
        // Determine outcome
        if (roll < TRADE_SETTINGS.CRITICAL_SUCCESS_CHANCE) {
            // Critical success - get even better deal!
            const bonusDiscount = 0.05;
            const finalPrice = Math.round(offeredPrice * (1 - bonusDiscount));
            
            logToTerminal(`${npc.shortName || npc.name} grins widely. "You drive a hard bargain! I like you. ${finalPrice} gold, and that's a steal!"`, 'npc');
            logToTerminal(`<span class="text-yellow-400">💎 Critical Success! Extra 5% discount!</span>`, 'system');
            
            session.currentPrice = finalPrice;
            await updateMerchantReputation(playerId, npc.id, 5); // Big rep boost
            
        } else if (roll < successChance) {
            // Success!
            logToTerminal(`${npc.shortName || npc.name} considers for a moment, then nods. "Alright, ${offeredPrice} gold. You've got yourself a deal."`, 'npc');
            
            session.currentPrice = offeredPrice;
            await updateMerchantReputation(playerId, npc.id, 1);
            
        } else if (roll < successChance + 0.30) {
            // Partial success - counteroffer
            const counterPrice = Math.round((session.currentPrice + offeredPrice) / 2);
            
            if (npc.aiEnabled && npc.dialogue && npc.dialogue.length > 0) {
                // Use AI for dynamic counteroffer
                const prompt = `You are ${npc.shortName}, a merchant. A customer offered ${offeredPrice} gold for ${item.name}, which you're selling for ${session.currentPrice} gold. Make a counteroffer of ${counterPrice} gold in character. Be brief (1-2 sentences).`;
                
                const aiResponse = await callGeminiForText(prompt);
                logToTerminal(`${npc.shortName || npc.name}: ${aiResponse}`, 'npc');
            } else {
                const counterResponses = [
                    `"I can't go that low, but how about ${counterPrice} gold?"`,
                    `"You're killing me here... ${counterPrice} gold, and that's my final offer."`,
                    `"I tell you what, meet me halfway at ${counterPrice} gold?"`,
                    `"${offeredPrice}? No way. But I could do ${counterPrice} gold."`
                ];
                const response = counterResponses[Math.floor(Math.random() * counterResponses.length)];
                logToTerminal(`${npc.shortName || npc.name} ${response}`, 'npc');
            }
            
            session.currentPrice = counterPrice;
            
        } else if (roll > 1 - TRADE_SETTINGS.CRITICAL_FAILURE_CHANCE) {
            // Critical failure - offend merchant!
            logToTerminal(`${npc.shortName || npc.name} looks offended. "Get out of my sight! Come back when you're serious about doing business!"`, 'npc');
            logToTerminal(`<span class="text-red-400">💢 Critical Failure! Merchant refuses to trade with you for 5 minutes.</span>`, 'system');
            
            await updateMerchantReputation(playerId, npc.id, -10);
            haggleSessions.delete(sessionKey);
            
            // TODO: Add temporary trade ban
            return;
            
        } else {
            // Failure
            const failureResponses = [
                `"Sorry, I can't go that low."`,
                `"I've got bills to pay too, you know."`,
                `"That's not going to work for me."`,
                `"Come on, be reasonable."`
            ];
            const response = failureResponses[Math.floor(Math.random() * failureResponses.length)];
            logToTerminal(`${npc.shortName || npc.name} shakes their head. ${response}`, 'npc');
            
            await updateMerchantReputation(playerId, npc.id, -1);
        }
        
        session.attemptsLeft--;
        
        // Show remaining attempts
        if (session.attemptsLeft > 0 && session.currentPrice > offeredPrice) {
            logToTerminal(`💡 Current price: ${session.currentPrice}g | Attempts left: ${session.attemptsLeft}`, 'info');
            logToTerminal(`Use "haggle <price> for ${item.name} from ${npc.shortName}" to continue, or "buy ${item.name} from ${npc.shortName}" to accept.`, 'info');
        } else if (session.currentPrice === offeredPrice) {
            logToTerminal(`✅ Use "buy ${item.name} from ${npc.shortName}" to complete the purchase at ${session.currentPrice} gold.`, 'info');
        }
        
    } catch (error) {
        console.error('Error haggling with NPC:', error);
        logToTerminal('An error occurred during haggling.', 'error');
    }
}

/**
 * Accept haggled price and complete purchase
 */
export async function acceptHagglePrice(playerId, npc, item) {
    const sessionKey = `${playerId}_${npc.id}_${item.id}`;
    const session = haggleSessions.get(sessionKey);
    
    if (!session) {
        // No active haggle session, use normal buy
        return await buyFromNPC(playerId, npc, item);
    }
    
    const playerRef = doc(db, `artifacts/${APP_ID}/public/data/mud-players`, playerId);
    const playerDoc = await getDoc(playerRef);
    const playerData = playerDoc.data();
    const playerGold = playerData.money || 0;
    
    if (playerGold < session.currentPrice) {
        logToTerminal(`You need ${session.currentPrice} gold but only have ${playerGold} gold.`, 'error');
        return false;
    }
    
    // Execute purchase at haggled price
    await updateDoc(playerRef, {
        money: playerGold - session.currentPrice,
        inventory: arrayUnion({
            id: item.id,
            name: item.name,
            cost: session.currentPrice,
            movable: item.movable
        })
    });
    
    const discount = Math.round(((session.listPrice - session.currentPrice) / session.listPrice) * 100);
    logToTerminal(`<span class="text-green-400">You purchase ${item.name} from ${npc.shortName || npc.name} for ${session.currentPrice} gold (${discount}% off)!</span>`, 'system');
    
    // Reputation bonus for successful haggle
    await updateMerchantReputation(playerId, npc.id, 3);
    
    // Clear session
    haggleSessions.delete(sessionKey);
    
    return true;
}

// ===== SELLING TO NPCS =====

/**
 * Sell item to NPC
 */
export async function sellToNPC(playerId, npc, item, playerData) {
    try {
        // Check if NPC buys this type of item
        if (!npc.buys || npc.buys.length === 0) {
            logToTerminal(`${npc.shortName || npc.name} doesn't buy items from adventurers.`, 'error');
            return false;
        }
        
        // Check if player has the item
        const inventory = playerData.inventory || [];
        const itemInInventory = inventory.find(i => i.id === item.id);
        
        if (!itemInInventory) {
            logToTerminal(`You don't have ${item.name} in your inventory.`, 'error');
            return false;
        }
        
        // Check if item is sellable
        if (item.bound) {
            logToTerminal(`${item.name} is bound to you and cannot be sold.`, 'error');
            return false;
        }
        
        // Check if NPC wants this item type
        const itemMatches = npc.buys.includes('all') || 
                           npc.buys.includes(item.id) ||
                           npc.buys.some(category => item.category === category);
        
        if (!itemMatches) {
            logToTerminal(`${npc.shortName || npc.name} isn't interested in buying ${item.name}.`, 'error');
            return false;
        }
        
        // Calculate sell price
        const baseValue = item.value || item.cost || 10;
        const buyRate = npc.buyRate || TRADE_SETTINGS.DEFAULT_BUY_RATE;
        const reputation = await getMerchantReputation(playerId, npc.id);
        const repBonus = getReputationLevel(reputation).discount * 0.5; // Half of buy discount applies to selling
        
        let sellPrice = Math.round(baseValue * buyRate * (1 + repBonus));
        
        // Bonus for stolen items to fence
        if (item.stolen && npc.id === 'fence') {
            sellPrice = Math.round(sellPrice * 1.2);
        }
        
        // Execute sale
        const playerRef = doc(db, `artifacts/${APP_ID}/public/data/mud-players`, playerId);
        
        await updateDoc(playerRef, {
            money: increment(sellPrice),
            inventory: arrayRemove(itemInInventory)
        });
        
        logToTerminal(`<span class="text-green-400">You sell ${item.name} to ${npc.shortName || npc.name} for ${sellPrice} gold.</span>`, 'system');
        
        // Update reputation
        const repGain = Math.floor(sellPrice / 5);
        await updateMerchantReputation(playerId, npc.id, repGain);
        
        return true;
    } catch (error) {
        console.error('Error selling to NPC:', error);
        logToTerminal('An error occurred during the sale.', 'error');
        return false;
    }
}

/**
 * Appraise item - see what merchants will pay
 */
export async function appraiseItem(playerId, item) {
    const baseValue = item.value || item.cost || 10;
    
    logToTerminal(`<span class="text-cyan-400">═══ Appraisal: ${item.name} ═══</span>`, 'system');
    logToTerminal(`Base value: ${baseValue} gold`, 'system');
    logToTerminal('', 'system');
    logToTerminal('Merchants who might buy this:', 'system');
    
    for (const npcId in gameNpcs) {
        const npc = gameNpcs[npcId];
        if (!npc.buys || npc.buys.length === 0) continue;
        
        const itemMatches = npc.buys.includes('all') || 
                           npc.buys.includes(item.id) ||
                           npc.buys.some(category => item.category === category);
        
        if (itemMatches) {
            const buyRate = npc.buyRate || TRADE_SETTINGS.DEFAULT_BUY_RATE;
            const reputation = await getMerchantReputation(playerId, npcId);
            const repBonus = getReputationLevel(reputation).discount * 0.5;
            const sellPrice = Math.round(baseValue * buyRate * (1 + repBonus));
            
            logToTerminal(`  ${npc.shortName || npc.name}: ${sellPrice}g (${Math.round(buyRate * 100)}% of value)`, 'system');
        }
    }
}

// Export for use in game.js
export {
    TRADE_SETTINGS,
    REP_LEVELS,
    activeTrades,
    haggleSessions
};
