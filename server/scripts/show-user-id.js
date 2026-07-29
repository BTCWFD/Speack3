// Imprime el id de un usuario ya registrado, para ponerlo en SHOP_ADMIN_USER_ID.
//
// Uso (desde server/), con la misma MONGODB_URI que usa el despliegue:
//   MONGODB_URI="mongodb+srv://..." node scripts/show-user-id.js tu@correo.com
//
// Sin argumento lista todos los usuarios, util cuando no recuerdas con que
// correo te registraste.
const dns = require('dns');
const { MongoClient } = require('mongodb');

// Node no siempre resuelve los SRV de Atlas con el DNS del sistema (pasa en
// algunas redes/Windows); forzar resolutores publicos evita un ECONNREFUSED
// que no tiene nada que ver con las credenciales.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const uri = process.env.MONGODB_URI;
const email = process.argv[2];

if (!uri) {
    console.error('Falta MONGODB_URI.\n');
    console.error('  MONGODB_URI="mongodb+srv://..." node scripts/show-user-id.js tu@correo.com');
    process.exit(1);
}

(async () => {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const users = client.db().collection('users');

        const query = email ? { email: email.toLowerCase() } : {};
        const found = await users.find(query).project({ _id: 1, email: 1, username: 1 }).toArray();

        if (found.length === 0) {
            console.error(
                email
                    ? `No hay ningun usuario con el correo ${email}. Registrate primero en la app.`
                    : 'No hay usuarios registrados todavia.'
            );
            process.exit(1);
        }

        for (const user of found) {
            console.log(`${user._id}  ${user.email}  (${user.username})`);
        }

        if (email) {
            console.log(`\nPon esto en el entorno del servidor:\n  SHOP_ADMIN_USER_ID=${found[0]._id}`);
        }
    } catch (error) {
        console.error('No se pudo consultar la base de datos:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
})();
