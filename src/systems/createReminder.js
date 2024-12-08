const { ReviewSchema } = require("../models");

async function createReminder(placeId, userId) {
    const halfADayAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const recentReviews = await ReviewSchema.find({ 
        placeId, 
        userId, 
        remindAt: { $gte: halfADayAgo } 
    });
    if (recentReviews.length === 0) {
        await ReviewSchema.create({ 
            placeId, 
            userId, 
            couldCall: false,
            remindAt: new Date(Date.now() + 1 * 60 * 1000)
        });
        console.log("[Reminder] Successfully created reminder for", userId, placeId);
    }
}

module.exports = { createReminder };