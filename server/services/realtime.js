// Puente para que las rutas HTTP puedan emitir eventos por socket sin importar
// server.js (que las importa a ellas: seria una dependencia circular).
// server.js llama a setIO() al arrancar.
let io = null;

const setIO = (instance) => {
    io = instance;
};

// Emitir nunca debe tumbar la peticion: si el socket falla, el pedido ya se
// guardo y la notificacion queda igualmente en base de datos.
const emitToUser = (userId, event, payload) => {
    if (!io || !userId) return false;
    try {
        io.to(`user:${userId}`).emit(event, payload);
        return true;
    } catch (error) {
        console.error(`Realtime emit failed (${event}):`, error.message);
        return false;
    }
};

module.exports = { setIO, emitToUser };
