$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    & .\gradlew.bat testDebugUnitTest lintDebug assembleDebug --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Build Android gagal. Lihat pesan Gradle di atas.' }
    New-Item -ItemType Directory -Force dist | Out-Null
    Copy-Item -LiteralPath app/build/outputs/apk/debug/app-debug.apk -Destination dist/VoidPlayBox-1.0.0-debug.apk
    Write-Host "APK: $PSScriptRoot/dist/VoidPlayBox-1.0.0-debug.apk"
} finally { Pop-Location }
