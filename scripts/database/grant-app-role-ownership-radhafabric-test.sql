-- Hands a newly created database to the application's Postgres role.
--
-- WHEN YOU NEED THIS
-- A database created from the portal or the CLI is owned by `mathilensadmin`, and its `public`
-- schema by `azure_pg_admin`. The API applies its own migrations on startup (Program.cs), so its
-- login has to be able to CREATE and ALTER in that schema — not merely read it. Without this the
-- first boot dies with:
--
--     Npgsql.PostgresException 42501: permission denied for table __EFMigrationsHistory
--
-- and Azure App Service serves HTTP 503 "Application Error" while the container exits with 134.
-- This is the same failure restore-app-role-ownership.sql exists to undo; running this before the
-- first deploy means it never happens in the first place.
--
-- Run as `mathilensadmin`, connected to the NEW database:
--
--   az postgres flexible-server execute \
--     -n pg-mathilens-55e31706 -u mathilensadmin -p '<admin password>' \
--     -d mathilens_radhafabric_test \
--     --file-path scripts/database/grant-app-role-ownership-radhafabric-test.sql
--
-- Then point the Web App's ConnectionStrings__Default at the database and restart it.
--
-- NOTE ON SCOPE
-- pg-mathilens-55e31706 is shared by several products (mathilens_db, resumemaker_db,
-- construction_db_prod, mathiexam_tnpsc_db, mathilens_ecommerce_db). Everything below names this
-- one database explicitly or is scoped to the `public` schema of the database you are connected
-- to. There is deliberately no REASSIGN OWNED BY — that would also move shared objects and hand
-- the other products' databases to this role.
--
-- The role reused here is `mathilens_ecommerce_app`, which is the application role this product
-- already ships with; the name is historical and does not mean the ecommerce database. A dedicated
-- role per client database would isolate them further and is worth doing when there is time for a
-- second credential and vault secret.

-- Giving ownership away requires membership of the receiving role.
GRANT mathilens_ecommerce_app TO mathilensadmin;

ALTER DATABASE mathilens_radhafabric_test OWNER TO mathilens_ecommerce_app;
ALTER SCHEMA public OWNER TO mathilens_ecommerce_app;

-- Nothing to re-own on a database that has never been migrated, but harmless and correct if this
-- is ever re-run after the schema exists.
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO mathilens_ecommerce_app', r.tablename);
    END LOOP;

    FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO mathilens_ecommerce_app', r.sequencename);
    END LOOP;

    FOR r IN SELECT viewname FROM pg_views WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER VIEW public.%I OWNER TO mathilens_ecommerce_app', r.viewname);
    END LOOP;
END $$;
