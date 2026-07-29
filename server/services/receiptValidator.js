// Validacion del comprobante de pago que sube el comprador.
//
// El comprobante es una captura de una transferencia: lleva nombres, numeros de
// cuenta y a veces saldos. Por eso se valida de verdad en vez de aceptar
// cualquier cadena: si se guardara texto arbitrario bajo el nombre "imagen",
// cualquier cliente podria meter payloads que despues se sirven a otro usuario.
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// ~4 MB de base64 = ~3 MB de imagen. Suficiente para una captura de pantalla y
// acotado para no llenar el plan gratuito de la base de datos: cada pedido con
// comprobante ocupa ese espacio para siempre.
const MAX_BASE64_LENGTH = 4_000_000;

const DATA_URI_RE = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i;

function validateReceipt(value) {
    if (typeof value !== 'string' || value.length === 0) {
        return { ok: false, error: 'El comprobante debe ser una imagen en data URI' };
    }

    if (value.length > MAX_BASE64_LENGTH) {
        return {
            ok: false,
            status: 413,
            error: 'La imagen es muy grande. Envia una captura mas liviana (menos de 3 MB).'
        };
    }

    const match = DATA_URI_RE.exec(value);
    if (!match) {
        return { ok: false, error: 'Formato de imagen invalido' };
    }

    const mime = match[1].toLowerCase();
    if (!ALLOWED_TYPES.includes(mime)) {
        return { ok: false, error: `Tipo de imagen no permitido (${mime}). Usa PNG, JPG o WEBP.` };
    }

    // El largo de un base64 valido siempre es multiplo de 4.
    if (match[2].length % 4 !== 0) {
        return { ok: false, error: 'La imagen llego incompleta o corrupta' };
    }

    return { ok: true, mime };
}

module.exports = { validateReceipt, MAX_BASE64_LENGTH, ALLOWED_TYPES };
