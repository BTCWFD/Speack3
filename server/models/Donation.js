const { donations } = require('../config/database');

// Aportes VOLUNTARIOS de los vendedores para sostener el desarrollo de la app.
//
// No son una comision ni una condicion para vender: nada en el codigo consulta
// si alguien dono para decidir si puede operar. Si algun dia se condicionara el
// acceso a haber donado, dejaria de ser una donacion y pasaria a ser una tarifa,
// con las implicaciones tributarias que eso trae.
//
// status: 'reported' (el vendedor dice que transfirio) | 'confirmed' (el admin
// verifico que llego) | 'rejected' (no aparecio)
class DonationModel {
    async create(data) {
        data.createdAt = new Date();
        data.status = 'reported';
        return await donations.insert(data);
    }

    async findById(id) {
        return await donations.findOne({ _id: id });
    }

    async findByUser(userId) {
        return await donations.find({ userId }).sort({ createdAt: -1 });
    }

    async findAll() {
        return await donations.find({}).sort({ createdAt: -1 });
    }

    async findByIdAndUpdate(id, update) {
        await donations.update({ _id: id }, { $set: { ...update, updatedAt: new Date() } });
        return await this.findById(id);
    }

    // Total efectivamente confirmado. Se cuenta solo lo verificado: sumar lo
    // meramente reportado inflaria la cifra con transferencias que nunca
    // llegaron.
    async confirmedTotal() {
        const all = await donations.find({ status: 'confirmed' });
        return all.reduce((sum, d) => sum + (d.amountCOP || 0), 0);
    }
}

module.exports = new DonationModel();
