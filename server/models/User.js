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
    await users.update({ _id: id }, { $set: { ...update, updatedAt: new Date() } });
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
