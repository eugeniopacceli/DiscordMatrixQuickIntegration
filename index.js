const fs = require("fs");
const path = require("path");
// Third party
const matrixSdk = require("matrix-js-sdk");
const Discord = require('discord.js');
const LocalStorage = require('node-localstorage').LocalStorage;

// User config from your JSON at the root directory
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), "utf-8"));
// Local Storage initialization
const localStorage = new LocalStorage(path.join(__dirname, config.localStorage));

// Anonymous async function call so we can use await from now on :^)
(async () => {
    let discordReady = false;
    let matrixReady = false;

    // If there are no previous Matrix credentials in memory, it means we must attempt login with user and password
    if (localStorage.getItem('deviceId') === null ||
        localStorage.getItem('accessToken') === null ||
        localStorage.getItem('userId') === null) {

        console.log('Trying to log in, as no previous login data was found...');
        let matrixLoginClient = matrixSdk.createClient({ baseUrl: config.matrix.url });
        try {
            const res = await matrixLoginClient.login('m.login.password', {
                user: config.matrix.user,
                password: config.matrix.password,
                initial_device_display_name: config.matrix.device
            });

            // Stores the login credentials on memory
            localStorage.setItem('userId', res.user_id);
            localStorage.setItem('accessToken', res.access_token);
            localStorage.setItem('deviceId', res.device_id);
        } catch (ex) {
            // Total failure
            console.error(ex);
            process.exit(1);
        } finally {
            // Login client is deleted
            delete matrixLoginClient;
        }
    }

    // Discord client with Discord.js
    const discordClient = new Discord.Client();
    // Matrix client with matrix-js-sdk (using the credentials obtained by the temporary login client or memory)
    const matrixClient = matrixSdk.createClient({
        baseUrl: config.matrix.url,
        accessToken: localStorage.getItem('accessToken'),
        userId: localStorage.getItem('userId'),
        sessionStore: new matrixSdk.WebStorageSessionStore(localStorage),
        deviceId: localStorage.getItem('deviceId')
    });

    // Matrix module, sends to discord
    matrixClient.once('sync', (state, prevState) => {
        console.log(`Logged in Matrix as ${localStorage.getItem('userId')}.`);

        if (state === 'PREPARED') {
            // Sets up the listener for messages on Matrix
            matrixClient.on("Room.timeline", (event, room, toStartOfTimeline) => {
                if (toStartOfTimeline ||
                    event.getType() !== "m.room.message" ||
                    event.getSender() === localStorage.getItem('userId') ||
                    room.roomId != config.matrix.roomId) {
                    // only message events accepted, don't use stale results, listen to our own data or another room
                    // except the one we want to sync for this instance
                    return;
                }

                console.log(event);
                const avatarUrl = event.sender.user && event.sender.user.avatarUrl ? event.sender.user.avatarUrl : discordClient.user.avatarUrl;

                if (discordReady) {
                    // Setting up and sending the message to Discord
                    discordClient.targetRoom.send({
                        embed: {
                            color: 3447003,
                            author: {
                                name: event.sender.name,
                                icon_url: avatarUrl
                            },
                            description: `${event.getContent().body}`,
                            timestamp: new Date(),
                            footer: {
                                icon_url: avatarUrl,
                                text: `Matrix bridge with ${room.name}, ${event.sender.rawDisplayName}`
                            }
                        }
                    }).catch(console.error);
                }
            });

            // Print device ID and key for verification.
            console.log("-- Matrix --");
            console.log('ENCRYPTION DATA FOR VERIFICATION');
            console.log('Our device ID:                   ' + localStorage.getItem('deviceId'));
            console.log('Our device key for verification: ' + matrixClient.getDeviceEd25519Key());
            console.log(" -- End of Matrix instance information --");

            matrixReady = true;
        } else {
            // Something went wrong. We exit.
            console.log('Matrix SYNC did not progress into the expected PREPARED phase (new sync state %s from %s). Try resetting the token. We exit.', state, prevState);
            process.exit(1);
        }
    });

    // Discord module, sends to Matrix
    discordClient.on('ready', () => {
        console.log(`Logged in Discord as ${discordClient.user.tag}!`);
        discordClient.targetRoom = discordClient.channels.find(x => x.id == config.discord.roomId);

        if (!discordClient.targetRoom) {
            console.error("No Discord target room found, check the room id in configs or if the bot can actually see it.");
            process.exit(1);
        }

        // Sets up the listener
        discordClient.on('message', msg => {
            if (msg.channel.id != config.discord.roomId || msg.author.id == discordClient.user.id) {
                return; // only listens to the desired bridge channel also not our own messages
            }

            if (matrixReady) {
                // Sets up the message
                const content = {
                    body: `${msg.author.username}#${msg.author.discriminator} on ${msg.channel.name} (Discord) :: ${msg.content}`,
                    msgtype: "m.text"
                };

                // Sends to Matrix
                matrixClient.sendEvent(config.matrix.roomId, "m.room.message", content, "", (err, res) => {
                    if (err) {
                        console.log(err);
                    }
                });
            }
        });

        discordReady = true;
    });

    try {
        matrixClient.startClient({});
        discordClient.login(config.discord.token);
    } catch (err) {
        console.error(err);
    }

})();