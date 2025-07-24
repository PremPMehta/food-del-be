const mongoose = require("mongoose");

const adsSchema = new mongoose.Schema({
  thumbnail: {
    type: String,
    required: true,
  },
  visibility: {
    type: String,
    required: true,
  },
  memberType: {
    type: String,
    default: false,
  },
  link: {
    type: String,
    required: true,
  },
});

const AdsModel = mongoose.model("ads", adsSchema);

module.exports = AdsModel;
