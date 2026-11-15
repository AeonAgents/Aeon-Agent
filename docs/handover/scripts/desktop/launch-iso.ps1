# Starts the packaged Aeon.exe with its own settings, APPDATA and home folder under iso-<name> (nothing of the real profile), and the EXAONE key only in its environment.
param([string]$Name = "x")
$s = "<SCRATCH>"; $iso = "$s\iso-$Name"
New-Item -ItemType Directory "$iso\ui","$iso\appdata","$iso\home" -Force | Out-Null
$line = Get-Content "C:/Users/<you>\project\Aeon\.env" | Where-Object { $_ -like "EXAONE_API_KEY=*" } | Select-Object -First 1
$env:EXAONE_API_KEY = $line.Substring("EXAONE_API_KEY=".Length).Trim().Trim('"')
$env:AEON_UI_DIR = "$iso\ui"; $env:APPDATA = "$iso\appdata"; $env:JAVA_TOOL_OPTIONS = "-Duser.home=$iso\home"
$p = Start-Process -FilePath "C:/Users/<you>\project\Aeon\ui\composeApp\build\compose\binaries\main\app\Aeon\Aeon.exe" -PassThru
Remove-Item Env:\EXAONE_API_KEY, Env:\AEON_UI_DIR, Env:\JAVA_TOOL_OPTIONS
"launched pid $($p.Id)"
