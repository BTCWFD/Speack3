// Comprueba que una cadena de conexion de MongoDB funciona de verdad: conecta,
// escribe, lee y borra. Sirve para validar un cluster de Atlas ANTES de
// desplegar, en vez de descubrir el fallo en los logs del hosting.
//
// Uso (desde server/):
//   node scripts/check-mongo.js "mongodb+srv://usuario:pass@cluster0.xxx.mongodb.net/speack3"
//
// O con la variable de entorno, para no dejar la credencial en el historial:
//   MONGODB_URI="..." node scripts/check-mongo.js
const { MongoClient } = require('mongodb');

const uri = process.argv[2] || process.env.MONGODB_URI;

if (!uri) {
    console.error('Falta la cadena de conexion.\n');
    console.error('  node scripts/check-mongo.js "mongodb+srv://..."');
    console.error('  MONGODB_URI="mongodb+srv://..." node scripts/check-mongo.js');
    process.exit(1);
}

// Nunca imprimir la contrasena, por si la salida se pega en un chat o un issue.
const safeUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

// Traduce los fallos habituales de Atlas a algo accionable.
const explain = (err) => {
    const msg = err.message || String(err);

    if (/Authentication failed|bad auth/i.test(msg)) {
        return [
            'Usuario o contrasena incorrectos.',
            '  - Revisa Database Access en Atlas (es el usuario de BASE DE DATOS,',
            '    no el de tu cuenta de MongoDB).',
            '  - Si la contrasena lleva @ : / ? # o %, hay que codificarla en la URL',
            '    (@ -> %40, # -> %23, etc.). Lo mas simple es generar una sin simbolos.'
        ].join('\n');
    }
    if (/ServerSelection|ETIMEDOUT|ENOTFOUND|querySrv/i.test(msg)) {
        return [
            'No se pudo alcanzar el cluster.',
            '  - Network Access en Atlas debe permitir 0.0.0.0/0 (las IPs de salida',
            '    de Render son dinamicas en el plan gratis).',
            '  - Comprueba tambien que el host del mongodb+srv:// este bien escrito.'
        ].join('\n');
    }
    return msg;
};

(async () => {
    console.log(`Conectando a: ${safeUri}\n`);
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

    try {
        await client.connect();
        const db = client.db();
        console.log(`  ok  conexion establecida (base: ${db.databaseName})`);

        await db.command({ ping: 1 });
        console.log('  ok  el servidor responde al ping');

        // Escritura + lectura + borrado: permisos reales, no solo conectividad.
        const probe = db.collection('_speack3_check');
        const { insertedId } = await probe.insertOne({ at: new Date() });
        console.log('  ok  permiso de escritura');

        const found = await probe.findOne({ _id: insertedId });
        if (!found) throw new Error('el documento escrito no se pudo leer');
        console.log('  ok  permiso de lectura');

        await probe.drop();
        console.log('  ok  permiso de borrado (limpieza hecha)');

        console.log('\nLISTO: la cadena sirve. Pegala en MONGODB_URI dentro de Render.');
    } catch (err) {
        console.error('\nFALLO:\n');
        console.error(explain(err));
        process.exitCode = 1;
    } finally {
        await client.close().catch(() => {});
    }
})();
