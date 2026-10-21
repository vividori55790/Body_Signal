$ToolsDir = "C:\Users\vivid\body_signal_tools"
if (!(Test-Path $ToolsDir)) { New-Item -ItemType Directory -Path $ToolsDir -Force }

$JdkZip = "$ToolsDir\jdk17.zip"
if (!(Test-Path $JdkZip)) {
    Write-Host "Downloading JDK 17..."
    Invoke-WebRequest -Uri "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10%2B7/OpenJDK17U-jdk_x64_windows_hotspot_17.0.10_7.zip" -OutFile $JdkZip
}
if (!(Test-Path "$ToolsDir\jdk-17.0.10+7")) {
    Write-Host "Extracting JDK 17..."
    Expand-Archive -Path $JdkZip -DestinationPath $ToolsDir -Force
}
$env:JAVA_HOME = "$ToolsDir\jdk-17.0.10+7"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path

$SdkDir = "$ToolsDir\android_sdk"
if (!(Test-Path $SdkDir)) { New-Item -ItemType Directory -Path $SdkDir -Force }

$CmdLineToolsZip = "$ToolsDir\cmdline-tools.zip"
if (!(Test-Path $CmdLineToolsZip)) {
    Write-Host "Downloading Android Command Line Tools..."
    Invoke-WebRequest -Uri "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip" -OutFile $CmdLineToolsZip
}

if (!(Test-Path "$SdkDir\cmdline-tools\latest")) {
    Write-Host "Extracting Command Line Tools..."
    Expand-Archive -Path $CmdLineToolsZip -DestinationPath "$SdkDir\cmdline-tools" -Force
    # Rename cmdline-tools to latest so the SDK manager structure is correct
    Rename-Item -Path "$SdkDir\cmdline-tools\cmdline-tools" -NewName "latest"
}

$env:ANDROID_HOME = $SdkDir
$SdkManager = "$SdkDir\cmdline-tools\latest\bin\sdkmanager.bat"

Write-Host "Accepting SDK licenses..."
Write-Output "y`ny`ny`ny`ny`ny`ny" | & $SdkManager --licenses

Write-Host "Installing Android SDK platforms and build-tools..."
& $SdkManager "platforms;android-34" "build-tools;34.0.0" "platform-tools"

Write-Host "Starting App Build Process..."
cd c:\Users\vivid\Documents\GitProject\Personal\Bignal\body-signal
npm run build
npx cap sync android

cd android
# Fix local.properties to point to the newly downloaded SDK
"sdk.dir=$SdkDir" -replace '\\', '\\' | Out-File -FilePath local.properties -Encoding utf8

Write-Host "Building APK via Gradle..."
.\gradlew assembleDebug

Write-Host "Build Complete!"
Get-Item app\build\outputs\apk\debug\app-debug.apk
