# Original User Request

## Initial Request — 2026-06-26T09:44:59Z

# Borrador de Prompt para el Proyecto en Equipo

> Estado: Paso 9 — Ensamblaje y Validación (Listo para aprobación del usuario)
> Objetivo: Crear el prompt → obtener aprobación del usuario → delegar al sistema teamwork_preview

El objetivo es obtener una cuenta Always Free en Oracle Cloud. El equipo de agentes debe utilizar el navegador para ingresar a la página de registro de Oracle, comenzar a llenar las partes no sensibles del formulario y luego pausar la ejecución para permitir al usuario ingresar manualmente su información confidencial (tarjeta de crédito, número de teléfono, verificación de correo electrónico).

Directorio de trabajo: ~/teamwork_projects/oracle_signup
Modo de integridad: development

## Requisitos

### R1. Navegación Web
El agente debe iniciar una sesión de navegador y dirigirse a la página oficial de registro de Oracle Cloud Free Tier.

### R2. Cesión de Control para Datos Sensibles
El agente debe completar los campos básicos iniciales (si los hay) y luego pausar explícitamente su ejecución, notificando al usuario que se requiere intervención humana para completar la verificación OTP y el ingreso de la tarjeta de crédito.

## Criterios de Aceptación

### Estado del Navegador
- [ ] El navegador queda abierto en el formulario de registro de Oracle Cloud.
- [ ] El agente pausa correctamente la ejecución en lugar de intentar adivinar o generar información sensible falsa.
- [ ] Se envía un mensaje claro al usuario indicando los pasos que debe seguir para continuar.

---
*Siguiente paso: al ser aprobado → delegar vía invoke_subagent*
