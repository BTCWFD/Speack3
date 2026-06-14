# 🚀 Desplegar Speack3 Ahora

¡Todo está listo! Completé la configuración que faltaba (carpeta Android + dependencias).

## Pasos para Desplegar (Instalar en tu celular)

### 1. Inicia el Servidor (Terminal 1)

Asegúrate de que tu PC y celular estén en la misma WiFi.

```powershell
cd server
node server.js
```

### 2. Conecta tu Celular

1. Conecta tu Android por USB al PC.
2. Asegúrate de tener **Depuración USB** activada en Opciones de Desarrollador.
3. Confirma el permiso en la pantalla del celular si aparece.

### 3. Instala la App (Terminal 2)

Abre una **nueva** terminal y ejecuta:

```powershell
cd mobile
npx react-native run-android
```

---

## ⚠️ Si tienes errores

**Error: "SDK location not found"**

1. Abre `mobile/android` en Android Studio.
2. Deja que detecte el SDK automáticamente.
3. O crea un archivo `mobile/android/local.properties` con:
   `sdk.dir=C:\\Users\\<TU_USUARIO>\\AppData\\Local\\Android\\Sdk`

**Error: "Metro bundler"**
Si la app se cierra o queda en blanco:

1. Ejecuta `npx react-native start` en otra terminal.
2. Presiona `r` para recargar.
