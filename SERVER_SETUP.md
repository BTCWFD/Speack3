# Configuración del Servidor - Speack3

Esta guía te ayudará a configurar y ejecutar el servidor backend de Speack3.

## Requisitos del Sistema

- **Node.js**: 18 o superior
- **MongoDB**: 5.0 o superior
- **Sistema Operativo**: Windows, macOS, o Linux

## Instalación

### 1. Instalar MongoDB

**Windows:**
1. Descarga MongoDB Community Server desde [mongodb.com](https://www.mongodb.com/try/download/community)
2. Ejecuta el instalador y sigue las instrucciones
3. MongoDB se instalará como servicio de Windows

**Iniciar MongoDB:**
```powershell
net start MongoDB
```

### 2. Instalar Dependencias del Servidor

```bash
cd C:\Users\<TU_USUARIO>\<RUTA_AL_PROYECTO>\Speack3\server
npm install
```

### 3. Configurar Variables de Entorno

Copia `.env.example` a `.env`:

```bash
copy .env.example .env
```

Edita `.env` y configura las siguientes variables:

```env
PORT=3000
NODE_ENV=development

# MongoDB URI
MONGODB_URI=mongodb://localhost:27017/speack3

# JWT Secrets (CAMBIAR EN PRODUCCIÓN)
JWT_SECRET=tu_secreto_super_seguro_aqui
JWT_REFRESH_SECRET=tu_secreto_refresh_super_seguro_aqui
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# CORS - Añade las IPs de tus dispositivos móviles
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:19006
```

> ⚠️ **IMPORTANTE**: Cambia los JWT secrets en producción usando cadenas aleatorias largas.

## Ejecución del Servidor

### Modo Desarrollo

```bash
npm run dev
```

### Modo Producción

```bash
npm start
```

El servidor iniciará en `http://localhost:3000`

### Verificar que Funciona

Abre en el navegador: `http://localhost:3000/health`

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2025-12-12T...",
  "uptime": 123.45
}
```

## Configuración de Red (Para Dispositivos Móviles)

Para que dispositivos móviles puedan conectarse:

### 1. Obtener tu IP Local

**Windows:**
```powershell
ipconfig
```

Busca "IPv4 Address" (ej: `192.168.1.100`)

### 2. Actualizar CORS en `.env`

```env
ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.100:3000
```

### 3. Configurar Firewall

**Windows Firewall:**
1. Panel de Control → Sistema y Seguridad → Firewall de Windows Defender
2. Configuración Avanzada → Reglas de Entrada → Nueva Regla
3. Puerto → TCP → Puerto 3000 → Permitir conexión
4. Aplicar a todos los perfiles

## Configuración SSL/TLS (Producción)

Para producción, necesitas HTTPS y WSS (WebSocket Secure):

### 1. Obtener Certificado SSL

Opciones:
- [Let's Encrypt](https://letsencrypt.org/) (gratis)
- Certificado de tu proveedor de hosting
- Certificado autofirmado (solo desarrollo)

### 2. Configurar Certificados

Coloca los archivos en `server/certs/`:
- `private.key` - Clave privada
- `certificate.crt` - Certificado

Actualiza `.env`:
```env
SSL_KEY_PATH=./certs/private.key
SSL_CERT_PATH=./certs/certificate.crt
```

### 3. Modificar `server.js` para HTTPS

```javascript
const https = require('https');
const fs = require('fs');

const httpsOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH)
};

const server = https.createServer(httpsOptions, app);
```

## Solución de Problemas

### Error: MongoDB no conecta

```
❌ MongoDB connection error: connect ECONNREFUSED
```

**Solución:**
1. Verifica que MongoDB esté corriendo: `net start MongoDB`
2. Verifica la URI en `.env`

### Error: Puerto ya en uso

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solución:**
Cambia el puerto en `.env`:
```env
PORT=3001
```

### Error: Cannot find module

**Solución:**
```bash
npm install
```

## Monitoreo y Logs

Los logs se muestran en consola. Para producción, considera usar:
- PM2 para gestión de procesos
- Winston para logging avanzado (ya incluido)

### Usar PM2 (Recomendado para Producción)

```bash
npm install -g pm2
pm2 start server.js --name speack3-server
pm2 save
pm2 startup
```

## Mantenimiento

### Backup de Base de Datos

```bash
mongodump --db speack3 --out ./backup
```

### Restaurar Backup

```bash
mongorestore --db speack3 ./backup/speack3
```

## Próximos Pasos

Una vez el servidor esté corriendo correctamente:
1. Configura la aplicación móvil (ver `BUILD_GUIDE.md`)
2. Actualiza la `API_URL` en la app móvil con tu IP
3. Prueba el registro de usuarios desde la app

## Soporte

Para problemas o preguntas, revisa:
- `SECURITY_GUIDE.md` para información de seguridad
- Los logs del servidor para errores específicos
