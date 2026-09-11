# Test environment — the VM in `admin@mathilens.com`

The test stack runs on one Ubuntu 24.04 server, replacing three Azure resources that lived in the
`iammurali.mng@gmail.com` account:

| Was (Azure, `rg-mathilens-prod`) | Is now (VM) |
| --- | --- |
| `api-radhafabric-test` — App Service | the API under systemd, on loopback:5000 |
| `swa-radhafabric-test` — Static Web App | nginx serving the static export |
| test database on `pg-mathilens-55e31706` | local Postgres, listening on loopback only |

The point is not cost — the test App Service shared `asp-mathilens-prod` and was free. It is that
test previously shared a resource group, an App Service plan, a Key Vault and a Postgres server
with production **and three unrelated products**, on a credential (`mathilens_ecommerce_app`) that
also owns a production database. Nothing on this box can reach any of that.

## Files

| File | Purpose |
| --- | --- |
| `setup.sh` | One-time provisioning. Idempotent. |
| `mathilens-api.service` | systemd unit for the API. |
| `nginx-site.conf` | The site: static files, and `/api/` proxied to Kestrel. |
| `generate-nginx-routes.mjs` | Builds nginx rewrites from `web/staticwebapp.config.json`. |
| `copy-test-database.sh` | One-time database copy off Azure. |

Deploys come from [`.github/workflows/deploy-test.yml`](../../.github/workflows/deploy-test.yml)
on every push to `dev`.

## First-time setup, in order

Order matters. Each step assumes the one before it worked.

**1. Provision**

```bash
git clone https://github.com/code-with-murali/Mathilens_TailoringERP.git
cd Mathilens_TailoringERP/deploy/test-server
sudo PG_MAJOR=16 ./setup.sh
```

Set `PG_MAJOR` to production's major version, not the default — check it with:

```bash
az postgres flexible-server show -n pg-mathilens-55e31706 -g rg-mathilens-prod --query version
```

**2. DNS**

Point `www.test-radhafabric.mathilens.com` at this server's public IP. It currently resolves to
`swa-radhafabric-test`, so this is the cutover. Wait for it to resolve before the next step —
certbot validates over HTTP and will fail otherwise.

**3. Certificate**

```bash
sudo certbot --nginx -d www.test-radhafabric.mathilens.com
```

Run this *after* `setup.sh`, not before: certbot edits the nginx site in place to add the `:443`
block, and re-running `setup.sh` would overwrite that work.

**4. Database**

Confirm the source database name first — the repo names two candidates and only the deployed app
knows which is real:

```bash
az webapp config appsettings list -g rg-mathilens-prod -n api-radhafabric-test -o table
```

Then follow the header of `copy-test-database.sh`: open a firewall rule on the Azure server for
this box's IP, run the script, **and close the rule again**.

**5. GitHub runner**

Install the self-hosted runner from the repo's Settings → Actions → Runners, then:

```bash
sudo usermod -aG mathilens-deploy <runner-user>
sudo systemctl restart actions.runner.*
```

Give it the labels `self-hosted`, `linux`, `mathilens-test`. The group membership is what lets it
write `/opt/mathilens-api` and `/var/www/mathilens-test` without sudo; the restart is what makes
the new group take effect.

**6. Deploy**

Push to `dev`, or run the workflow by hand. It builds both halves, regenerates the nginx rewrites,
restarts the API, and smoke-tests the site and `/api/v1/auth/login` before reporting success.

## Only then: decommission Azure

Once test is verified working on the VM:

```bash
az webapp delete            -g rg-mathilens-prod -n api-radhafabric-test
az staticwebapp delete      -g rg-mathilens-prod -n swa-radhafabric-test --yes
az postgres flexible-server execute -n pg-mathilens-55e31706 -u mathilensadmin -p '<pw>' \
  -d postgres --querytext "DROP DATABASE mathilens_radhafabric_test;"
```

Retire the now-unused GitHub secrets `AZURE_WEBAPP_PUBLISH_PROFILE_TEST` and
`AZURE_STATIC_WEB_APPS_API_TOKEN_SWA_RADHAFABRIC_TEST`, and delete
`scripts/database/grant-app-role-ownership-radhafabric-test.sql` — it repairs an ownership problem
that cannot occur here.

**Do this last.** While those resources exist, rolling back is a DNS change; once the publish
profile is gone it cannot be regenerated.

## How this differs from production

Worth knowing, because these are the gaps where a bug can reach production without test seeing it.

**Database ownership.** Azure creates databases as `mathilensadmin`, so the app role cannot `ALTER`
its own schema and the startup migration dies with `42501` → HTTP 503. That is what
[`scripts/database/`](../../scripts/database/) exists to repair. Here the database is created
*owned by* `mathilens_test_app`, so the failure has no way to happen — good for test stability, but
it means the production footgun is never rehearsed.

**CORS.** Production splits Static Web Apps and App Service across two origins, so
`Cors:FrontendOrigin` is load-bearing there. Here the site and API share one origin behind nginx
and no preflight ever occurs. The setting is still configured correctly, just unexercised.

**Forwarded headers.** App Service tells the app the original scheme by itself. Behind nginx,
Kestrel sees a plain HTTP hop and `app.UseHttpsRedirection()` would answer 307 to HTTPS, which
nginx proxies back as HTTP — an infinite redirect. `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` in
the unit file is what prevents it. Production does not need it and does not set it.

**Scale.** One instance, as production is. The session check in `Program.cs` uses an in-process
cache, so neither environment can scale beyond one instance without breaking "one signed-in place
per account".

## Adding a new `[id]` route

Add it to `web/staticwebapp.config.json` and nothing else. Production reads that file directly;
the deploy workflow generates the nginx equivalent from it. Editing only one of the two is how
test and production start disagreeing about which pages exist.
