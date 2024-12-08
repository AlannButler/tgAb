const { UserSchema, PlaceSchema, ReviewSchema, AppealSchema } = require("../models");
const axios = require('axios');
const ChartDataLabels = require('chartjs-plugin-datalabels');
const organizations = require("../settings/organizations.json");
const { createReminder } = require("../systems/createReminder");
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const waitingComplaint = {}

const width = 400; // Ширина графика
const height = 400; // Высота графика
const backgroundColour = 'white';
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour, plugins: { modern: [ChartDataLabels] } });

async function generateChart(answeredPercentage, notAnsweredPercentage) {
    const configuration = {
        type: 'doughnut',
        data: {
            labels: ['Дозвонились', 'Не дозвонились'],
            datasets: [{
                data: [answeredPercentage, notAnsweredPercentage],
                backgroundColor: ['#36a2eb', '#ff6384']
            }]
        },
        options: {
            responsive: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false,
                    text: 'Дозвонились vs Не дозвонились'
                },
                tooltip: {
                    enabled: false
                },
                datalabels: {
                    formatter: (value, context) => {
                        return value.toFixed(2) + '%';
                    },
                    color: '#fff',
                    anchor: 'end',
                    align: 'start',
                    font: {
                        weight: 'bold',
                        size: '16'
                    }
                }
            }
        }
    };

    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    return imageBuffer;
}

async function isPlaceInSameState(userLatitude, userLongitude, placeLatitude, placeLongitude) {
    const userLocation = await getLocationDetails(userLatitude, userLongitude);
    const placeLocation = await getLocationDetails(placeLatitude, placeLongitude);
    if (!userLocation || !placeLocation) return false;

    return userLocation.state === placeLocation.state;
}

async function getLocationDetails(lat, lon) {
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: {
          lat,
          lon,
          format: 'json',
        },
      });

      return {
        city: res.data.address.city,
        state: res.data.address.state,
        country: res.data.address.country,
      }
    } catch (err) {
      console.error(err);
    }
}

