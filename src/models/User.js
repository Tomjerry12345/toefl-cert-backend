const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    nonce: {
      type: String,
      default: () => crypto.randomBytes(16).toString("hex"),
    },
    role: {
      type: String,
      default: "admin",
    },
  },
  { timestamps: true },
);

userSchema.methods.refreshNonce = async function () {
  this.nonce = crypto.randomBytes(16).toString("hex");
  await this.save();
};

module.exports = mongoose.model("User", userSchema);
