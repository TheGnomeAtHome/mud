/**
 * Weather System Module
 * Handles dynamic weather, player status effects, and environmental conditions
 */

export function initializeWeatherSystem(dependencies) {
    const { 
        db, 
        appId,
        gameWorld,
        gameItems,
        gamePlayers,
        logToTerminal,
        firestoreFunctions 
    } = dependencies;

    const { 
        doc, 
        getDoc,
        setDoc,
        onSnapshot,
        serverTimestamp 
    } = firestoreFunctions;

    // Weather type definitions
    const WEATHER_TYPES = {
        sunny: {
            name: "sunny",
            description: "The sun shines brightly in a clear blue sky",
            statusEffects: [],
            hpDrain: 0,
            visibilityPenalty: 0,
            movementPenalty: 0
        },
        cloudy: {
            name: "cloudy",
            description: "Gray clouds cover the sky",
            statusEffects: [],
            hpDrain: 0,
            visibilityPenalty: 0,
            movementPenalty: 0
        },
        rainy: {
            name: "rainy",
            description: "Rain falls steadily from dark clouds",
            statusEffects: ["wet"],
            hpDrain: 1,
            drainInterval: 120000, // 2 minutes
            visibilityPenalty: 0.3,
            movementPenalty: 0
        },
        snowy: {
            name: "snowy",
            description: "Snow falls gently, covering the ground in white",
            statusEffects: ["cold"],
            hpDrain: 2,
            drainInterval: 60000, // 1 minute
            visibilityPenalty: 0.2,
            movementPenalty: 0.5 // 50% chance of delay
        },
        stormy: {
            name: "stormy",
            description: "A fierce storm rages with thunder and lightning",
            statusEffects: ["wet", "cold"],
            hpDrain: 2,
            drainInterval: 60000,
            lightningChance: 0.1,
            lightningDamage: [5, 15],
            visibilityPenalty: 0.5,
            movementPenalty: 0.3
        },
        foggy: {
            name: "foggy",
            description: "Thick fog reduces visibility to a few feet",
            statusEffects: [],
            hpDrain: 0,
            visibilityPenalty: 0.7,
            movementPenalty: 0.2
        },
        hot: {
            name: "hot",
            description: "Scorching heat beats down relentlessly",
            statusEffects: ["overheated"],
            hpDrain: 3,
            drainInterval: 60000,
            statPenalty: { str: -2, dex: -2, con: -2 },
            visibilityPenalty: 0.1, // Heat haze
            movementPenalty: 0
        },
        cold: {
            name: "cold",
            description: "Bitter cold wind cuts through everything",
            statusEffects: ["freezing"],
            hpDrain: 2,
            drainInterval: 60000,
            statPenalty: { dex: -1 },
            frostbiteChance: 0.05,
            visibilityPenalty: 0,
            movementPenalty: 0.1
        }
    };

    // Weather transition messages
    const WEATHER_TRANSITIONS = {
        sunny: "The clouds part and the sun breaks through.",
        cloudy: "Clouds begin to gather overhead.",
        rainy: "Rain begins to fall from the darkening sky.",
        snowy: "Snowflakes start drifting down from above.",
        stormy: "Dark storm clouds roll in with thunder rumbling in the distance.",
        foggy: "A thick fog rolls in, obscuring your vision.",
        hot: "The temperature rises uncomfortably.",
        cold: "A bitter chill settles in the air."
    };

    // Status effect definitions
    const STATUS_EFFECTS = {
        wet: {
            name: "wet",
            description: "You are soaking wet",
            displayColor: "text-cyan-400",
            icon: "💧",
            duration: 300000, // 5 minutes
            canDryIndoors: true,
            dryTime: 180000 // 3 minutes indoors
        },
        cold: {
            name: "cold",
            description: "You are shivering with cold",
            displayColor: "text-blue-400",
            icon: "🥶",
            duration: 180000, // 3 minutes
            canWarmIndoors: true,
            warmTime: 120000 // 2 minutes indoors
        },
        overheated: {
            name: "overheated",
            description: "You are suffering from heat exhaustion",
            displayColor: "text-red-400",
            icon: "🥵",
            duration: 180000,
            canCoolIndoors: true,
            coolTime: 120000
        },
        freezing: {
            name: "freezing",
            description: "Your fingers are numb with cold",
            displayColor: "text-blue-300",
            icon: "❄️",
            duration: 300000,
            actionFailChance: 0.25
        }
    };

    let currentWeather = "sunny";
    let weatherStartTime = Date.now();
    let weatherCycleEnabled = true;
    let weatherCheckInterval = null;
    let statusEffectInterval = null;

    /**
     * Initialize weather system
     */
    async function initialize(userId) {
        console.log('[Weather] Initializing weather system...');
        
        // Listen for weather changes
        const weatherRef = doc(db, `/artifacts/${appId}/public/data/mud-weather/current`);
        const weatherUnsub = onSnapshot(weatherRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                if (data.currentWeather !== currentWeather) {
                    const oldWeather = currentWeather;
                    currentWeather = data.currentWeather;
                    weatherStartTime = data.startTime?.toMillis() || Date.now();
                    notifyWeatherChange(userId, oldWeather, currentWeather);
                }
            }
        });

        // Load current weather
        const weatherSnap = await getDoc(weatherRef);
        if (weatherSnap.exists()) {
            const data = weatherSnap.data();
            currentWeather = data.currentWeather || "sunny";
            weatherStartTime = data.startTime?.toMillis() || Date.now();
        } else {
            // Initialize weather
            await setWeatherState("sunny");
        }

        // Start weather cycle (admin only or automatic)
        startWeatherCycle();

        // Start status effect processing
        startStatusEffectProcessing(userId);

        console.log(`[Weather] System initialized. Current weather: ${currentWeather}`);
        
        return weatherUnsub;
    }

    /**
     * Set weather state in Firebase
     */
    async function setWeatherState(weatherType, duration = null) {
        if (!WEATHER_TYPES[weatherType]) {
            console.error(`[Weather] Invalid weather type: ${weatherType}`);
            return false;
        }

        const weatherRef = doc(db, `/artifacts/${appId}/public/data/mud-weather/current`);
        await setDoc(weatherRef, {
            currentWeather: weatherType,
            startTime: serverTimestamp(),
            duration: duration || getRandomDuration(),
            lastUpdate: Date.now()
        });

        return true;
    }

    /**
     * Get random weather duration (10-30 minutes)
     */
    function getRandomDuration() {
        return 600000 + Math.random() * 1200000; // 10-30 minutes
    }

    /**
     * Start automatic weather cycle
     */
    function startWeatherCycle() {
        if (weatherCheckInterval) {
            clearInterval(weatherCheckInterval);
        }

        weatherCheckInterval = setInterval(async () => {
            if (!weatherCycleEnabled) return;

            const elapsed = Date.now() - weatherStartTime;
            const weatherRef = doc(db, `/artifacts/${appId}/public/data/mud-weather/current`);
            const weatherSnap = await getDoc(weatherRef);
            
            if (weatherSnap.exists()) {
                const data = weatherSnap.data();
                const duration = data.duration || 600000;
                
                if (elapsed >= duration) {
                    // Change weather
                    const newWeather = selectRandomWeather();
                    await setWeatherState(newWeather);
                }
            }
        }, 60000); // Check every minute
    }

    /**
     * Select random weather based on probabilities
     */
    function selectRandomWeather() {
        const probabilities = {
            sunny: 0.30,
            cloudy: 0.25,
            rainy: 0.20,
            foggy: 0.10,
            snowy: 0.05,
            stormy: 0.05,
            hot: 0.03,
            cold: 0.02
        };

        const rand = Math.random();
        let cumulative = 0;

        for (const [weather, prob] of Object.entries(probabilities)) {
            cumulative += prob;
            if (rand <= cumulative) {
                return weather;
            }
        }

        return "sunny";
    }

    /**
     * Notify player of weather change
     */
    function notifyWeatherChange(userId, oldWeather, newWeather) {
        const player = gamePlayers[userId];
        if (!player) return;

        const room = gameWorld[player.currentRoom];
        if (!room) return;

        // Only notify if player is outdoors
        if (!room.isIndoor) {
            const transition = WEATHER_TRANSITIONS[newWeather] || "The weather changes.";
            logToTerminal(`<span class="text-yellow-400">⛅ ${transition}</span>`, 'system');
        }
    }

    /**
     * Start processing status effects
     */
    function startStatusEffectProcessing(userId) {
        if (statusEffectInterval) {
            clearInterval(statusEffectInterval);
        }

        statusEffectInterval = setInterval(() => {
            processStatusEffects(userId);
        }, 60000); // Check every minute
    }

    /**
     * Process weather status effects for player
     */
    async function processStatusEffects(userId) {
        const player = gamePlayers[userId];
        if (!player) return;

        const room = gameWorld[player.currentRoom];
        if (!room) return;

        // Skip if indoors
        if (room.isIndoor) {
            // Clear outdoor-only effects when indoors
            await clearOutdoorEffects(userId);
            return;
        }

        const weather = WEATHER_TYPES[currentWeather];
        if (!weather) return;

        // Calculate protection level
        const protection = calculateWeatherProtection(player, currentWeather);

        // Apply status effects
        for (const effectName of weather.statusEffects) {
            if (protection >= 0.8) continue; // 80%+ protection prevents effect
            
            await applyStatusEffect(userId, effectName, protection);
        }

        // Apply HP drain
        if (weather.hpDrain > 0 && protection < 0.8) {
            const actualDrain = Math.ceil(weather.hpDrain * (1 - protection));
            await applyWeatherDamage(userId, actualDrain, weather.name);
        }

        // Lightning strikes during storms
        if (weather.lightningChance && Math.random() < weather.lightningChance) {
            const [minDmg, maxDmg] = weather.lightningDamage;
            const damage = minDmg + Math.floor(Math.random() * (maxDmg - minDmg + 1));
            await applyLightningStrike(userId, damage);
        }
    }

    /**
     * Calculate weather protection from equipped items
     */
    function calculateWeatherProtection(player, weatherType) {
        if (!player.inventory) return 0;

        let totalProtection = 0;
        let itemCount = 0;

        // Check equipped items (would need equipment slots system)
        // For now, check all items in inventory
        for (const itemId of player.inventory) {
            const item = gameItems[itemId];
            if (item && item.weatherProtection && item.weatherProtection[weatherType]) {
                totalProtection += item.weatherProtection[weatherType];
                itemCount++;
            }
        }

        return itemCount > 0 ? totalProtection / itemCount : 0;
    }

    /**
     * Apply status effect to player
     */
    async function applyStatusEffect(userId, effectName, protection) {
        const player = gamePlayers[userId];
        if (!player) return;

        const effect = STATUS_EFFECTS[effectName];
        if (!effect) return;

        // Check if player already has this effect
        if (player.statusEffects && player.statusEffects[effectName]) return;

        const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
        const statusEffects = player.statusEffects || {};
        statusEffects[effectName] = {
            startTime: Date.now(),
            duration: effect.duration,
            protection: protection
        };

        await setDoc(playerRef, { statusEffects }, { merge: true });

        logToTerminal(`<span class="${effect.displayColor}">${effect.icon} ${effect.description}!</span>`, 'system');
    }

    /**
     * Apply weather damage to player
     */
    async function applyWeatherDamage(userId, damage, weatherType) {
        const player = gamePlayers[userId];
        if (!player || player.hp <= 0) return;

        const newHp = Math.max(0, player.hp - damage);
        const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
        await setDoc(playerRef, { hp: newHp }, { merge: true });

        logToTerminal(`<span class="text-red-400">The ${weatherType} weather saps ${damage} HP from you.</span>`, 'combat');

        if (newHp <= 0) {
            logToTerminal(`<span class="text-red-600">You have succumbed to the elements!</span>`, 'combat');
        }
    }

    /**
     * Apply lightning strike damage
     */
    async function applyLightningStrike(userId, damage) {
        const player = gamePlayers[userId];
        if (!player || player.hp <= 0) return;

        const newHp = Math.max(0, player.hp - damage);
        const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
        await setDoc(playerRef, { hp: newHp }, { merge: true });

        logToTerminal(`<span class="text-yellow-400">⚡ A bolt of lightning strikes near you, dealing ${damage} damage!</span>`, 'combat');
    }

    /**
     * Clear outdoor-only status effects when player goes indoors
     */
    async function clearOutdoorEffects(userId) {
        const player = gamePlayers[userId];
        if (!player || !player.statusEffects) return;

        let updated = false;
        const statusEffects = { ...player.statusEffects };

        for (const [effectName, effectData] of Object.entries(statusEffects)) {
            const effect = STATUS_EFFECTS[effectName];
            if (effect && (effect.canDryIndoors || effect.canWarmIndoors || effect.canCoolIndoors)) {
                const elapsed = Date.now() - effectData.startTime;
                const clearTime = effect.dryTime || effect.warmTime || effect.coolTime || 180000;
                
                if (elapsed >= clearTime) {
                    delete statusEffects[effectName];
                    updated = true;
                    logToTerminal(`<span class="text-green-400">You feel better now that you're indoors.</span>`, 'system');
                }
            }
        }

        if (updated) {
            const playerRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${userId}`);
            await setDoc(playerRef, { statusEffects }, { merge: true });
        }
    }

    /**
     * Get current weather info
     */
    function getCurrentWeather() {
        return {
            type: currentWeather,
            ...WEATHER_TYPES[currentWeather],
            startTime: weatherStartTime
        };
    }

    /**
     * Check if player can move (weather may block movement)
     */
    function canMove(userId) {
        const player = gamePlayers[userId];
        if (!player) return true;

        const room = gameWorld[player.currentRoom];
        if (!room || room.isIndoor) return true;

        const weather = WEATHER_TYPES[currentWeather];
        if (!weather.movementPenalty) return true;

        // Roll for movement penalty
        if (Math.random() < weather.movementPenalty) {
            return false;
        }

        return true;
    }

    /**
     * Cleanup
     */
    function cleanup() {
        if (weatherCheckInterval) {
            clearInterval(weatherCheckInterval);
        }
        if (statusEffectInterval) {
            clearInterval(statusEffectInterval);
        }
    }

    return {
        initialize,
        setWeatherState,
        getCurrentWeather,
        canMove,
        cleanup,
        WEATHER_TYPES,
        STATUS_EFFECTS
    };
}
