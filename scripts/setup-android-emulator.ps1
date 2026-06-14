<#
.SYNOPSIS
  One-shot setup of an Android emulator to test the Speack3 app on Windows.

.DESCRIPTION
  Installs a JDK (via winget), the Android command-line tools + SDK packages,
  creates an AVD, and (optionally) launches it. Idempotent: re-running skips
  steps that are already done.

  Requirements:
   - winget (App Installer) — preinstalled on Windows 11.
   - ~6-8 GB free disk for the SDK + system image.
   - Hardware acceleration: enable "Windows Hypervisor Platform" (WHPX)
     in "Turn Windows features on or off", or the emulator will be very slow.

.USAGE
  powershell -ExecutionPolicy Bypass -File scripts/setup-android-emulator.ps1
  # then, to just launch later:
  powershell -File scripts/setup-android-emulator.ps1 -LaunchOnly
#>
param(
    [switch]$LaunchOnly,
    [string]$AvdName = 'speack3',
    [string]$ApiLevel = '34'
)

$ErrorActionPreference = 'Stop'
$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$cmdlineBin = Join-Path $sdkRoot 'cmdline-tools\latest\bin'
$image = "system-images;android-$ApiLevel;google_apis;x86_64"

function Write-Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }

if (-not $LaunchOnly) {
    Write-Step "1/5 Install JDK 17 (winget)"
    if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
        winget install --id Microsoft.OpenJDK.17 --accept-package-agreements --accept-source-agreements --silent
        $env:Path += ";$env:ProgramFiles\Microsoft\jdk-17*\bin"
    } else { Write-Host "java already present" }

    Write-Step "2/5 Android command-line tools"
    if (-not (Test-Path $cmdlineBin)) {
        $zip = Join-Path $env:TEMP 'cmdline-tools.zip'
        $url = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip'
        Write-Host "Downloading $url"
        Invoke-WebRequest -Uri $url -OutFile $zip
        $tmp = Join-Path $env:TEMP 'cmdline-tools-extract'
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
        Expand-Archive $zip $tmp -Force
        New-Item -ItemType Directory -Force -Path (Join-Path $sdkRoot 'cmdline-tools\latest') | Out-Null
        Copy-Item (Join-Path $tmp 'cmdline-tools\*') (Join-Path $sdkRoot 'cmdline-tools\latest') -Recurse -Force
    } else { Write-Host "cmdline-tools already installed" }

    $env:ANDROID_HOME = $sdkRoot
    $env:ANDROID_SDK_ROOT = $sdkRoot
    $env:Path += ";$cmdlineBin;$sdkRoot\platform-tools;$sdkRoot\emulator"

    Write-Step "3/5 SDK packages (platform-tools, platform, build-tools, system image, emulator)"
    cmd /c "echo y| `"$cmdlineBin\sdkmanager.bat`" --licenses" | Out-Null
    & "$cmdlineBin\sdkmanager.bat" "platform-tools" "platforms;android-$ApiLevel" "build-tools;$ApiLevel.0.0" "$image" "emulator"

    Write-Step "4/5 Create AVD '$AvdName'"
    $avds = & "$cmdlineBin\avdmanager.bat" list avd 2>$null
    if ($avds -notmatch $AvdName) {
        cmd /c "echo no| `"$cmdlineBin\avdmanager.bat`" create avd -n $AvdName -k `"$image`" --device pixel_5"
    } else { Write-Host "AVD '$AvdName' already exists" }

    Write-Step "Persist env vars (user scope)"
    [Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdkRoot, 'User')
    [Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $sdkRoot, 'User')
}

Write-Step "5/5 Launch emulator '$AvdName'"
$emulator = Join-Path $sdkRoot 'emulator\emulator.exe'
if (-not (Test-Path $emulator)) { throw "Emulator not found. Run without -LaunchOnly first." }
Write-Host "Starting emulator (first boot takes a few minutes)..."
Start-Process $emulator -ArgumentList "-avd", $AvdName, "-no-snapshot-load"
Write-Host "`nWhen the emulator has booted, in another terminal:" -ForegroundColor Green
Write-Host "  cd mobile; npx react-native run-android"
