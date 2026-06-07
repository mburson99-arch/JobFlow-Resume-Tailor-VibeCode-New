param(
  [string]$InstallPath = ""
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

Write-Host "Stopping running JobFlow/Electron processes..."
Stop-Process -Name "JobFlow" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

Write-Host "Building updated app files..."
npm run build

$candidatePaths = @()

if ($InstallPath.Trim()) {
  $candidatePaths += $InstallPath
}

$candidatePaths += @(
  "$env:LOCALAPPDATA\Programs\JobFlow",
  "$env:ProgramFiles\JobFlow",
  "${env:ProgramFiles(x86)}\JobFlow"
)

$installRoot = $candidatePaths |
  Where-Object { $_ -and (Test-Path (Join-Path $_ "resources\app")) } |
  Select-Object -First 1

if (-not $installRoot) {
  Write-Host ""
  Write-Host "Could not find installed JobFlow automatically."
  Write-Host "Run this with the install path, for example:"
  Write-Host '  .\scripts\patch-installed.ps1 -InstallPath "$env:LOCALAPPDATA\Programs\JobFlow"'
  exit 1
}

$appRoot = Join-Path $installRoot "resources\app"

Write-Host "Patching installed app at: $appRoot"

Remove-Item (Join-Path $appRoot "dist") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $appRoot "electron") -Recurse -Force -ErrorAction SilentlyContinue

Copy-Item (Join-Path $ProjectRoot "dist") (Join-Path $appRoot "dist") -Recurse -Force
Copy-Item (Join-Path $ProjectRoot "electron") (Join-Path $appRoot "electron") -Recurse -Force
Copy-Item (Join-Path $ProjectRoot "package.json") (Join-Path $appRoot "package.json") -Force

Write-Host ""
Write-Host "Patch complete. Start JobFlow again from the Start Menu or desktop shortcut."
