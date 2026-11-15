# Starts the real Aeon server with the real EXAONE key (from the project's .env) on a scratch config and workspace.
# Usage: powershell -File serve-real.ps1            (keeps the config; the device stays paired)
param([string]$Port = "7421")
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = "C:/Users/<you>\project\Aeon"
$env:AEON_CONFIG_DIR = Join-Path $here "cfg"
Set-Location $repo
node --env-file=.env src/node/cli.ts serve --workspace (Join-Path $here "ws") --host 0.0.0.0 --port $Port --web (Join-Path $repo "ui\composeApp\build\dist\wasmJs\productionExecutable") *> (Join-Path $here "server.log")
