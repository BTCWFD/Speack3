# Guía de Configuración Android Studio - Speack3

## Paso 1: Primera Configuración de Android Studio

Android Studio se está abriendo. Sigue estos pasos:

### 1. Wizard de Configuración Inicial

Cuando se abra Android Studio:

1. **Welcome Screen** → Click en "Next"
2. **Install Type** → Selecciona "Standard" → Next
3. **Select UI Theme** → Elige el que prefieras → Next
4. **Verify Settings** → Click "Finish"
5. **Downloading Components** → Espera (descargará SDK, emulator, etc.)

### 2. Configurar Variables de Entorno (Importante)

Después de la instalación, configura las variables de entorno:

**Opción A: PowerShell (Temporal - para esta sesión)**

```powershell
$env:ANDROID_HOME="C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk"
$env:Path += ";C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk\platform-tools"
$env:Path += ";C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk\emulator"
```

**Opción B: Sistema (Permanente - recomendado)**

1. Busca "variables de entorno" en Windows
2. Click en "Variables de entorno"
3. En "Variables del sistema", click "Nueva":
   - Nombre: `ANDROID_HOME`
   - Valor: `C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk`
4. Edita "Path" y añade:
   - `%ANDROID_HOME%\platform-tools`
   - `%ANDROID_HOME%\emulator`
   - `%ANDROID_HOME%\tools`

### 3. Crear Emulador (AVD)

Una vez instalado el SDK:

1. En Android Studio → Click "More Actions" → "Virtual Device Manager"
2. Click "+ Create Device"
3. **Phone** → Selecciona "Pixel 5" → Next
4. **System Image** → Selecciona "Tiramisu" (API 33) → Download → Next
5. **AVD Name** → Déjalo como está → Finish

### 4. Verificar Instalación

En PowerShell:

```powershell
# Después de configurar variables de entorno
adb version
emulator -version
```

## Siguiente Paso

Una vez completado, regresa aquí y te ayudo a:

1. Inicializar React Native con estructura nativa
2. Ejecutar la app en el emulador

## Troubleshooting

**Si Android Studio no abre:**

```powershell
# Verificar que existe
Test-Path "C:\Users\<TU_USUARIO>\AppData\Local\Android\android-studio\bin\studio64.exe"

# Abrir manualmente
Start-Process "C:\Users\<TU_USUARIO>\AppData\Local\Android\android-studio\bin\studio64.exe"
```

**Si falta JDK:**
Android Studio incluye su propio JDK, pero si hay error:

```powershell
winget install Microsoft.OpenJDK.17
```
