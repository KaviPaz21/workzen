$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -q -r requirements-dev.txt

$extra = @()
if (Test-Path .env) { $extra += @('--add-data', '.env;.') }

.\.venv\Scripts\python.exe -m PyInstaller --noconfirm --clean --onefile --noconsole `
    --name WorkZenCoworker `
    --version-file version_info.txt `
    --collect-all playwright `
    --collect-data docx `
    --collect-submodules uvicorn `
    --collect-submodules pystray `
    @extra `
    launcher.py

$program = (Resolve-Path dist\WorkZenCoworker.exe).Path

if ($env:COWORKER_SIGN_COMMAND) {
    $command = $env:COWORKER_SIGN_COMMAND.Replace('{file}', "`"$program`"")
    Write-Host 'Signing with the command from COWORKER_SIGN_COMMAND'
    Invoke-Expression $command
    if ($LASTEXITCODE -ne 0) { throw 'The signing command failed.' }
}
elseif ($env:COWORKER_SIGN_PFX) {
    $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($env:COWORKER_SIGN_PFX, $env:COWORKER_SIGN_PASSWORD)
    $options = @{ FilePath = $program; Certificate = $certificate; HashAlgorithm = 'SHA256' }
    if ($env:COWORKER_SIGN_TIMESTAMP) { $options.TimestampServer = $env:COWORKER_SIGN_TIMESTAMP }
    else { Write-Warning 'COWORKER_SIGN_TIMESTAMP is not set. Without a timestamp the signature stops being valid when the certificate expires.' }
    $result = Set-AuthenticodeSignature @options
    if (-not $result.SignerCertificate) { throw "Signing failed: $($result.StatusMessage)" }
    Write-Host 'Signed by' $certificate.Subject
}
else {
    Write-Warning 'The program is NOT signed. Browsers and Windows will warn that it is not commonly downloaded. See the README, section Co-worker app.'
}

Write-Host ''
Write-Host 'Built:' $program
