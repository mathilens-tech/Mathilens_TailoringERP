# Resetting the Owner password

A runbook for the one case the application cannot cover itself: **nobody can sign in as an Owner
any more**, so there is no authenticated caller left to perform a reset through the API.

Owner is the only role that can grant and revoke access. If the last Owner login is lost, no one
can add users, change role rights, or restore access — which is why this path exists outside the
application entirely.

---

## Before you start: is this actually the right tool?

**If anyone can still sign in as an Owner, stop and use the app instead.**

> **Users → Reset password**

Same result, no connection string, no direct database access — and it is recorded in the Activity
Log. The tool below deliberately bypasses that trail, because it is meant for the case where there
is nobody left to record.

Use this runbook only when every Owner login is inaccessible.

---

## What you need

| | |
|---|---|
| **.NET SDK** | Same major version the solution targets (`dotnet --version`) |
| **A working copy of the repo** | The tool is not deployed anywhere — see "Why it is not an endpoint" below |
| **The production connection string** | Held in `dotnet user-secrets` for `src/Api` |
| **Network access to the database** | Azure PostgreSQL Flexible Server only accepts allow-listed IPs |

If your IP is not allow-listed the connection **times out** rather than returning an auth error, so
a hang here is a firewall problem, not a password problem:

```bash
az postgres flexible-server firewall-rule create \
  -g rg-mathilens-prod -n pg-mathilens-55e31706 \
  --rule-name my-laptop \
  --start-ip-address <your-ip> --end-ip-address <your-ip>
```

---

## Step 1 — Load the connection string

The tool reads `MATHILENS_CONNECTION`, or takes `--connection` on each command. Setting it once is
easier and keeps the string out of your shell history:

```bash
cd <repo root>
export MATHILENS_CONNECTION=$(dotnet user-secrets list --project src/Api | sed -n 's/^ConnectionStrings:Default = //p')
```

PowerShell:

```powershell
$env:MATHILENS_CONNECTION = (dotnet user-secrets list --project src\Api |
  Select-String '^ConnectionStrings:Default = ' | ForEach-Object { $_.Line -replace '^ConnectionStrings:Default = ' })
```

Check it is set without printing the password:

```bash
echo "${MATHILENS_CONNECTION%%Password=*}"
```

---

## Step 2 — List the accounts (read-only)

Always do this first. It changes nothing, and it proves both the connection and the firewall work
before anything writes:

```bash
dotnet run --project tools/ResetPassword -- --list
```

Each account is listed with the roles it holds. **Find the account that holds `Owner`, not the one
whose address looks administrative** — the two need not agree. In this shop, `manager@mathilens.com`
holds Owner.

If this step fails, fix that before going further; nothing below will work either.

---

## Step 3 — Reset the password

Leave `--password` off. The tool prompts for it, so the password never enters your shell history:

```bash
dotnet run --project tools/ResetPassword -- --email <owner-email>
```

It prints the account and its roles, asks for confirmation, and only then writes.

The password must satisfy the API's rules or the login screen will reject what the tool accepted
(`src/Infrastructure/DependencyInjection.cs`):

| Rule | Value |
|---|---|
| Minimum length | 8 |
| Digit | required |
| Lowercase letter | required |
| Uppercase letter | required |
| Non-alphanumeric | *not* required |

---

## Step 4 — Sign in and confirm

<https://kind-field-0d7def410.7.azurestaticapps.net/login>

---

## What the reset does to existing sessions

A successful reset **revokes every refresh token** for that account. The practical effect:

- Anyone signed in as that account keeps working for up to **15 minutes**, until their current
  access token expires.
- After that they cannot renew, and are returned to the login screen.

So there is a short window where the old session still functions. If someone is mid-order on a shop
tablet, that is the window they have.

---

## Flags

| Flag | Effect |
|---|---|
| `--list` | List accounts and their roles. Read-only. |
| `--email <address>` | Whose password to set. Required unless `--list`. |
| `--password <value>` | Set without prompting. Avoid — see below. |
| `--connection <string>` | Overrides `MATHILENS_CONNECTION`. |
| `--yes` / `-y` | Skip the confirmation prompt. For scripting only. |
| `--help` / `-h` | Usage. |

---

## Why this is not an API endpoint

`deploy-api.yml` publishes `src/Api` only, so nothing in `tools/` ever ships to Azure. Running this
requires the production connection string in hand, which is the intended bar: a password reset that
needs no authentication must not be reachable over HTTP.

## Why you cannot do this in SQL

`"Users"."PasswordHash"` is a PBKDF2 blob whose format, salt and iteration count are ASP.NET Core
Identity's to decide. There is no SQL expression that produces a valid one — `crypt()` and `md5()`
included. The tool calls Identity's own `PasswordHasher<TUser>` at the version the API references,
so what it writes is byte-for-byte what the API would have written.

**An `UPDATE` against that column with any hand-made value locks the account out permanently**, and
on production the Owner is the account you least want to lose.

---

## Handling the credential afterwards

- **Prefer the prompt.** `--password` puts the value in your shell history, in CI logs, and in any
  transcript of the session. Use it only when scripting, and change the password afterwards.
- **Change it again through the app** once you are signed in — Users → Reset password. That records
  the change in the Activity Log, which this tool does not.
- **Do not reuse** the temporary password anywhere else.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Command hangs, then times out | Your IP is not allow-listed on the Azure firewall (see "What you need") |
| `no connection string` | `MATHILENS_CONNECTION` is unset and `--connection` was not passed |
| `--email is required` | Pass `--email`, or `--list` to see what exists |
| Account not found | The address does not exist — run `--list`; addresses are exact |
| Reset succeeds, login still fails | The password does not meet the rules in Step 3, or you reset an account that does not hold Owner |
| `permission denied for table ...` (42501) | Unrelated to this tool: schema ownership has drifted. See `scripts/database/restore-app-role-ownership.sql` |
