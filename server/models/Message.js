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

    // Find DIRECT messages addressed to `recipientId` that were never delivered
    // (recipient was offline when they were sent), ordered oldest-first so they
    // can be flushed in chronological order on reconnect. Group messages have no
    // `recipient` field and are intentionally excluded.
    async findUndelivered(recipientId) {
        return await this.find(
            { recipient: recipientId, messageType: 'direct', delivered: false },
            { sort: { createdAt: 1 } }
        );
    }

    async findByIdAndUpdate(id, update) {
        // Forward Mongo-style modifiers ($pull, $addToSet, $set, ...) straight to
        // NeDB; wrap plain field maps in $set.
        const hasOperators = Object.keys(update).some((key) => key.startsWith('$'));
        const modifier = hasOperators ? update : { $set: update };

        await messages.update({ _id: id }, modifier);
        return await this.findById(id);
    }

    async deleteOne(query) {
        return await messages.remove(query);
    }

    async populate(results, field, select) {
        // Simplified populate - just return results
        return results;
    }
}

module.exports = new MessageModel();
