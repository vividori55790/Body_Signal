$AndroidDir = Join-Path $PSScriptRoot "body-signal\android"
Push-Location $AndroidDir
try {
    .\gradlew.bat --stop
    .\gradlew.bat assembleDebug
} finally {
    Pop-Location
}
