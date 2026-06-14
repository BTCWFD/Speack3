const bcrypt = require('bcryptjs');
const { users } = require('../config/nedb');

class UserModel {
  async create(userData) {
    if (userData.password) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
    }
    userData.createdAt = new Date();
    userData.online = false;
    userData.lastSeen = new Date();
    return await users.insert(userData);
  }

  async findOne(query) {
    return await users.findOne(query);
  }

  async findById(id) {
    return await users.findOne({ _id: id });
  }

  async findByIdAndUpdate(id, update) {
    // NeDB natively supports Mongo-style modifiers ($set, $pull, $addToSet, $push...).
    // If the caller already passed modifiers, forward them as-is (just refreshing
    // updatedAt inside $set). Otherwise treat `update` as a plain field map.
    const hasOperators = Object.keys(update).some((key) => key.startsWith('$'));
    const modifier = hasOperators
      ? { ...update, $set: { ...(update.$set || {}), updatedAt: new Date() } }
      : { $set: { ...update, updatedAt: new Date() } };

    await users.update({ _id: id }, modifier);
    return await this.findById(id);
  }

  async find(query = {}) {
    return await users.find(query);
  }

  async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}

module.exports = new UserModel();
