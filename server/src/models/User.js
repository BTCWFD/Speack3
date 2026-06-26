const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  referralCode: {
    type: String,
    unique: true
  },
  referredBy: {
    type: String, // referralCode of the person who invited them
    default: null
  },
  unlockedStyles: {
    type: [String],
    default: ['simpsonize'] // Default style
  },
  nftsOwned: {
    type: [String], // Array of NFT Token IDs or transaction hashes
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
