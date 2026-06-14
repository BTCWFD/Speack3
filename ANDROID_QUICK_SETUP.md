# Configuración Rápida de Android para React Native

## Paso 1: Configurar Variables de Entorno (CRÍTICO)

Ejecuta esto en PowerShell:

```powershell
# Configurar ANDROID_HOME
[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')

# Añadir al PATH
$currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
$newPaths = @(
    "$env:LOCALAPPDATA\Android\Sdk\platform-tools",
    "$env:LOCALAPPDATA\Android\Sdk\emulator",
    "$env:LOCALAPPDATA\Android\Sdk\tools",
    "$env:LOCALAPPDATA\Android\Sdk\tools\bin"
)

foreach ($newPath in $newPaths) {
    if ($currentPath -notlike "*$newPath*") {
        $currentPath += ";$newPath"
    }
}

[System.Environment]::SetEnvironmentVariable('Path', $currentPath, 'User')

# Refrescar variables en sesión actual
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools"
$env:Path += ";$env:LOCALAPPDATA\Android\Sdk\emulator"

Write-Host "✅ Variables configuradas. Cierra y abre PowerShell para aplicar cambios."
```

## Paso 2: Instalar Android SDK Command Line Tools

Si Android Studio ya se configuró, debería estar en:
`C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk`

Si NO está, descarga manualmente:

1. <https://developer.android.com/studio#command-tools>
2. Extrae en `C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk\cmdline-tools\latest`

## Paso 3: Instalar Componentes Necesarios

```powershell
# Navega al SDK
cd $env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin

# Instala los componentes
.\sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0" "system-images;android-33;google_apis;x86_64"

# Acepta licencias
.\sdkmanager --licenses
```

## Paso 4: Crear Emulador

```powershell
# Crear AVD (Android Virtual Device)
avdmanager create avd -n Speack3_Emulator -k "system-images;android-33;google_apis;x86_64" -d pixel_5

# Listar emuladores
emulator -list-avds
```

## Paso 5: Iniciar Emulador

```powershell
# Abrir emulador en background
emulator -avd Speack3_Emulator &
```

## Paso 6: Inicializar React Native con Estructura Nativa

```powershell
cd C:\Users\<TU_USUARIO>\<RUTA_AL_PROYECTO>\Speack3

# Crear proyecto nuevo con estructura completa
npx react-native init Speack3Native

# Copiar nuestro código
Copy-Item -Path "mobile\src" -Destination "Speack3Native\src" -Recurse -Force
Copy-Item -Path "mobile\App.js" -Destination "Speack3Native\App.js" -Force

# Instalar dependencias
cd Speack3Native
npm install
```

## Paso 7: Ejecutar en Emulador

```powershell
# En una terminal (con emulador corriendo)
npx react-native run-android
```

## Verificación Rápida

```powershell
# Verificar que todo está configurado
adb version
emulator -version
react-native doctor
```

## Si hay problemas

**ADB no reconocido:**
→ Cierra y abre PowerShell (variables de entorno)

**Emulador no inicia:**
→ Ve a Android Studio → AVD Manager → crea uno manualmente

**Gradle error:**
→ `cd Speack3Native\android && .\gradlew clean`
