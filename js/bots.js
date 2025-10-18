// bots.js - Automated test bots that wander the MUD

export function initializeBotSystem(dependencies) {
    const { 
        db, 
        appId, 
        gameWorld,
        firestoreFunctions
    } = dependencies;

    const { 
        doc, 
        getDoc,
        setDoc,
        updateDoc, 
        collection,
        addDoc,
        deleteDoc,
        serverTimestamp,
        getDocs
    } = firestoreFunctions;

    const activeBots = {};
    let botIntervalId = null;

    const botNames = [
        "WanderingBot", "ExplorerBot", "CuriousBot", "AdventurerBot",
        "RoamingBot", "TestBot", "DemoBot", "SampleBot", "TrialBot",
        "BrowserBot", "SearcherBot", "QuestBot", "TravelBot", "NomadBot"
    ];

    const botActions = [
        { type: 'say', messages: [
            "Hello everyone!",
            "What a nice place this is.",
            "Anyone here?",
            "Testing testing...",
            "I am just a bot wandering around.",
            "Beep boop!",
            "This is quite interesting.",
            "I wonder what's next."
        ]},
        { type: 'emote', actions: [
            'wave', 'smile', 'nod', 'look', 'sit', 'stand',
            'yawn', 'stretch', 'dance', 'laugh'
        ]},
        { type: 'move', weight: 3 } // Higher weight = more likely to move
    ];

    function getRandomElement(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    function getRandomRoomId() {
        const roomIds = Object.keys(gameWorld);
        return roomIds.length > 0 ? getRandomElement(roomIds) : 'start';
    }

    async function createBot() {
        const botName = getRandomElement(botNames) + Math.floor(Math.random() * 1000);
        const botId = 'bot_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        
        const botData = {
            name: botName,
            roomId: getRandomRoomId(),
            inventory: [],
            isBot: true,
            money: 50,
            hp: 100,
            maxHp: 100,
            xp: 0,
            level: 1,
            score: 0,
            attributes: {
                str: 10,
                dex: 10,
                con: 10,
                int: 10,
                wis: 10,
                cha: 10
            },
            createdAt: serverTimestamp()
        };

        try {
            await setDoc(doc(db, `/artifacts/${appId}/public/data/mud-players/${botId}`), botData);
            activeBots[botId] = {
                name: botName,
                roomId: botData.roomId,
                lastAction: Date.now()
            };
            console.log(`Bot ${botName} spawned in ${botData.roomId}`);
            return botId;
        } catch (error) {
            console.error('Error creating bot:', error);
            return null;
        }
    }

    async function performBotAction(botId) {
        if (!activeBots[botId]) return;

        const bot = activeBots[botId];
        const botRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${botId}`);
        
        try {
            const botDoc = await getDoc(botRef);
            if (!botDoc.exists()) {
                delete activeBots[botId];
                return;
            }

            const botData = botDoc.data();
            const currentRoom = botData.roomId;

            // Weighted random action selection
            const actionWeights = [];
            botActions.forEach(action => {
                const weight = action.weight || 1;
                for (let i = 0; i < weight; i++) {
                    actionWeights.push(action);
                }
            });

            const selectedAction = getRandomElement(actionWeights);

            switch (selectedAction.type) {
                case 'say':
                    const message = getRandomElement(selectedAction.messages);
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        senderId: botId,
                        senderName: bot.name,
                        roomId: currentRoom,
                        text: message,
                        timestamp: serverTimestamp()
                    });
                    break;

                case 'emote':
                    const emote = getRandomElement(selectedAction.actions);
                    const emoteMessage = `${bot.name} ${emote}s.`;
                    await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                        senderId: botId,
                        senderName: bot.name,
                        roomId: currentRoom,
                        text: emoteMessage,
                        timestamp: serverTimestamp()
                    });
                    break;

                case 'move':
                    const room = gameWorld[currentRoom];
                    if (room && room.exits) {
                        const exitDirections = Object.keys(room.exits);
                        if (exitDirections.length > 0) {
                            const randomDirection = getRandomElement(exitDirections);
                            const newRoomId = room.exits[randomDirection];
                            
                            // Announce departure
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: botId,
                                senderName: bot.name,
                                roomId: currentRoom,
                                text: `${bot.name} leaves ${randomDirection}.`,
                                timestamp: serverTimestamp()
                            });

                            // Move bot
                            await updateDoc(botRef, { roomId: newRoomId });
                            bot.roomId = newRoomId;

                            // Announce arrival
                            await addDoc(collection(db, `/artifacts/${appId}/public/data/mud-messages`), {
                                senderId: botId,
                                senderName: bot.name,
                                roomId: newRoomId,
                                text: `${bot.name} arrives.`,
                                timestamp: serverTimestamp()
                            });
                        }
                    }
                    break;
            }

            bot.lastAction = Date.now();
        } catch (error) {
            console.error(`Error performing bot action for ${botId}:`, error);
        }
    }

    async function removeBot(botId) {
        try {
            const botRef = doc(db, `/artifacts/${appId}/public/data/mud-players/${botId}`);
            await deleteDoc(botRef);
            delete activeBots[botId];
            console.log(`Bot ${botId} removed`);
            return true;
        } catch (error) {
            console.error('Error removing bot:', error);
            return false;
        }
    }

    async function removeAllBots() {
        const botIds = Object.keys(activeBots);
        for (const botId of botIds) {
            await removeBot(botId);
        }
        console.log('All bots removed');
    }

    function startBotSystem(botCount = 3, actionInterval = 8000) {
        // Clear any existing interval
        if (botIntervalId) {
            clearInterval(botIntervalId);
        }

        // Spawn bots asynchronously without blocking
        (async () => {
            try {
                console.log(`Starting bot system with ${botCount} bots...`);
                for (let i = 0; i < botCount; i++) {
                    const botId = await createBot();
                    console.log(`Bot ${i + 1}/${botCount} spawned: ${botId}`);
                    await new Promise(resolve => setTimeout(resolve, 500)); // Stagger spawns
                }

                // Start bot action loop
                botIntervalId = setInterval(() => {
                    const botIds = Object.keys(activeBots);
                    if (botIds.length > 0) {
                        // Pick a random bot to perform an action
                        const randomBotId = getRandomElement(botIds);
                        performBotAction(randomBotId);
                    }
                }, actionInterval);

                console.log(`✅ Bot system fully initialized with ${botCount} bots, action interval: ${actionInterval}ms`);
            } catch (error) {
                console.error('Error starting bot system:', error);
            }
        })();
        
        // Return immediately - don't block
        return true;
    }

    function stopBotSystem() {
        if (botIntervalId) {
            clearInterval(botIntervalId);
            botIntervalId = null;
        }
        console.log('Bot system stopped');
    }

    async function getBotCount() {
        try {
            const playersSnapshot = await getDocs(collection(db, `/artifacts/${appId}/public/data/mud-players`));
            let botCount = 0;
            playersSnapshot.forEach(doc => {
                if (doc.data().isBot) {
                    botCount++;
                }
            });
            return botCount;
        } catch (error) {
            console.error('Error counting bots:', error);
            return 0;
        }
    }

    return {
        startBotSystem,
        stopBotSystem,
        createBot,
        removeBot,
        removeAllBots,
        getBotCount,
        getActiveBots: () => Object.keys(activeBots)
    };
}
