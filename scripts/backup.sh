#!/bin/bash

# Script de backup do banco de dados Atena
# Executa backup diário do PostgreSQL

BACKUP_DIR="./backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/atena-db_$DATE.sql"

# Criar diretório de backups se não existir
mkdir -p $BACKUP_DIR

echo "🔄 Iniciando backup do banco de dados..."

# Fazer dump do banco
docker exec postgres pg_dump -U postgres -d atena-db > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    # Comprimir o backup
    gzip "$BACKUP_FILE"
    echo "✅ Backup criado: ${BACKUP_FILE}.gz"
    
    # Manter apenas os últimos 30 backups
    ls -t $BACKUP_DIR/*.gz 2>/dev/null | tail -n +31 | xargs -r rm
    echo "🧹 Backups antigos removidos (mantendo últimos 30)"
else
    echo "❌ Erro ao criar backup!"
    exit 1
fi

echo "📊 Backups disponíveis:"
ls -lh $BACKUP_DIR/*.gz 2>/dev/null | tail -5
