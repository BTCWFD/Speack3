const { notifications } = require('../config/database');

// Avisos de la tienda (pedido nuevo, cambio de estado). Se guardan en base de
// datos y ademas se emiten por socket: el socket solo llega si la persona esta
// conectada en ese momento, y el vendedor necesita enterarse aunque tuviera la
// app cerrada.
//
// NO son mensajes de chat: los mensajes van cifrados de extremo a extremo y el
// servidor no tiene las claves para redactar uno en nombre de nadie.
class NotificationModel {
    async create(data) {
        data.createdAt = new Date();
        data.read = false;
        return await notifications.insert(data);
    }

    async findForUser(userId, { unreadOnly = false, limit = 50 } = {}) {
        const query = { userId };
        if (unreadOnly) query.read = false;
        return await notifications.find(query).sort({ createdAt: -1 }).limit(limit);
    }

    async countUnread(userId) {
        const rows = await notifications.find({ userId, read: false });
        return rows.length;
    }

    async markRead(id, userId) {
        // El userId va en el filtro para que nadie marque leidas las de otro.
        await notifications.update({ _id: id, userId }, { $set: { read: true, readAt: new Date() } });
        return await notifications.findOne({ _id: id });
    }

    async markAllRead(userId) {
        return await notifications.update(
            { userId, read: false },
            { $set: { read: true, readAt: new Date() } },
            { multi: true }
        );
    }
}

module.exports = new NotificationModel();
