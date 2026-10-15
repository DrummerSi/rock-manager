param([string]$ExecutablePath = 'E:/Games/Rock Manager/RockManager.exe')
$ErrorActionPreference = 'Stop'
$workspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $workspaceRoot
$source = (Resolve-Path -LiteralPath $ExecutablePath).Path
$sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
$outputDirectory = Join-Path $workspaceRoot 'analysis/original/runtime/reference'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RockReferenceKeys {
 [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
}
'@
Write-Host 'Open the original game on your normal Windows account.'
Write-Host 'While its window is active: Ctrl+Shift+F8 captures it. Ctrl+Shift+F9 ends recording.'
Write-Host 'Suggested states: studio; mixer; Settings; active effects; musician chooser; selected session musician.'
Write-Host 'Navigate normally. This helper does not click, hire, book, or save game state.'
$captures = @()
$manifestPath = Join-Path $outputDirectory 'captures.json'
function Expand-CaptureRecords($inputRecord) {
 if ($inputRecord -is [System.Array]) { foreach ($child in $inputRecord) { Expand-CaptureRecords $child } }
 elseif ($inputRecord.image) { $inputRecord }
 elseif ($inputRecord.value) { Expand-CaptureRecords $inputRecord.value }
}
if (Test-Path -LiteralPath $manifestPath) { $captures = @(Expand-CaptureRecords (ConvertFrom-Json -InputObject (Get-Content -LiteralPath $manifestPath -Raw))) }
$pressed = $false
while ($true) {
 $control = [RockReferenceKeys]::GetAsyncKeyState(0x11) -lt 0
 $shift = [RockReferenceKeys]::GetAsyncKeyState(0x10) -lt 0
 if ($control -and $shift -and [RockReferenceKeys]::GetAsyncKeyState(0x78) -lt 0) { break }
 $captureKey = $control -and $shift -and [RockReferenceKeys]::GetAsyncKeyState(0x77) -lt 0
 if ($captureKey -and -not $pressed) {
  $handle = [RockReferenceKeys]::GetForegroundWindow()
  [uint32]$targetProcess = 0
  [RockReferenceKeys]::GetWindowThreadProcessId($handle, [ref]$targetProcess) | Out-Null
  try {
   $gameProcess = Get-Process -Id $targetProcess -ErrorAction Stop
   if ($gameProcess.Path -ne $source) { throw 'The selected original executable must be in the foreground.' }
   # Never reuse a filename after a restart or malformed historical manifest.
   $nextNumber = 1
   do { $name = 'native-{0:D3}.png' -f $nextNumber; $nextNumber++ } while (Test-Path -LiteralPath (Join-Path $outputDirectory $name))
   $relativeOutput = 'analysis/original/runtime/reference/' + $name
   $capture = & (Join-Path $PSScriptRoot 'capture-original-window.ps1') -ProcessId $targetProcess -WindowHandle $handle.ToInt64() -OutputPath $relativeOutput -VisibleCapture | ConvertFrom-Json
   $captures += [pscustomobject]@{ timestamp=(Get-Date).ToUniversalTime().ToString('o'); image=$name; source=$source; sourceSHA256=$sourceHash; screenshotSHA256=(Get-FileHash -LiteralPath $capture.Path -Algorithm SHA256).Hash.ToLowerInvariant(); mode='foreground-window-screen'; state='manual navigation, awaiting inspection' }
   ConvertTo-Json -InputObject ([object[]]$captures) -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8
   Write-Host ('Captured ' + $name)
  } catch { Write-Warning $_.Exception.Message }
 }
 $pressed = $captureKey
 Start-Sleep -Milliseconds 80
}
Write-Host ('Finished. Captures are in ' + $outputDirectory)
