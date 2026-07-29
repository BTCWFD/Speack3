const { orders } = require('../config/database');

// status:        'waitlist' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
// paymentStatus: 'unpaid' | 'pending' | 'paid'
// paymentMethod: 'nequi' | 'crypto' | 'breb' | 'manual' | null
class OrderModel {
    async create(data) {
        data.createdAt = new Date();
        data.status = data.status || 'waitlist';
        data.paymentStatus = data.paymentStatus || 'unpaid';
        return await orders.insert(data);
    }

    async findById(id) {
        return await orders.findOne({ _id: id });
    }

    async find(query = {}, options = {}) {
        let results = orders.find(query);
        if (options.sort) results = results.sort(options.sort);
        return await results;
    }

    async findByIdAndUpdate(id, update) {
        const hasOperators = Object.keys(update).some((key) => key.startsWith('$'));
        const modifier = hasOperators
            ? { ...update, $set: { ...(update.$set || {}), updatedAt: new Date() } }
            : { $set: { ...update, updatedAt: new Date() } };

        await orders.update({ _id: id }, modifier);
        return await this.findById(id);
    }
}

module.exports = new OrderModel();
