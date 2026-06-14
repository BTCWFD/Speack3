# Speack3 - Aplicación de Chat Cifrado E2E

<div align="center">

🔒 **Mensajería Segura con Cifrado End-to-End**

[![React Native](https://img.shields.io/badge/React_Native-0.73-61DAFB?logo=react)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![Signal Protocol](https://img.shields.io/badge/Signal_Protocol-E2E-blue)](https://signal.org/docs/)
[![NeDB](https://img.shields.io/badge/NeDB-embedded-orange)](https://github.com/seald/nedb)

</div>

## 🚀 Probar / Compartir

| | Enlace |
|---|---|
| 📥 **Descargar APK** (Android, build de debug) | [Releases → apk-latest](https://github.com/BTCWFD/Speack3/releases/tag/apk-latest) |
| ☁️ **Desplegar el servidor** (1 clic, gratis) | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BTCWFD/Speack3) |

> El APK se genera automáticamente en la nube con GitHub Actions (workflow *Build Android APK*).
> El servidor se despliega con el blueprint [`render.yaml`](render.yaml) (Render soporta WebSocket en el plan free).

## 📋 Descripción

Speack3 es una aplicación de mensajería segura diseñada para grupos pequeños (~30 personas) con cifrado End-to-End usando **Signal Protocol**, el mismo sistema de cifrado utilizado por WhatsApp y Signal.

### ✨ Características Principales

- 🔐 **Cifrado E2E** con Signal Protocol
- 💬 **Chat 1-a-1** privado y seguro
- 👥 **Grupos privados** con administración de miembros
- ⚡ **Tiempo Real** con WebSocket
- 📱 **Multiplataforma** (Android e iOS)
- 🖥️ **Servidor Propio** (self-hosted)
- ✅ **Confirmaciones de lectura** y entrega
- ⌨️ **Indicadores de escritura**
- 🔑 **Almacenamiento Seguro** de claves

## 🏗️ Arquitectura

```
┌─────────────────┐         ┌──────────────────┐
│ React Native    │  HTTP   │   Node.js +      │
│ Mobile App      │◄────────┤   Express        │
│                 │         │                  │
│ - Signal E2E    │  WSS    │   Socket.io      │
│ - React Nav     │◄────────┤                  │
│ - AsyncStorage  │         │   NeDB (embebida)│
│ - Keychain      │         │   JWT Auth       │
└─────────────────┘         └──────────────────┘
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- Android Studio (para Android)
- Xcode (para iOS, solo macOS)

> **Base de datos:** el servidor usa **NeDB** (embebida, basada en archivos bajo `server/data/`).
> No necesitas instalar ni configurar MongoDB para desarrollo local.

### 1. Configurar el Servidor

```bash
# Navegar al directorio del servidor
cd server

# Instalar dependencias
npm install

# Configurar variables de entorno
copy .env.example .env
# Edita .env con tus configuraciones

# Iniciar servidor
npm run dev
```

Ver [SERVER_SETUP.md](SERVER_SETUP.md) para instrucciones detalladas.

### 2. Configurar la App Móvil

```bash
# Navegar al directorio móvil
cd mobile

# Instalar dependencias
npm install

# Configurar API URL
# Edita src/config/api.js con la IP de tu servidor

# Android
npm run android

# iOS (solo macOS)
npm run ios
```

Ver [BUILD_GUIDE.md](BUILD_GUIDE.md) para construcción de APK/IPA.

## 📱 Capturas de Pantalla

| Login | Chat List | Conversación |
|-------|-----------|--------------|
| <img src="docs/screenshots/login.png" width="200" /> | <img src="docs/screenshots/chat-list.png" width="200" /> | <img src="docs/screenshots/chat.png" width="200" /> |

## 🔐 Seguridad

Speack3 implementa múltiples capas de seguridad:

### Cifrado End-to-End (E2E)

- **Signal Protocol** con Double Ratchet Algorithm
- **Forward Secrecy**: Cada mensaje usa claves efímeras únicas
- **Claves Privadas**: Nunca salen del dispositivo del usuario

### Almacenamiento Seguro

- **iOS Keychain** / **Android Keystore** para claves privadas
- **bcrypt** para hashing de passwords (10 rondas)
- **JWT** con tokens de acceso (1h) y refresh (7d)

### Transporte Seguro

- **HTTPS** para API REST
- **WSS** (WebSocket Secure) para mensajería en tiempo real
- **CORS** configurado para orígenes permitidos

Ver [SECURITY_GUIDE.md](SECURITY_GUIDE.md) para detalles completos.

## 📦 Estructura del Proyecto

```
Speack3/
├── server/                 # Backend Node.js
│   ├── api/               # REST API endpoints
│   ├── models/            # MongoDB models
│   ├── sockets/           # WebSocket handlers
│   ├── middleware/        # Auth middleware
│   └── server.js          # Entry point
│
├── mobile/                # React Native App
│   ├── src/
│   │   ├── screens/       # Pantallas (Login, Chat, etc.)
│   │   ├── components/    # Componentes reutilizables
│   │   ├── services/      # Signal, API, Socket, Storage
│   │   ├── context/       # React Context (Auth)
│   │   ├── navigation/    # React Navigation
│   │   └── config/        # Configuración
│   ├── android/           # Proyecto Android nativo
│   ├── ios/               # Proyecto iOS nativo
│   └── App.js             # Entry point
│
├── SERVER_SETUP.md        # Guía configuración servidor
├── BUILD_GUIDE.md         # Guía construcción app
├── SECURITY_GUIDE.md      # Guía de seguridad
└── README.md              # Este archivo
```

## 🛠️ Stack Tecnológico

### Backend

- **Node.js** + **Express** - Servidor HTTP/REST API
- **Socket.io** - WebSocket para tiempo real
- **NeDB** - Base de datos embebida basada en archivos (sin servidor de BD externo)
- **JWT** - Autenticación
- **bcrypt** - Hashing de passwords

### Frontend (Mobile)

- **React Native** 0.73 - Framework móvil
- **React Navigation** - Navegación
- **React Native Paper** - UI Components (Material Design)
- **Signal Protocol** - Cifrado E2E
- **Socket.io Client** - WebSocket
- **AsyncStorage** - Persistencia local
- **React Native Keychain** - Almacenamiento seguro

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [SERVER_SETUP.md](SERVER_SETUP.md) | Configuración e instalación del servidor |
| [BUILD_GUIDE.md](BUILD_GUIDE.md) | Construcción de APK/IPA y distribución |
| [SECURITY_GUIDE.md](SECURITY_GUIDE.md) | Detalles de seguridad y Signal Protocol |

## 🧪 Testing

### Servidor

```bash
cd server
npm test
```

### App Móvil

```bash
cd mobile
npm test
```

## 🚢 Despliegue

### Servidor

Para producción, se recomienda:

1. **Cloud Server**: AWS EC2, DigitalOcean, etc.
2. **SSL/TLS**: Let's Encrypt o certificado comercial
3. **Process Manager**: PM2 para gestión de procesos
4. **Reverse Proxy**: Nginx para HTTPS

```bash
# Ejemplo con PM2
pm2 start server.js --name speack3-server
pm2 save
pm2 startup
```

### App Móvil

**Android:**

- APK directo para distribución privada
- Google Play Store para distribución pública

**iOS:**

- TestFlight para beta testing (~30 usuarios)
- App Store para distribución pública

Ver [BUILD_GUIDE.md](BUILD_GUIDE.md) para detalles.

## 🤝 Contribuciones

Contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Añadir nueva funcionalidad'`)
4. Push a la branch (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 🐛 Reportar Problemas

Para reportar bugs o solicitar funcionalidades:

1. Verifica que no exista un issue similar
2. Crea un nuevo issue con detalles:
   - Descripción del problema
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Screenshots si aplica
   - Logs relevantes

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 🙏 Agradecimientos

- [Signal Foundation](https://signal.org/) por el Signal Protocol
- [React Native Community](https://reactnative.dev/) por el framework
- Todos los contribuidores de librerías open-source utilizadas

## 📞 Contacto

Para preguntas o soporte:

- 💬 Issues: [GitHub Issues](https://github.com/BTCWFD/Speack3/issues)

---

**Desarrollado con ❤️ para comunicación segura y privada**

<div align="center">
  
**Versión 1.0.0** | Diciembre 2025

</div>
