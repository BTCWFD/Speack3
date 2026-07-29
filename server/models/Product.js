const { products } = require('../config/database');

class ProductModel {
    async create(data) {
        data.createdAt = new Date();
        if (data.active === undefined) {
            data.active = true;
        }
        return await products.insert(data);
    }

    async findById(id) {
        return await products.findOne({ _id: id });
    }

    async find(query = {}) {
        return await products.find(query);
    }

    async findByIdAndUpdate(id, update) {
        const hasOperators = Object.keys(update).some((key) => key.startsWith('$'));
        const modifier = hasOperators
            ? { ...update, $set: { ...(update.$set || {}), updatedAt: new Date() } }
            : { $set: { ...update, updatedAt: new Date() } };

        await products.update({ _id: id }, modifier);
        return await this.findById(id);
    }

    async deleteOne(query) {
        return await products.remove(query);
    }
}

module.exports = new ProductModel();
