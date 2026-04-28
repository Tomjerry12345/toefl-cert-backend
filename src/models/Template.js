const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    // URL gambar background (disimpan di Cloudinary)
    backgroundImageUrl: {
      type: String,
      default: null,
    },
    // HTML template dengan placeholder {{nama}}, {{nim}}, dll
    htmlTemplate: {
      type: String,
      required: true,
    },
    // Field yang digunakan dalam template ini
    fields: {
      type: [String],
      default: ["holderName", "nim", "score", "testDate", "expiryDate", "institution"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      default: "system",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Template", templateSchema);
