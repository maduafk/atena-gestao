#!/bin/bash

# Script de restauração do banco de dados Atena
# Restaura um backup do PostgreSQL

BACKUP_DIR="./backups"

# Listar backups disponíveis
echo "📋 Backups disponíveis:"
echo ""
ls -lh $BACKUP_DIR/*.gz 2>/dev/null
echo ""

if [ -z "$1" ]; then
    echo "❌ Uso: ./scripts/restore.sh <nome_do_arquivo.sql.gz>"
    echo ""
    echo "Exemplo: ./scripts/restore.sh backups/atena-db_2026-02-03_10-00-00.sql.gz"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Arquivo não encontrado: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  ATENÇÃO: Isso vai SUBSTITUIR todos os dados atuais!"
read -p "Tem certeza que deseja continuar? (digite 'sim' para confirmar): " confirm

if [ "$confirm" != "sim" ]; then
    echo "❌ Restauração cancelada."
    exit 0
fi

echo "🔄 Restaurando backup..."

# Descomprimir e restaurar
gunzip -c "$BACKUP_FILE" | docker exec -i atena-postgres psql -U postgres -d atena-db

if [ $? -eq 0 ]; then
    echo "✅ Backup restaurado com sucesso!"
else
    echo "❌ Erro ao restaurar backup!"
    exit 1
fi
