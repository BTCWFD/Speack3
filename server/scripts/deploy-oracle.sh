#!/bin/bash
# Script de Despliegue para Oracle Cloud (Ubuntu)
# Ejecutar este script UNA VEZ dentro de la máquina virtual de Oracle

echo "=== Iniciando Instalación de Dependencias para SPEACK3 ==="

# 1. Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# 2. Instalar Node.js (v20) y Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 3. Verificar instalación
node_version=$(node -v)
npm_version=$(npm -v)
echo "✅ Node instalado: $node_version"
echo "✅ NPM instalado: $npm_version"

# 4. Clonar el repositorio
echo "=== Clonando repositorio de GitHub ==="
# NOTA: Si el repo es privado, te pedirá credenciales. Si es público, funcionará directo.
git clone https://github.com/BTCWFD/Speack3.git
cd Speack3/server

# 5. Instalar dependencias del servidor
echo "=== Instalando dependencias de Node ==="
npm install

# 6. Instalar PM2 para mantener el servidor vivo en background
echo "=== Configurando PM2 ==="
sudo npm install -g pm2
pm2 start src/index.js --name "speack3-api"

# 7. Configurar PM2 para que inicie con el sistema
pm2 startup
pm2 save

echo "=========================================================="
echo "🚀 ¡Servidor SPEACK3 desplegado exitosamente!"
echo "El servidor está corriendo en el puerto 3000."
echo "No olvides abrir el puerto 3000 en el Firewall de Oracle Cloud (VCN Security Lists)."
echo "=========================================================="
