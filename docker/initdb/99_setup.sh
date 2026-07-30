#!/bin/bash
# Configuración del entorno de desarrollo, posterior a la línea base.
#
# No pertenece a `database/`: la línea base son los tres scripts SQL y este archivo
# solo prepara el entorno local.
#
# Hace dos cosas:
#   1. Crea el rol de aplicación con privilegios mínimos (principio VI).
#   2. Crea una base separada para las pruebas, con la misma línea base.
#
# Las pruebas vacían tablas antes de cada caso. Si compartieran base con el desarrollo,
# cada corrida borraría las cargas y la cuenta administrativa.

set -euo pipefail

TEST_DB="${POSTGRES_DB}_test"

# --- Rol de aplicación ---------------------------------------------------------
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE ROLE bjff_app WITH LOGIN PASSWORD '${APP_DB_PASSWORD:-cambiar}';
EOSQL

grant_app_privileges() {
	local database="$1"
	psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$database" <<-EOSQL
		GRANT CONNECT ON DATABASE "$database" TO bjff_app;
		GRANT USAGE ON SCHEMA public TO bjff_app;
		GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bjff_app;
		GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bjff_app;
		ALTER DEFAULT PRIVILEGES IN SCHEMA public
		  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bjff_app;
		ALTER DEFAULT PRIVILEGES IN SCHEMA public
		  GRANT USAGE, SELECT ON SEQUENCES TO bjff_app;
	EOSQL
}

grant_app_privileges "$POSTGRES_DB"

# --- Base de pruebas -----------------------------------------------------------
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE "$TEST_DB" OWNER "$POSTGRES_USER";
EOSQL

for script in 01_schema.sql 02_functions_triggers.sql 03_views.sql; do
	psql -v ON_ERROR_STOP=1 \
		--username "$POSTGRES_USER" \
		--dbname "$TEST_DB" \
		--file "/docker-entrypoint-initdb.d/$script"
done

grant_app_privileges "$TEST_DB"

echo "Base de pruebas '$TEST_DB' lista con la línea base aplicada."
