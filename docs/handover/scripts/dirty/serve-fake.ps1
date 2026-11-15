# The real EXAONE service with a WRONG key (the real key's characters shuffled), so its own refusal reaches the app.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = "C:/Users/<you>\project\Aeon"
$env:AEON_CONFIG_DIR = Join-Path $here "cfg"
Set-Location $repo
$env:EXAONE_API_KEY = (node --env-file=.env -e "const c=[...process.env.EXAONE_API_KEY];for(let i=c.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[c[i],c[j]]=[c[j],c[i]]}process.stdout.write(c.join(''))")
node src/node/cli.ts serve --workspace (Join-Path $here "ws") --host 0.0.0.0 --port 7421 *> (Join-Path $here "server.log")
