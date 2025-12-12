# Guía de Construcción - Speack3 Mobile App

Esta guía te ayudará a construir y ejecutar la aplicación móvil Speack3 en Android e iOS.

## Requisitos del Sistema

- **Node.js**: 18 o superior
- **React Native CLI**: Instalado globalmente
- **Android Studio** (para Android)
- **Xcode** (para iOS, solo macOS)
- **Java JDK**: 11 o superior (para Android)

## Configuración Inicial

### 1. Instalar Dependencias Globales

```bash
npm install -g react-native-cli
```

### 2. Instalar Dependencias del Proyecto

```bash
cd C:\Users\wilfr\OneDrive\Documentos\Speack3\mobile
npm install
```

### 3. Configurar la URL del Servidor

Edita `src/config/api.js` y actualiza con la IP de tu servidor:

```javascript
export const API_URL = 'http://192.168.1.100:3000';  // Tu IP local
export const WS_URL = 'ws://192.168.1.100:3000';     // Tu IP local
```

> 💡 **Tip**: Para obtener tu IP, ejecuta `ipconfig` en Windows

## Configuración Android

### 1. Instalar Android Studio

1. Descarga [Android Studio](https://developer.android.com/studio)
2. Instala Android SDK, Android SDK Platform, Android Virtual Device
3. Configura las variables de entorno:

```powershell
# Añade a las variables de entorno del sistema
ANDROID_HOME=C:\Users\TU_USUARIO\AppData\Local\Android\Sdk
```

Añade a PATH:

```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%ANDROID_HOME%\tools\bin
```

### 2. Configurar Proyecto Android

```bash
cd mobile
npx react-native init-android
```

### 3. Ejecutar en Emulador/Dispositivo

**Opción A: Emulador Android**

1. Abre Android Studio → AVD Manager
2. Crea y ejecuta un dispositivo virtual
3. En terminal:

```bash
npm run android
```

**Opción B: Dispositivo Físico**

1. Activa "Modo Desarrollador" en tu Android
2. Activa "Depuración USB"
3. Conecta por USB y autoriza
4. Verifica la conexión:

```bash
adb devices
```

5. Ejecuta:

```bash
npm run android
```

## Generar APK de Producción

### 1. Generar Keystore (Primera Vez)

```bash
cd android\app
keytool -genkeypair -v -storetype PKCS12 -keystore speack3-release.keystore -alias speack3 -keyalg RSA -keysize 2048 -validity 10000
```

Guarda la contraseña de forma segura.

### 2. Configurar Gradle

Edita `android/gradle.properties`:

```properties
SPEACK3_UPLOAD_STORE_FILE=speack3-release.keystore
SPEACK3_UPLOAD_KEY_ALIAS=speack3
SPEACK3_UPLOAD_STORE_PASSWORD=TU_PASSWORD
SPEACK3_UPLOAD_KEY_PASSWORD=TU_PASSWORD
```

Edita `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('SPEACK3_UPLOAD_STORE_FILE')) {
                storeFile file(SPEACK3_UPLOAD_STORE_FILE)
                storePassword SPEACK3_UPLOAD_STORE_PASSWORD
                keyAlias SPEACK3_UPLOAD_KEY_ALIAS
                keyPassword SPEACK3_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            ...
            signingConfig signingConfigs.release
        }
    }
}
```

### 3. Generar APK

```bash
cd android
.\gradlew assembleRelease
```

El APK estará en:

```
android\app\build\outputs\apk\release\app-release.apk
```

### 4. Instalar APK en Dispositivo

```bash
adb install android\app\build\outputs\apk\release\app-release.apk
```

O copia el APK al dispositivo y ábrelo.

## Configuración iOS (Solo macOS)

### 1. Instalar Dependencias

```bash
cd mobile/ios
pod install
cd ..
```

### 2. Ejecutar en Simulador

```bash
npm run ios
```

### 3. Generar IPA (App Store)

1. Abre `mobile/ios/Speack3.xcworkspace` en Xcode
2. Selecciona tu equipo de desarrollo
3. Product → Archive
4. Distribuir a App Store o Ad Hoc

## Pruebas de Desarrollo

### Metro Bundler

El servidor de desarrollo se inicia automáticamente. Si necesitas reiniciarlo:

```bash
npm start -- --reset-cache
```

### Hot Reload

- **Android**: Presiona `R` dos veces
- **iOS**: Presiona `Cmd + R`

### Debug Menu

- **Android**: Presiona `Ctrl + M` o agita el dispositivo
- **iOS**: Presiona `Cmd + D` o agita el dispositivo

## Solución de Problemas

### Error: SDK location not found

**Solución**: Crea `android/local.properties`:

```properties
sdk.dir=C:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk
```

### Error: Unable to load script from assets

**Solución**:

```bash
npx react-native start --reset-cache
```

### Error: Could not connect to development server

**Solución**: Verifica que tu PC y dispositivo estén en la misma red WiFi.

En el dispositivo Android:

1. Dev Menu → Settings → Debug server host
2. Ingresa: `192.168.1.100:8081` (tu IP:8081)

### Error: Gradle build failed

**Solución**:

```bash
cd android
.\gradlew clean
cd ..
npm run android
```

## Optimización de APK

### Habilitar ProGuard

En `android/app/build.gradle`:

```gradle
buildTypes {
    release {
        ...
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

### Generar App Bundle (AAB) para Play Store

```bash
cd android
.\gradlew bundleRelease
```

El AAB estará en:

```
android\app\build\outputs\bundle\release\app-release.aab
```

## Distribución

### Android

**Opción 1: Instalación Directa (APK)**

- Comparte el APK por WhatsApp, email, etc.
- Los usuarios deben permitir "Instalar apps de fuentes desconocidas"

**Opción 2: Google Play Store**

- Crea una cuenta de desarrollador ($25 único pago)
- Sube el AAB a Play Console
- Configura la app y publica

### iOS

**Opción 1: TestFlight** (Recomendado para ~30 usuarios)

- Requiere cuenta de Apple Developer ($99/año)
- Sube a App Store Connect
- Invita usuarios por email

**Opción 2: Ad Hoc Distribution**

- Registra UDIDs de dispositivos (máximo 100)
- Genera IPA firmada
- Distribuye por cable o herramientas como Diawi

## Próximos Pasos

1. ✅ Configura el servidor (ver `SERVER_SETUP.md`)
2. ✅ Construye la app
3. 📱 Instala en dispositivos
4. 🧪 Prueba el chat E2E cifrado
5. 🔐 Revisa `SECURITY_GUIDE.md` para mejores prácticas

## Recursos Adicionales

- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Android Developer Guide](https://developer.android.com/studio/publish)
- [iOS Distribution Guide](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases)
