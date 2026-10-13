param([int]$ProcessId, [string]$OutputPath = 'analysis/original/runtime/window.png', [switch]$VisibleCapture, [long]$WindowHandle = 0)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RockWindowCapture {
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
 [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int command);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint process);
}
'@
$gameProcess = Get-Process -Id $ProcessId
$handle = $gameProcess.MainWindowHandle
if ($WindowHandle) { $handle = [IntPtr]$WindowHandle }
[uint32]$windowProcess = 0
[RockWindowCapture]::GetWindowThreadProcessId($handle, [ref]$windowProcess) | Out-Null
if ($windowProcess -ne $ProcessId) { throw 'Window belongs to a different process.' }
if ($handle -eq [IntPtr]::Zero) { throw 'Selected process has no main window.' }
if ($VisibleCapture) {
 [RockWindowCapture]::ShowWindow($handle, 9) | Out-Null
 [RockWindowCapture]::SetForegroundWindow($handle) | Out-Null
 Start-Sleep -Milliseconds 500
 if ([RockWindowCapture]::GetForegroundWindow() -ne $handle) { throw 'Target is not foreground; screen capture refused.' }
}
$rectangle = New-Object RockWindowCapture+RECT
if (-not [RockWindowCapture]::GetWindowRect($handle, [ref]$rectangle)) { throw 'GetWindowRect failed.' }
$bitmap = New-Object System.Drawing.Bitmap (($rectangle.Right - $rectangle.Left), ($rectangle.Bottom - $rectangle.Top))
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
if ($VisibleCapture) {
 try { $graphics.CopyFromScreen($rectangle.Left, $rectangle.Top, 0, 0, $bitmap.Size); $captured = $true } finally { $graphics.Dispose() }
} else {
 $device = $graphics.GetHdc()
 try { $captured = [RockWindowCapture]::PrintWindow($handle, $device, 0) } finally { $graphics.ReleaseHdc($device); $graphics.Dispose() }
}
if (-not $captured) { $bitmap.Dispose(); throw 'PrintWindow failed; no screenshot retained.' }
$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
New-Item -ItemType Directory -Path ([System.IO.Path]::GetDirectoryName($resolvedOutput)) -Force | Out-Null
try { $bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png) } finally { $bitmap.Dispose() }
[pscustomobject]@{ ProcessId=$ProcessId; Executable=$gameProcess.Path; Title=$gameProcess.MainWindowTitle; Handle=$handle.ToInt64(); Path=$resolvedOutput } | ConvertTo-Json
