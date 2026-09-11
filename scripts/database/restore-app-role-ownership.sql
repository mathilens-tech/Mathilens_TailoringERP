-- Restores ownership of mathilens_ecommerce_db to the application's Postgres role.
--
-- WHEN YOU NEED THIS
-- The API applies migrations itself on startup (Program.cs), which means its login must own the
-- schema — it ALTERs existing tables, not just reads them. If the database is ever recreated
-- while connected as the server admin (`dotnet ef database drop` / `database update`, or a
-- restore), every object ends up owned by `mathilensadmin` instead, and the app dies on boot with:
--
--     Npgsql.PostgresException 42501: permission denied for table __EFMigrationsHistory
--
-- Azure App Service then serves HTTP 503 "Application Error" and the container exits with 134.
--
-- Run this as `mathilensadmin`, connected to mathilens_ecommerce_db:
--
--   az postgres flexible-server execute \
--     -n pg-mathilens-55e31706 -u mathilensadmin -p '<admin password>' \
--     -d mathilens_ecommerce_db \
--     --file-path scripts/database/restore-app-role-ownership.sql
--
-- Then restart the Web App so it retries startup:
--
--   az webapp restart -n api-mathilens-erp -g rg-mathilens-prod
--
-- NOTE ON SCOPE
-- pg-mathilens-55e31706 is shared by several products (mathilens_db, nanest_db, resumemaker_db,
-- mathiexam_tnpsc_db, construction_db_prod). Everything below is scoped to the `public` schema of
-- the database you are connected to. Deliberately NOT `REASSIGN OWNED BY mathilensadmin` — that
-- also transfers *shared* objects, which would hand the other products' databases to this app's
-- role. The per-object loop is the safe equivalent.

-- Giving ownership away requires membership of the receiving role.
GRANT mathilens_ecommerce_app TO mathilensadmin;

ALTER DATABASE mathilens_ecommerce_db OWNER TO mathilens_ecommerce_app;
ALTER SCHEMA public OWNER TO mathilens_ecommerce_app;

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

-- Verification: every row should read mathilens_ecommerce_app, and the count should be non-zero.
SELECT tableowner, COUNT(*) AS tables
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY tableowner;
