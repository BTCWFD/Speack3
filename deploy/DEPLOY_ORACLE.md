# Desplegar Speack3 en Oracle Cloud (Always Free) — $0/mes

Esta guía deja el servidor online, persistente y con HTTPS/WSS, **gratis para
siempre**, en una VM Always Free de Oracle Cloud. Tiempo: ~30 min.

> Para ~100 usuarios sobra. La VM Always Free (Ampere ARM) trae hasta 4 CPU y
> 24 GB de RAM gratis — más que de sobra.

---

## 0. Lo que vas a tener
- Backend en `https://tu-dominio` con WebSocket seguro (`wss://`).
- NeDB en un volumen persistente (no se borra al reiniciar/redesplegar).
- Certificado Let's Encrypt con renovación automática.
- Backup diario automático (últimos 14 días).

## 1. Crear la cuenta y la VM (en la consola de Oracle)
1. Crea cuenta en https://www.oracle.com/cloud/free/ (pide tarjeta solo para
   verificar; los recursos "Always Free" no se cobran).
2. **Compute → Instances → Create instance**:
   - Imagen: **Canonical Ubuntu 22.04**.
   - Shape: **Ampere (VM.Standard.A1.Flex)**, 1–2 OCPU / 6–12 GB RAM (Always Free).
     Si no hay capacidad ARM en tu región, usa **VM.Standard.E2.1.Micro** (AMD, también Free).
   - Añade tu **clave SSH pública**.
   - Crea la instancia y anota su **IP pública**.

## 2. Abrir los puertos 80 y 443 (paso clave de Oracle)
Oracle bloquea todo por defecto en dos capas:
1. **Security List / NSG (consola)**: Networking → tu VCN → Security Lists →
   añade **Ingress Rules**: source `0.0.0.0/0`, TCP, puertos **80** y **443**.
2. **Firewall del sistema**: lo abre el script automáticamente (`iptables`).

## 3. Apuntar un dominio a la VM
Necesitas un dominio para el HTTPS (Let's Encrypt no emite para IPs):
- **Gratis**: crea un subdominio en https://www.duckdns.org (p.ej. `speack3.duckdns.org`)
  y ponle la **IP pública** de la VM.
- **Propio**: en tu registrador, crea un registro **A** → IP pública de la VM.

Verifica que resuelve: `ping tu-dominio` debe dar la IP de la VM.

## 4. Desplegar (SSH a la VM)
```bash
ssh ubuntu@TU_IP_PUBLICA

# Clonar el repo
sudo apt-get update -y && sudo apt-get install -y git
git clone https://github.com/BTCWFD/Speack3.git
cd Speack3/deploy

# Ejecutar el setup (dominio + tu email para Let's Encrypt)
chmod +x setup-oracle.sh backup.sh
./setup-oracle.sh tu-dominio.duckdns.org tu@email.com
```
El script instala Docker, abre el firewall, genera los secretos JWT, obtiene el
certificado y arranca todo. Al terminar verás:
```
✅ Done. Speack3 is live at: https://tu-dominio.duckdns.org
```
Pruébalo: abre `https://tu-dominio.duckdns.org/health` → debe responder `{"status":"ok"}`.

## 5. Conectar la app móvil
En `mobile/src/config/api.js` pon tu dominio:
```js
const PROD_HOST = 'tu-dominio.duckdns.org';
```
Luego genera el APK (el workflow de GitHub Actions lo construye, o local con
`assembleRelease`). La app usará `https://`/`wss://` automáticamente en release.

## 6. Operación diaria
- **Ver logs**: `docker compose -f docker-compose.prod.yml logs -f server`
- **Actualizar** tras un `git pull`:
  ```bash
  cd ~/Speack3/deploy
  git pull
  docker compose -f docker-compose.prod.yml up -d --build
  ```
- **Backups**: automáticos a las 03:30 en `deploy/backups/`. Restaurar:
  ```bash
  docker run --rm -v deploy_speack3_data:/data -v $PWD/backups:/b alpine \
    sh -c "cd /data && tar xzf /b/speack3-data-XXXX.tgz"
  docker compose -f docker-compose.prod.yml restart server
  ```
- **Renovación TLS**: automática (contenedor certbot cada 12 h).

## 7. Coste real
- VM Oracle Always Free: **$0**
- HTTPS (Let's Encrypt): **$0**
- Dominio DuckDNS: **$0** (o tu dominio ~$1–12/año)
- **Total: $0/mes** para ~100 usuarios.

## Solución de problemas
- **No carga / timeout**: casi siempre es el paso 2 (faltan las Ingress Rules en
  la Security List de Oracle). Revísalo.
- **Certbot falla**: el dominio aún no apunta a la IP, o el puerto 80 no está
  abierto. Verifica DNS y reglas, y re-ejecuta el script.
- **Sin capacidad ARM**: usa el shape AMD E2.1.Micro (también Always Free).
