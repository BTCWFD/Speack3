const { groups } = require('../config/nedb');

class GroupModel {
    async create(data) {
        data.createdAt = new Date();
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
        await groups.update({ _id: id }, { $set: update });
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
