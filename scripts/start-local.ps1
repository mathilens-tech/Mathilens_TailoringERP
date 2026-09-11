# Starts the local development stack: PostgreSQL, the API and the web app.
#
# WHY THE CONNECTION STRING IS SET HERE
#
# src/Api has a UserSecretsId, and the secrets file on this machine sets ConnectionStrings:Default
# to the Azure *test* database. User secrets outrank appsettings.Development.json, so `dotnet run`
# and `dotnet ef` both talk to test unless something outranks them in turn — which is what this
# environment variable does. Without it, "local" development silently reads and writes test data.
#
# The secrets file is deliberately left alone: pointing at test is presumably wanted for the times
# you actually mean to.
#
# PostgreSQL here is portable, unzipped rather than installed — EnterpriseDB refused winget's
# download. There is no Windows service, so it has to be started explicitly; that is what this
# script is mostly for. Delete C:\Users\kutty\pgsql-portable to remove it entirely.

$ErrorActionPreference = "Stop"

$PgRoot = "C:\Users\kutty\pgsql-portable"
$PgBin  = "$PgRoot\pgsql\bin"
$PgData = "$PgRoot\data"
$Repo   = "D:\mathilens\github\Mathilens_TailoringERP"

$LocalDb = "Host=localhost;Port=5432;Database=mathilens_dev;Username=postgres;Password=postgres"

# --- PostgreSQL -----------------------------------------------------------------------------
if (Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue) {
    "postgres  already listening on 5432"
} else {
    & "$PgBin\pg_ctl.exe" -D $PgData -l "$PgRoot\postgres.log" -o "-p 5432" -w start | Out-Null
    "postgres  started on 5432"
}

# --- API ------------------------------------------------------------------------------------
if (Get-NetTCPConnection -LocalPort 5232 -State Listen -ErrorAction SilentlyContinue) {
    "api       already listening on 5232"
} else {
    $env:ASPNETCORE_ENVIRONMENT     = "Development"
    $env:ConnectionStrings__Default = $LocalDb
    Start-Process -FilePath "dotnet" `
        -ArgumentList "run --project `"$Repo\src\Api\MathilensERP.Api.csproj`" --launch-profile http" `
        -WorkingDirectory $Repo -WindowStyle Minimized
    "api       starting on 5232 (local database)"
}

# --- Web ------------------------------------------------------------------------------------
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    "web       already listening on 3000"
} else {
    Start-Process -FilePath "npm" -ArgumentList "run dev" -WorkingDirectory "$Repo\web" -WindowStyle Minimized
    "web       starting on 3000"
}

""
"  http://localhost:3000        sign in: admin@mathilens.local / Admin@12345"
"  http://192.168.1.5:3000      same machine, from a phone on this wifi"
""
"To stop everything:"
"  Get-NetTCPConnection -LocalPort 3000,5232 -State Listen | ForEach-Object { Stop-Process -Id `$_.OwningProcess -Force }"
"  & `"$PgBin\pg_ctl.exe`" -D `"$PgData`" stop"
