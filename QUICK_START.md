# Guía Rápida de Inicio - Speack3

## Problema Actual: MongoDB

MongoDB se instaló pero necesita permisos de Administrador para iniciarse.

## Soluciones

### Opción 1: Usar NeDB (Recomendada para iniciar rápido)

NeDB es una base de datos ligera compatible con MongoDB que no requiere instalación.

**Ventajas:**

- ✅ No requiere permisos de admin
- ✅ Funciona inmediatamente
- ✅ Perfecto para ~30 usuarios
- ✅ Compatible con el código actual

**Desventajas:**

- ⚠️ Menos rendimiento que MongoDB (suficiente para 30 usuarios)
- ⚠️ Almacena datos en archivos locales

### Opción 2: Iniciar MongoDB (Producción)

**Pasos:**

1. Cierra esta terminal
2. Abre **PowerShell como Administrador**:
   - Click derecho en el menú inicio
   - "Windows PowerShell (Administrador)"
3. Ejecuta:

   ```powershell
   net start MongoDB
   ```

4. Vuelve a esta terminal y continúa

## Recomendación

Para probar rápidamente la app: **Usa Opción 1 (NeDB)**

Para producción: Usa MongoDB (Opción 2)

## Tu IP Local

Tu IP es: `10.68.77.175`

Ya está configurada en la app móvil.

## Siguiente Paso

**¿Qué opción prefieres?**

- Responde "1" para NeDB (rápido)
- Responde "2" para MongoDB (después de ejecutar como admin)
