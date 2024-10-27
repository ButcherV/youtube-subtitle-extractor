const mongoose = require("mongoose");

const ProcessedVideoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  videoId: { type: String, required: true },
  data: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now },
});

ProcessedVideoSchema.index({ userId: 1, videoId: 1 }, { unique: true });

module.exports = mongoose.model("ProcessedVideo", ProcessedVideoSchema);
