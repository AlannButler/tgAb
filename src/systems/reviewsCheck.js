const { ReviewSchema, UserSchema, PlaceSchema } = require("../models");

const reviewCheck = async (bot) => {
    console.log("[ReviewCheck] Checking for reviews...");
    const reviews = await ReviewSchema.find({ remindAt: { $lte: new Date() }, answeredAt: null, reminded: false });
    for (const review of reviews) {
        const user = await UserSchema.findById(review.userId);
        const place = await PlaceSchema.findById(review.placeId);
        if (user && place) {
            await bot.sendMessage(user.chatId, `📞 *${place.number.join(", ")}*\n\nВы смогли дозвониться?`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✔️ Да", callback_data: `review_yes_${review.id}` }, { text: "❌ Нет", callback_data: `review_no_${review.id}` }],
                        [{ text: "✉️ Есть жалоба", callback_data: `review_complaint_${review.id}` }]
                    ]
                },
                parse_mode: "Markdown"
            });

            review.reminded = true;
            await review.save();
        }
    }
}

module.exports = { reviewCheck };