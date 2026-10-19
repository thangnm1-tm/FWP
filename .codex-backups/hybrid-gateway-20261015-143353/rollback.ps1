$ErrorActionPreference = 'Stop'
$currentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# If called from backup directory, backupDir is currentDir; otherwise locate latest backup
$backupDir = $currentDir
if (-not (Test-Path (Join-Path $backupDir 'config.toml'))) {
    $latestBackup = Get-ChildItem 'C:\Users\Admin\Desktop\fwp\.codex-backups\hybrid-gateway-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestBackup) {
        $backupDir = $latestBackup.FullName
    }
}

Write-Host "Starting rollback from $backupDir..."

# Stop any running node process running gateway.mjs
Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $PID -and $_.CommandLine -like "*gateway.mjs*"
} | ForEach-Object {
    Write-Host "Stopping hybrid gateway process: $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

# Remove runtime-state.json
$statePath = 'C:\Users\Admin\.codex\hybrid-gateway\runtime-state.json'
if (Test-Path $statePath) {
    Remove-Item $statePath -Force -ErrorAction SilentlyContinue
}

# Restore config.toml from backup
$sourceConfig = Join-Path $backupDir 'config.toml'
if (Test-Path $sourceConfig) {
    Copy-Item $sourceConfig -Destination 'C:\Users\Admin\.codex\config.toml' -Force
    Write-Host "Restored C:\Users\Admin\.codex\config.toml from $sourceConfig"
} else {
    Write-Warning "Could not find backup config.toml at $sourceConfig"
}

Write-Host "Rollback completed successfully."
