param(
  [ValidateSet('live', 'test', 'internal')]
  [string]$AdMode = 'live'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'android'
$downloadsDir = Join-Path $env:USERPROFILE 'Downloads'
$buildGradlePath = Join-Path $androidDir 'app\build.gradle'
$capacitorAndroidBuildDir = Join-Path $repoRoot 'node_modules\@capacitor\android\capacitor\build'
$capacitorPluginsBuildDir = Join-Path $repoRoot 'node_modules\@capacitor\android\capacitor-cordova-android-plugins\build'
$admobAndroidBuildDir = Join-Path $repoRoot 'node_modules\@capacitor-community\admob\android\build'
$javaHome = 'C:\Program Files\Android\Android Studio\jbr'

$liveAppId = 'ca-app-pub-9351947872274309~2751565349'
$liveInterstitialAdId = 'ca-app-pub-9351947872274309/6934352937'
$testAppId = 'ca-app-pub-3940256099942544~3347511713'
$testInterstitialAdId = 'ca-app-pub-3940256099942544/1033173712'

function Remove-StalePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  $item = Get-Item -LiteralPath $Path -Force
  if ($item.PSIsContainer) {
    cmd /c "rmdir /s /q `"$Path`"" | Out-Null
  } else {
    cmd /c "del /f /q `"$Path`"" | Out-Null
  }

  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path -LiteralPath $Path) {
    throw "Failed to clean stale build path: $Path"
  }
}

if (-not (Test-Path $buildGradlePath)) {
  throw "build.gradle not found: $buildGradlePath"
}

$gradleContent = [System.IO.File]::ReadAllText($buildGradlePath)
$versionCodeMatch = [System.Text.RegularExpressions.Regex]::Match($gradleContent, 'versionCode\s+(\d+)')
$versionNameMatch = [System.Text.RegularExpressions.Regex]::Match($gradleContent, 'versionName\s+"([^"]+)"')

if (-not $versionCodeMatch.Success) {
  throw 'Could not find versionCode in android/app/build.gradle'
}

$currentVersionCode = [int]$versionCodeMatch.Groups[1].Value
$nextVersionCode = $currentVersionCode + 1
$versionName = if ($versionNameMatch.Success) { $versionNameMatch.Groups[1].Value } else { '1.0' }

$updatedGradleContent = [System.Text.RegularExpressions.Regex]::Replace(
  $gradleContent,
  'versionCode\s+\d+',
  "versionCode $nextVersionCode",
  1
)
[System.IO.File]::WriteAllText($buildGradlePath, $updatedGradleContent)

if (-not (Test-Path $javaHome)) {
  throw "JAVA_HOME path not found: $javaHome"
}

$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"

$useTestAdUnits = $AdMode -ne 'live'
$enableAdDebugTools = $AdMode -eq 'test'
$admobAppId = if ($useTestAdUnits) { $testAppId } else { $liveAppId }
$interstitialAdId = if ($useTestAdUnits) { $testInterstitialAdId } else { $liveInterstitialAdId }
$useTestAdUnitsEnv = if ($useTestAdUnits) { 'true' } else { 'false' }
$enableAdDebugToolsEnv = if ($enableAdDebugTools) { 'true' } else { 'false' }
$fileSuffix = switch ($AdMode) {
  'test' { "testadsdebug-vc$nextVersionCode" }
  'internal' { "testapp-vc$nextVersionCode" }
  default { "release-vc$nextVersionCode" }
}

Push-Location $repoRoot
try {
  Remove-StalePath (Join-Path $repoRoot '.next')
  Remove-StalePath (Join-Path $androidDir 'app\build')
  Remove-StalePath (Join-Path $androidDir 'build')
  Remove-StalePath $capacitorAndroidBuildDir
  Remove-StalePath $capacitorPluginsBuildDir
  Remove-StalePath $admobAndroidBuildDir
  $env:NEXT_PUBLIC_ADMOB_APP_ID = $admobAppId
  $env:NEXT_PUBLIC_INTERSTITIAL_AD_ID = $interstitialAdId
  $env:NEXT_PUBLIC_USE_TEST_AD_UNITS = $useTestAdUnitsEnv
  $env:NEXT_PUBLIC_AD_DEBUG_TOOLS = $enableAdDebugToolsEnv
  $env:NEXT_PUBLIC_USE_NATIVE_ANDROID_ADS = 'true'
  npm run build
  npx cap sync android
} finally {
  Remove-Item Env:NEXT_PUBLIC_ADMOB_APP_ID -ErrorAction SilentlyContinue
  Remove-Item Env:NEXT_PUBLIC_INTERSTITIAL_AD_ID -ErrorAction SilentlyContinue
  Remove-Item Env:NEXT_PUBLIC_USE_TEST_AD_UNITS -ErrorAction SilentlyContinue
  Remove-Item Env:NEXT_PUBLIC_AD_DEBUG_TOOLS -ErrorAction SilentlyContinue
  Remove-Item Env:NEXT_PUBLIC_USE_NATIVE_ANDROID_ADS -ErrorAction SilentlyContinue
  Pop-Location
}

Push-Location $androidDir
try {
  .\gradlew.bat assembleRelease bundleRelease "-PADMOB_APP_ID=$admobAppId"
} finally {
  Pop-Location
}

$apkSource = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
$aabSource = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'

if (-not (Test-Path $apkSource)) {
  throw "APK not found: $apkSource"
}

if (-not (Test-Path $aabSource)) {
  throw "AAB not found: $aabSource"
}

$apkName = "meteor-crush-v$versionName-$fileSuffix.apk"
$aabName = "meteor-crush-v$versionName-$fileSuffix.aab"
$apkDestination = Join-Path $downloadsDir $apkName
$aabDestination = Join-Path $downloadsDir $aabName

Copy-Item -Path $apkSource -Destination $apkDestination -Force
Copy-Item -Path $aabSource -Destination $aabDestination -Force

[pscustomobject]@{
  AdMode = $AdMode
  AdMobAppId = $admobAppId
  InterstitialAdId = $interstitialAdId
  VersionName = $versionName
  VersionCode = $nextVersionCode
  ApkPath = $apkDestination
  AabPath = $aabDestination
}
