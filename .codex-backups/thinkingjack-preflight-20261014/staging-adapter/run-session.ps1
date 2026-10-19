[CmdletBinding(PositionalBinding = $false)]
param(
    [ValidateSet('thinkingJack4_stateless', 'thinkingJack4')]
    [string]$Model = 'thinkingJack4_stateless',
    [int]$Port = 8787,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CodexArgs
)

$ErrorActionPreference = 'Stop'
$adapterRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = (Get-Command node -ErrorAction Stop).Source
$codexPath = (Get-Command codex -ErrorAction Stop).Source
$apiKey = [Environment]::GetEnvironmentVariable('THINKINGJACK_API_KEY', 'User')
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw 'THINKINGJACK_API_KEY is not set in the Windows User environment.'
}

$env:TJ_ADAPTER_HOST = '127.0.0.1'
$env:TJ_ADAPTER_PORT = [string]$Port
$env:THINKINGJACK_BASE_URL = 'https://thinkingjack.com/v1'

$adapter = Start-Process -FilePath $nodePath -ArgumentList @((Join-Path $adapterRoot 'server.mjs')) -WindowStyle Hidden -PassThru
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 1
            if ($health.ok) { $ready = $true; break }
        } catch { Start-Sleep -Milliseconds 100 }
    }
    if (-not $ready) { throw 'The session adapter did not become ready.' }

    # Set the credential only after the adapter starts so the adapter process
    # never inherits the secret. Codex sends it as the request bearer token.
    $env:THINKINGJACK_API_KEY = $apiKey
    $overrides = @(
        '-c', ('model="{0}"' -f $Model),
        '-c', 'model_catalog_json="C:\Users\Admin\.codex\model-catalogs\thinkingjack-chat.json"',
        '-c', 'model_provider="thinkingjack_session"',
        '-c', 'model_providers.thinkingjack_session.name="ThinkingJack Session Adapter"',
        '-c', ('model_providers.thinkingjack_session.base_url="http://127.0.0.1:{0}/v1"' -f $Port),
        '-c', 'model_providers.thinkingjack_session.wire_api="responses"',
        '-c', 'model_providers.thinkingjack_session.env_key="THINKINGJACK_API_KEY"',
        '-c', 'model_providers.thinkingjack_session.requires_openai_auth=false',
        '-c', 'model_providers.thinkingjack_session.supports_websockets=false'
    )
    & $codexPath @overrides @CodexArgs
    exit $LASTEXITCODE
} finally {
    if ($adapter -and -not $adapter.HasExited) { Stop-Process -Id $adapter.Id -Force }
    Remove-Item Env:THINKINGJACK_API_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:TJ_ADAPTER_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:TJ_ADAPTER_PORT -ErrorAction SilentlyContinue
    Remove-Item Env:THINKINGJACK_BASE_URL -ErrorAction SilentlyContinue
}

