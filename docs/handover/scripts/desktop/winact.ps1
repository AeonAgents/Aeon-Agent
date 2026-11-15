# usage: winact.ps1 -Do click -X 600 -Y 1200   (window-relative physical pixels)
#        winact.ps1 -Do type -Text "abc"      (types into the focused control)
#        winact.ps1 -Do key -Text "{ENTER}"
#        winact.ps1 -Do shot -Out path.png
param([string]$Do, [int]$X = 0, [int]$Y = 0, [string]$Text = "", [string]$Out = "", [string]$Match = "Aeon")
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W2 { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y); [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; } }
"@
[W2]::SetProcessDPIAware() | Out-Null
$p = Get-Process | Where-Object { $_.MainWindowTitle -like "*$Match*" -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { "no window"; exit 1 }
[W2]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
$r = New-Object W2+RECT
[W2]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
switch ($Do) {
  "click" { [W2]::SetCursorPos($r.L + $X, $r.T + $Y) | Out-Null; Start-Sleep -Milliseconds 150; [W2]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [W2]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero); "clicked $X,$Y" }
  "type" { foreach ($c in $Text.ToCharArray()) { $s = [string]$c; if ("+^%~(){}[]".Contains($s)) { $s = "{" + $s + "}" }; [System.Windows.Forms.SendKeys]::SendWait($s); Start-Sleep -Milliseconds 40 }; "typed $($Text.Length) chars" }
  "key" { [System.Windows.Forms.SendKeys]::SendWait($Text); "key $Text" }
  "shot" {
    Start-Sleep -Milliseconds 700
    [W2]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
    $w = $r.R - $r.L; $h = $r.B - $r.T
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
    $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
    "saved $w x $h"
  }
}
