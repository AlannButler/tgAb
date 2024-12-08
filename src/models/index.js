const mongoose = require("mongoose");
const organizations = require("../settings/organizations.json");

const UserSchema = mongoose.model("TgBotAbai-Users", new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
        required: true,
    },
    chatId: {
        type: String,
        required: true,
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    latitude: {
        type: Number,
        min: -180,
        max: 180
    },
    longitude: {
        type: Number,
        min: -90,
        max: 90,
    }
}));

const AppealSchema = mongoose.model("TgBotAbai-Appeal", new mongoose.Schema({
    userId: {
        ref: "TgBotAbai-Users",
        type: String,
        required: true,
    },
    placeId: {
        ref: "TgBotAbai-Places",
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
    },
    text: {
        type: String,
        required: true,
    },
    hidden: {
        type: Boolean,
        default: false,
    }
}));

const ReviewSchema = mongoose.model("TgBotAbai-Reviews", new mongoose.Schema({
    placeId: {
        ref: "TgBotAbai-Places",
        type: String,
        required: true,
    },
    userId: {
        ref: "TgBotAbai-Users",
        type: String,
        required: true,
    },
    couldCall: {
        type: Boolean,
        required: true,
        default: false,
    },
    remindAt: {
        type: Date,
        required: true,
    },
    reminded: {
        type: Boolean,
        default: false
    },
    answeredAt: Date
}));

const PlaceSchema = mongoose.model("TgBotAbai-Places", new mongoose.Schema({
    placeId: {
        type: String,
        unique: true,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    number: [{
        type: String
    }],
    address: {
        type: String,
        required: true,
    },
    latitude: {
        type: Number,
        required: true,
    },
    longitude: {
        type: Number,
        required: true,
    },
    state: {
        type: String,
        required: true
    },
    division: {
        type: String,
        required: true,
        enum: organizations['types']['divisions'],
    }
}));

module.exports = { UserSchema, AppealSchema, ReviewSchema, PlaceSchema };