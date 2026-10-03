\set ON_ERROR_STOP on
\getenv migration_password DB_MIGRATION_PASSWORD
\getenv app_password DB_PASSWORD

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'migration_user', :'migration_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migration_user')
\gexec
ALTER ROLE :"migration_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
  PASSWORD :'migration_password';

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec
ALTER ROLE :"app_user" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD :'app_password';

GRANT CONNECT ON DATABASE :"database_name" TO :"migration_user";
GRANT CONNECT ON DATABASE :"database_name" TO :"app_user";
GRANT USAGE, CREATE ON SCHEMA public TO :"migration_user";
GRANT USAGE ON SCHEMA public TO :"app_user";

SELECT format('ALTER TABLE %I.%I OWNER TO %I', namespace.nspname, relation.relname, :'migration_user')
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
JOIN pg_roles AS owner ON owner.oid = relation.relowner
WHERE namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p')
  AND owner.rolname = :'admin_user'
\gexec

SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', namespace.nspname, relation.relname, :'migration_user')
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
JOIN pg_roles AS owner ON owner.oid = relation.relowner
WHERE namespace.nspname = 'public'
  AND relation.relkind = 'S'
  AND owner.rolname = :'admin_user'
\gexec

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_user" IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO :"app_user";
