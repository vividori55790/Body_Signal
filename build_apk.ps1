$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.17.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
$env:ANDROID_HOME = "C:\Users\vivid\AppData\Local\Android\Sdk"
Set-Location -Path "C:\Users\vivid\Documents\GitProject\Personal\2025\Bignal\body-signal\android"
.\gradlew.bat --stop
.\gradlew.bat assembleDebug
