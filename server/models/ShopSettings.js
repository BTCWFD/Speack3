const { shopSettings } = require('../config/database');

// Un unico documento de configuracion de la tienda (la tienda es de un solo
// vendedor). Se guarda con _id fijo para que siempre haya como mucho uno y no
// haga falta buscar "el ultimo".
const SINGLETON_ID = 'shop';

class ShopSettingsModel {
    async get() {
        return await shopSettings.findOne({ _id: SINGLETON_ID });
    }

    async setLocation({ lat, lng, address }) {
        const existing = await this.get();
        const data = {
            location: { lat, lng, address: address || '' },
            updatedAt: new Date()
        };

        if (existing) {
            await shopSettings.update({ _id: SINGLETON_ID }, { $set: data });
        } else {
            await shopSettings.insert({ _id: SINGLETON_ID, ...data });
        }

        return await this.get();
    }

    // La tienda arranca abierta: exigir configurarla para poder vender seria
    // dejarla muda tras el primer despliegue.
    async isOpen() {
        const settings = await this.get();
        return settings?.open !== false;
    }

    async setOpen(open, byUserId) {
        const existing = await this.get();
        const data = { open: Boolean(open), openChangedAt: new Date(), openChangedBy: byUserId };

        if (existing) {
            await shopSettings.update({ _id: SINGLETON_ID }, { $set: data });
        } else {
            await shopSettings.insert({ _id: SINGLETON_ID, ...data });
        }

        return await this.get();
    }

    // Ubicacion desde la que se cotizan los domicilios. Las env vars sirven de
    // respaldo para poder desplegar con la tienda ya ubicada sin tener que
    // entrar a configurarla.
    async getLocation() {
        const settings = await this.get();
        if (settings?.location) return settings.location;

        const lat = Number(process.env.SHOP_LAT);
        const lng = Number(process.env.SHOP_LNG);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng, address: process.env.SHOP_ADDRESS || '' };
        }

        return null;
    }
}

module.exports = new ShopSettingsModel();
