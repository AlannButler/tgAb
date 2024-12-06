const { UserSchema, PlaceSchema } = require("../models");
const NodeGeocoder = require('node-geocoder');

const organizations = require("../settings/organizations.json")

const geocoder = NodeGeocoder({
    provider: 'openstreetmap'
});

async function getLocationDetails(latitude, longitude) {
    try {
        const response = await geocoder.reverse({ lat: latitude, lon: longitude });
        if (response.length > 0) {
            const location = response[0];
            return {
                city: location.city,
                country: location.country,
                state: location.state,
                streetName: location.streetName,
                formattedAddress: location.formattedAddress
            };
        }
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

function createDivisionsKeyboard() {
    const divisions = organizations['types']['divisions'];

    const keyboard = [];
    for (let i = 0; i < divisions.length; i += 2) {
        const row = [];

        row.push({ text: divisions[i] });

        if (i + 1 < divisions.length) {
            row.push({ text: divisions[i + 1] });
        }
        keyboard.push(row);
    }

    return {
        reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true,
            one_time_keyboard: false,
        },
        parse_mode: "Markdown"
    };
}

const sendMenu = async(chatId, bot) => {
    await bot.sendMessage(chatId, "*Выберите тип организации*", createDivisionsKeyboard());
}

function init(bot) {
    bot.on("callback_query", async function onCallbackQuery(callbackQuery) {
        const data = callbackQuery.data;
        const userId = callbackQuery.message.from.id;
        const chatId = callbackQuery.message.chat.id;
        const user = await UserSchema.findOne({ id: userId });

        const place = await PlaceSchema.findOne({ id: data });
        if (place) {
            await bot.sendMessage(chatId, `📞 *${place.number.join(", ")}*`, { parse_mode: "Markdown" });
        }
    });

    bot.onText(/\/start/, async (msg) => {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const user = await UserSchema.findOne({ userId: userId });

        const welcomeMessage = 
            "*👋 Добро пожаловать в бот-навигатор по государственным учреждениям!*\n\n" +
            "*🏛 Я помогу вам найти ближайшие:*\n" +
            "- `Администрации`\n" +
            "- `МФЦ`\n" +
            "- `Налоговые инспекции`\n" +
            "- `Отделения полиции`\n" +
            "и другие государственные учреждения.\n\n" +
            "*💡 Нажмите на кнопку ниже, чтобы отправить свою геолокацию, или введите название района.*";

        const locationButton = {
            reply_markup: {
                keyboard: [
                    [{
                        text: '📍 Отправить геолокацию',
                        request_location: true
                    }]
                ],
                resize_keyboard: true
            }
        };

        await bot.sendMessage(chatId, welcomeMessage, { 
            parse_mode: "Markdown",
            ...locationButton
        });
    });

    bot.on("message", async (msg) => {
        

        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const content = msg.text;
        var user = await UserSchema.findOne({ userId });
        if (!user) user = await UserSchema.create({ userId });
        
        if (content === "/menu") {
            await sendMenu(chatId, bot);
        }

        const place = await PlaceSchema.findOne({ name: content });
        if (place) {
            const { name, address, number, id } = place;
            const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
            // const keyboard = createDivisionsKeyboard();
            // keyboard.reply_markup.inline_keyboard = [];
            // keyboard.reply_markup.inline_keyboard.push([{ text: "📞 Позвонить", callback_data: id }]);
            await bot.sendMessage(chatId,
                `🏛 *${name}*\n\n` +
                `📍 *Адрес:* ${address}\n` +
                // `📞 *Телефон:* ${number.join(", ")}\n` +
                `🌍 [Открыть в Google Maps](${googleMapsLink})`,
                {
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📞 Позвонить", callback_data: id }]
                        ]
                    }
                }
            );
        }

        for (const division of organizations['types']['divisions']) {
            if (content === division) {
                const places = await PlaceSchema.find({ division });
                const keyboard = [];
                for (const place of places) {
                    keyboard.push([{ text: place.name }]);
                }

                await bot.sendMessage(chatId, "*Выберите организацию:*", {
                    reply_markup: {
                        keyboard: keyboard,
                        resize_keyboard: true,
                        one_time_keyboard: false,
                    },
                    parse_mode: "Markdown"
                });
            }
        }
        
        if (msg.location) {
            const { latitude, longitude } = msg.location;
            const locationDetails = await getLocationDetails(latitude, longitude);
            
            if (locationDetails) {
                user.latitude = latitude;
                user.longitude = longitude;

                await bot.sendMessage(chatId,
                    `📍 *Ваше местоположение:*\n\n` +
                    `🏙 *Город:* ${locationDetails.city}\n` +
                    `🌍 *Страна:* ${locationDetails.country}\n`,
                    createDivisionsKeyboard()
                );
            }
            console.log(`Received location: ${latitude}, ${longitude}`);
        }
    });
}

module.exports = { init };
