const { groups } = require('../config/nedb');

class GroupModel {
    async create(data) {
        data.createdAt = new Date();
        // Ensure settings always exist so consumers can safely read
        // group.settings.memberCanAddOthers / onlyAdminCanPost.
        data.settings = {
            memberCanAddOthers: false,
            onlyAdminCanPost: false,
            ...(data.settings || {})
        };
        if (!data.members.includes(data.admin)) {
            data.members.push(data.admin);
        }
        return await groups.insert(data);
    }

    async findById(id) {
        return await groups.findOne({ _id: id });
    }

    async find(query) {
        return await groups.find(query);
    }

    async findByIdAndUpdate(id, update) {
        // Forward Mongo-style modifiers ($pull, $addToSet, ...) straight to NeDB;
        // wrap plain field maps in $set. Always refresh updatedAt.
        const hasOperators = Object.keys(update).some((key) => key.startsWith('$'));
        const modifier = hasOperators
            ? { ...update, $set: { ...(update.$set || {}), updatedAt: new Date() } }
            : { $set: { ...update, updatedAt: new Date() } };

        await groups.update({ _id: id }, modifier);
        return await this.findById(id);
    }

    async deleteOne(query) {
        return await groups.remove(query);
    }

    async populate(results, field, select) {
        // Simplified - just return results
        return results;
    }
}

module.exports = new GroupModel();
