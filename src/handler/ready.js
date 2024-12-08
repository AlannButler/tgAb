const { reviewCheck } = require("../systems/reviewsCheck");

let botInstance;

function init(bot){
    botInstance = bot;

    console.log("[TgBotAbai] Bot is ready!");

    setInterval(() => reviewCheck(bot), 30 * 1000);

    botInstance.on('polling_error', (error) => {
        console.error(`[TgBotAbai] Ошибка при опросе: ${error.message}`);
    });
}

module.exports = { init };