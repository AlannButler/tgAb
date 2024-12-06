let botInstance;

function init(bot){
    botInstance = bot;

    console.log("[TgBotAbai] Bot is ready!");

    botInstance.on('polling_error', (error) => {
        console.error(`[TgBotAbai] Ошибка при опросе: ${error.message}`);
    });
}

module.exports = { init };