require("dotenv").config()
const TelegramBot = require("node-telegram-bot-api");
const ready = require("./handler/ready");
const messageHandler = require("./handler/messageHandler");
const db = require('./database');
db.then(() => console.log("[TgBotAbai] Connected to MongoDB.")).catch((err) =>
  console.log("[TgBotAbai]", err)
);

const TOKEN = process.env.TOKEN;

const bot = new TelegramBot(TOKEN);

ready.init(bot);
messageHandler.init(bot);

module.exports = bot;