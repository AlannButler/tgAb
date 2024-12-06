const mongoose = require("mongoose");
const organizations = require("../settings/organizations.json");

const UserSchema = mongoose.model("TgBotAbai-Users", new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
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

const ReviewSchema = mongoose.model("TgBotAbai-Reviews", new mongoose.Schema({
    id: {
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
}));

const PlaceSchema = mongoose.model("TgBotAbai-Places", new mongoose.Schema({
    id: {
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
    division: {
        type: String,
        required: true,
        enum: organizations['types']['divisions'],
    }
}));

module.exports = { UserSchema, ReviewSchema, PlaceSchema };