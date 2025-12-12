const { messages } = require('../config/nedb');

class MessageModel {
    async create(data) {
        data.createdAt = new Date();
        return await messages.insert(data);
    }

    async findById(id) {
        return await messages.findOne({ _id: id });
    }

    async find(query, options = {}) {
        let results = messages.find(query);
        if (options.sort) results = results.sort(options.sort);
        if (options.limit) results = results.limit(options.limit);
        if (options.skip) results = results.skip(options.skip);
        return await results;
    }

    async findByIdAndUpdate(id, update) {
        await messages.update({ _id: id }, { $set: update });
        return await this.findById(id);
    }

    async populate(results, field, select) {
        // Simplified populate - just return results
        return results;
    }
}

module.exports = new MessageModel();
