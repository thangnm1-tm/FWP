# ROLLBACK INSTRUCTIONS

Backup location: C:\Users\Admin\Desktop\fwp\.codex-backups\hybrid-gateway-20261015-143353
Created: 
2026-10-15 14:33:54

## What this rollback does:
1. Stops the hybrid gateway background process if running.
2. Restores C:\Users\Admin\.codex\config.toml from this backup (config.toml).
3. Removes model_provider = 'hybrid_gateway' and [model_providers.hybrid_gateway] without touching plugins, mcp_servers, desktop, or trust settings.
4. Restores original model catalog if modified.
5. Keeps stock OpenAI Codex Desktop working normally.

## Execution:
Run in PowerShell:
powershell -ExecutionPolicy Bypass -File (Join-Path 'C:\Users\Admin\Desktop\fwp\.codex-backups\hybrid-gateway-20261015-143353' 'rollback.ps1')
