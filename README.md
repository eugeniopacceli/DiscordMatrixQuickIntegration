# DiscordMatrixQuickIntegration
A minimalistic bot to bridge a Matrix text channel to a Discord text channel and vice versa.

# Configuration
The configuration for this bot basically requires a valid credential for both platorms and the ids of the rooms it should be posting to.

Check `config.example.json` for a template.

# TO DO
* Nicer presentation on both platforms.
* Support embed media such as video or images.

# To run
Tested on Node.Js 11.6.0.

* Run `npm install`;
* Copy `config.example.json` in `config.json` and set it up properly;
* `node index.js` runs the script.

# Reference
[Discord.Js](https://discord.js.org/)
[Matrix JS Sdk](https://github.com/matrix-org/matrix-js-sdk)
[Discord API Specs](https://discordapp.com/developers/docs/intro)
[Matrix API Specs](https://matrix.org/docs/spec/)