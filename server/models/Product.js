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

    // Descuenta stock SOLO si alcanza, en una sola operacion condicional.
    //
    // Leer el stock y luego escribirlo dejaria una ventana en la que dos
    // pedidos simultaneos leen "queda 1" y ambos descuentan: se venderia dos
    // veces lo mismo. Al meter la condicion (stock >= qty) dentro del propio
    // update, la base decide: uno gana y el otro recibe 0 modificados.
    // Mongo lo resuelve atomicamente; NeDB corre en un solo proceso.
    //
    // Devuelve true si se pudo descontar.
    async tryDecrementStock(id, qty) {
        const affected = await products.update(
            { _id: id, stock: { $gte: qty } },
            { $inc: { stock: -qty } }
        );
        return affected > 0;
    }

    // Devolver stock al cancelar. No lleva condicion: sumar siempre es seguro.
    async restoreStock(id, qty) {
        return await products.update({ _id: id }, { $inc: { stock: qty } });
    }
}

// Un producto solo controla stock si tiene un numero en `stock`. Sin ese campo
// se considera ilimitado, para no romper el catalogo que ya existe.
const tracksStock = (product) => Number.isInteger(product?.stock);

module.exports = new ProductModel();
module.exports.tracksStock = tracksStock;
