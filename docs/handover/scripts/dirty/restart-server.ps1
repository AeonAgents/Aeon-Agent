Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*cli.ts*serve*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1
Start-Process -FilePath powershell -ArgumentList '-NoProfile','-File',(Join-Path $PSScriptRoot 'serve-real.ps1') -WindowStyle Hidden
for ($i = 0; $i -lt 20; $i++) { Start-Sleep -Milliseconds 500; try { $r = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:7421/v1/hello -TimeoutSec 2; if ($r.StatusCode -eq 200) { 'server up'; break } } catch {} }