async function createDivisionsKeyboard(user) {
    const divisions = organizations['types']['divisions'];
    const userState = await getLocationDetails(user.latitude, user.longitude);

    const places = await PlaceSchema.find({ state: userState.state });
    
    const divisionsWithPlaces = new Set(places.map(place => place.division));
    
    const keyboard = [];
    for (let i = 0; i < divisions.length; i += 2) {
        const row = [];
        
        if (divisionsWithPlaces.has(divisions[i])) {
            row.push({ text: divisions[i] });
        }
        
        if (i + 1 < divisions.length && divisionsWithPlaces.has(divisions[i + 1])) {
            row.push({ text: divisions[i + 1] });
        }

        if (row.length > 0) {
            keyboard.push(row);
        }
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

const sendMenu = async(chatId, bot, user) => {
    const keyboard = await createDivisionsKeyboard(user)
    await bot.sendMessage(chatId, "*Выберите тип организации*", keyboard);
}

const startMenu = async (bot, chatId) => {
    const welcomeMessage = 
        "*👋 Добро пожаловать в бот-навигатор по государственным учреждениям!*\n\n" +
        "*🏛 Я помогу вам найти ближайшие:*\n" +
        "- `Администрации`\n" +
        "- `МФЦ`\n" +
        "- `Налоговые инспекции`\n" +
        "- `Отделения полиции`\n" +
        "и другие государственные учреждения.\n\n" +
        "*💡 Нажмите на кнопку ниже, чтобы отправить свою геолокацию.*";

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
}

function init(bot) {
    bot.on("callback_query", async function onCallbackQuery(callbackQuery) {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;

        var user = await UserSchema.findOne({ chatId });
        if (!user) return;

        if (data && data.startsWith("hideAppeal_") && user.isAdmin) {
            const [_, appealId] = data.split("_");
            const appeal = await AppealSchema.findById(appealId);
            if (appeal) {
                appeal.hidden = true;
                await appeal.save();
                await bot.sendMessage(chatId, "🚫 *Жалоба успешно закрыта.*", { parse_mode: "Markdown" });
            }
        }
        
        if (data === "appealsCheck" && user.isAdmin) {
            const appeals = await AppealSchema.find({ hidden: false });
            if (appeals.length === 0) {
                await bot.sendMessage(chatId, "📝 *Жалобы не найдены.*", { parse_mode: "Markdown" });
            } else {
                for (const appeal of appeals) {
                    const place = await PlaceSchema.findById(appeal.placeId);
                    if (place) {
                        await bot.sendMessage(chatId, `🏛 *${place.name}*\n` +
                            `📅 *Дата:* ${appeal.date.toLocaleString()}\n` +
                            `📝 *Текст:* ${appeal.text}\n\n`, 
                            {
                                parse_mode: "Markdown",
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: "🚫 Закрыть жалобу", callback_data: `hideAppeal_${appeal.id}` }]
                                    ]
                                }
                            }
                        );
                    }
                }
            }
        }

        if (data.startsWith("review_")) {
            const [_, action, reviewId] = data.split("_");
            const review = await ReviewSchema.findById(reviewId);
            if (review && !review.answeredAt) {
                review.answeredAt = new Date();
                if (action === "yes") {
                    review.couldCall = true;
                    await bot.sendMessage(chatId, "✅ *Благодарим вас за ответ!*", { parse_mode: "Markdown" });
                } else if (action === "no") {
                    review.couldCall = false;
                    await AppealSchema.create({
                        userId: user.id,
                        placeId: review.placeId,
                        text: `Не принят звонок от пользователя(${user.userId})`
                    });
                    await bot.sendMessage(chatId, "📝 *Информация будет передана для рассмотрения.*", { parse_mode: "Markdown" });
                } else if (action === "complaint") {
                    waitingComplaint[chatId] = reviewId;
                    await bot.sendMessage(chatId, "📝 *Оставьте вашу жалобу:*", { parse_mode: "Markdown" });
                }
                await review.save();
            } else if (review.answeredAt) {
                await bot.sendMessage(chatId, "❌ *Вы уже ответили на этот вопрос.*", { parse_mode: "Markdown" });
            }
            bot.answerCallbackQuery(callbackQuery.id);
        }

        const place = await PlaceSchema.findOne({ placeId: data });
        if (place) {
            await bot.sendMessage(chatId, `📞 *${place.number.join(", ")}*`, { parse_mode: "Markdown" });
            await createReminder(place.id, user.id);
            bot.answerCallbackQuery(callbackQuery.id);
        }
    });

    bot.on("message", async (msg) => {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const content = msg.text;
        var user = await UserSchema.findOne({ userId });
        if (!user) user = await UserSchema.create({ userId, chatId });
        if ((content === "/start" || !user.longitude || !user.latitude) && !msg.location) return await startMenu(bot, chatId);

        // /getCity 50.4219559561274_80.26609774562023
        if (content && content.startsWith("/getCity") && user.isAdmin) {
            const [_, coordinates] = content.split(" ");
            const [latitude, longitude] = coordinates.split("_");
            console.log(latitude, longitude);
            console.log(await getState(latitude, longitude));
        }

        if (content === "/menu") await sendMenu(chatId, bot, user);

        if (content === "/statistics" && user.isAdmin) {
            const reviews = await ReviewSchema.find();
            const totalReviews = reviews.length;
            const answeredReviews = reviews.filter(review => review.couldCall).length;
            const notAnsweredReviews = totalReviews - answeredReviews;
            const appealsCount = await AppealSchema.find({ hidden: false }); // Жалобы

            const mostReviewedPlaces = await ReviewSchema.aggregate([
                { $group: { _id: "$placeId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]);

            let mostReviewedPlacesText = '';
            for (const place of mostReviewedPlaces) {
                const placeDetails = await PlaceSchema.findById(place._id);
                if (placeDetails) {
                    mostReviewedPlacesText += `\n${placeDetails.name} - ${place.count} обращений`;
                }
            }

            const answeredPercentage = (answeredReviews / totalReviews) * 100;
            const notAnsweredPercentage = 100 - answeredPercentage;

            const chartBuffer = await generateChart(answeredPercentage, notAnsweredPercentage);

            await bot.sendMessage(chatId,
                `📊 *Статистика обращений:*\n\n` +
                `📝 *Всего обращений:* ${totalReviews}\n` +
                `✅ *Получили ответ по звонку:* ${answeredReviews}\n` +
                `❌ *Не получили ответ:* ${notAnsweredReviews}\n\n` +
                `🏢 *Наиболее используемые здания:*\n${mostReviewedPlacesText}\n\n` +
                `📈 *Количество жалоб:* ${appealsCount.length}`,
                { 
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📈 Посмотреть жалобы", callback_data: "appealsCheck" }]
                        ]
                    },
                    parse_mode: "Markdown"
                }
            );
            await bot.sendPhoto(chatId, chartBuffer);
        }

        if (waitingComplaint[userId]) {
            const review = await ReviewSchema.findById(waitingComplaint[userId]);
            if (review) {
                waitingComplaint[userId] = false;
                await AppealSchema.create({
                    userId: user.id,
                    placeId: review.placeId,
                    text: content
                });
                await bot.sendMessage(chatId, "📝 *Ваша жалоба принята!*", { parse_mode: "Markdown" });
            }
        }

        const place = await PlaceSchema.findOne({ name: content });
        if (place) {
            const { name, address, number, placeId } = place;
            const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;

            await bot.sendMessage(chatId,
                `🏛 *${name}*\n\n` +
                `📍 *Адрес:* ${address}\n` +
                `🌍 [Открыть в Google Maps](${googleMapsLink})`,
                {
                    parse_mode: "Markdown",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "📞 Позвонить", callback_data: placeId }]
                        ]
                    },
                }
            );
        }

        for (const division of organizations['types']['divisions']) {
            if (content === division) {
                const places = await PlaceSchema.find({ division });
                const keyboard = [];

                var foundPlaces = 0;

                for (const place of places) {
                    const isSamePlace = await isPlaceInSameState(user.latitude, user.longitude, place.latitude, place.longitude);
                    if (isSamePlace) {
                        foundPlaces++;
                        keyboard.push([{ text: place.name }]);
                    }
                }

                if (foundPlaces === 0) {
                    const keyboard = await createDivisionsKeyboard(user);
                    await bot.sendMessage(chatId, "*К сожалению, в вашем районе нет подходящих организаций.*", keyboard);
                } else {
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
        }
        
        if (msg.location) {
            const { latitude, longitude } = msg.location;
            const locationDetails = await getLocationDetails(latitude, longitude);
            
            if (locationDetails) {
                user.latitude = latitude;
                user.longitude = longitude;
                await user.save();

                const keyboard = await createDivisionsKeyboard(user)

                await bot.sendMessage(chatId,
                    `📍 *Ваше местоположение успешно сохранено!*\n\n` +
                    `🏙 *Область:* ${locationDetails.state}\n` +
                    `🌍 *Страна:* ${locationDetails.country}\n\n` +
                    `✨ Теперь вы можете использовать команду /menu, чтобы найти ближайшие учреждения.`,
                    {
                        parse_mode: "Markdown",
                        ...keyboard
                    }
                );
            }
        }
    });
}

module.exports = { init };
