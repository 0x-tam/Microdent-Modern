param(
  [switch]$Full,
  [switch]$Ci,
  [switch]$UseSyntheticData,
  [switch]$SkipInstall,
  [switch]$SkipOneClickQuick,
  [switch]$SkipStagedAutoTest,
  [switch]$SkipPnpm
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ReportDir = Join-Path $Root "qa-runs"
$StepLogDir = Join-Path $ReportDir "windows-oneclick-logs"
$StageRoot = Join-Path $Root "dist\pilot-release\MicrodentModern"
$SafeZip = Join-Path $ReportDir "MicrodentModern-safe-results.zip"
$Report = Join-Path $ReportDir ("{0}-windows-oneclick-check.md" -f (Get-Date -Format "yyyy-MM-dd"))
$Rows = New-Object System.Collections.Generic.List[string]
$FailedStepLogs = New-Object System.Collections.Generic.List[string]
$Failed = $false
$StepIndex = 0

function Escape-Cell {
  param([AllowNull()][string]$Value)
  if ($null -eq $Value) { return "" }
  return ($Value -replace "\|", "\|")
}

function Add-Row {
  param(
    [string]$Scenario,
    [string]$Status,
    [string]$Evidence,
    [string]$RemainingGap = ""
  )
  $script:Rows.Add("| $(Escape-Cell $Scenario) | $(Escape-Cell $Status) | $(Escape-Cell $Evidence) | $(Escape-Cell $RemainingGap) |")
  if ($Status -eq "PROJECT FAILURE" -or $Status -eq "ENV BLOCKED") {
    $script:Failed = $true
  }
}

function ConvertTo-SafeFileName {
  param([string]$Value)
  $safe = ($Value.ToLowerInvariant() -replace "[^a-z0-9]+", "-").Trim("-")
  if ([string]::IsNullOrWhiteSpace($safe)) { return "step" }
  return $safe
}

function Invoke-CheckedStep {
  param(
    [string]$Scenario,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$RemainingGap = "",
    [int]$TimeoutSeconds = 600
  )
  Write-Host "[windows-oneclick] $Scenario`: $FilePath $($Arguments -join ' ')"
  New-Item -ItemType Directory -Force -Path $StepLogDir | Out-Null
  $script:StepIndex += 1
  $safeName = ConvertTo-SafeFileName $Scenario
  $baseName = "{0:D2}-{1}" -f $script:StepIndex, $safeName
  $stdoutPath = Join-Path $StepLogDir "$baseName.stdout.txt"
  $stderrPath = Join-Path $StepLogDir "$baseName.stderr.txt"
  $logPath = Join-Path $StepLogDir "$baseName.txt"
  $relativeLogPath = "qa-runs/windows-oneclick-logs/$baseName.txt"
  Set-Content -Path $logPath -Encoding UTF8 -Value @(
    "Scenario: $Scenario",
    "Generated: $(Get-Date -Format o)",
    "Command: $FilePath $($Arguments -join ' ')",
    "Working directory: repo root",
    "TimeoutSeconds: $TimeoutSeconds",
    "PHI safety: generated command output only; do not add DBF, SQLite, screenshots, raw rows, operator paths, or clinic data.",
    ""
  )
  $proc = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $Root -NoNewWindow -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
  $completed = $proc.WaitForExit($TimeoutSeconds * 1000)
  if (-not $completed) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    $proc.WaitForExit(5000) | Out-Null
  }
  $exitEvidence = if ($completed) { "exit $($proc.ExitCode)" } else { "timeout after ${TimeoutSeconds}s" }
  Add-Content -Path $logPath -Encoding UTF8 -Value @("ExitCode: $($proc.ExitCode)", "", "STDOUT:")
  if (Test-Path -LiteralPath $stdoutPath) {
    Get-Content -LiteralPath $stdoutPath -ErrorAction SilentlyContinue | Add-Content -Path $logPath -Encoding UTF8
    Remove-Item -LiteralPath $stdoutPath -Force -ErrorAction SilentlyContinue
  }
  Add-Content -Path $logPath -Encoding UTF8 -Value @("", "STDERR:")
  if (Test-Path -LiteralPath $stderrPath) {
    Get-Content -LiteralPath $stderrPath -ErrorAction SilentlyContinue | Add-Content -Path $logPath -Encoding UTF8
    Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
  }
  if ($completed -and $proc.ExitCode -eq 0) {
    Add-Row $Scenario "PASSED" "$exitEvidence; log $relativeLogPath" $RemainingGap
  } else {
    $script:FailedStepLogs.Add($logPath)
    Add-Row $Scenario "PROJECT FAILURE" "$exitEvidence; log $relativeLogPath" $RemainingGap
  }
}

function Test-NodeVersion {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $node) {
    Add-Row "Node availability" "ENV BLOCKED" "node not found on PATH" "Install Node 22 before Windows verification."
    return
  }
  $versionText = (& node --version).Trim()
  if ($versionText -match '^v?(\d+)\.(\d+)\.(\d+)') {
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    if ($major -gt 22 -or ($major -eq 22 -and $minor -ge 5)) {
      Add-Row "Node availability" "PASSED" $versionText
      return
    }
  }
  Add-Row "Node availability" "PROJECT FAILURE" $versionText "Use Node 22.5+ for clinic-service/runtime parity."
}

function Test-WindowsHost {
  if ($IsWindows -eq $false -and $PSVersionTable.Platform -ne "Win32NT") {
    Add-Row "Windows host" "WINDOWS-ONLY BLOCKED" "This PowerShell script must be run on Windows." "Run on Windows 10/11 or GitHub Actions windows-latest."
  } else {
    Add-Row "Windows host" "PASSED" "$([System.Environment]::OSVersion.VersionString)"
  }
}

function Test-AppDataAndSpaces {
  $appData = [Environment]::GetFolderPath("ApplicationData")
  if ([string]::IsNullOrWhiteSpace($appData)) {
    Add-Row "AppData config location" "ENV BLOCKED" "ApplicationData folder not available"
  } else {
    $configDir = Join-Path $appData "Microdent"
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    Add-Row "AppData config location" "PASSED" "Microdent config folder can be created under AppData"
  }

  $tempProbe = Join-Path ([System.IO.Path]::GetTempPath()) "Microdent OneClick Path With Spaces"
  New-Item -ItemType Directory -Force -Path $tempProbe | Out-Null
  Remove-Item -Recurse -Force -Path $tempProbe
  Add-Row "Windows path with spaces" "PASSED" "Temporary folder with spaces can be created and removed"
}

function Copy-SyntheticDataToStage {
  if (-not $UseSyntheticData) { return }
  Invoke-CheckedStep "Synthetic DATA fixture generation" "pnpm" @("strict-signoff:prepare")
  $sourceData = Join-Path $Root "services\strict-signoff\synthetic-source\DATA"
  $destData = Join-Path $StageRoot "clinic-data-copy\DATA"
  if ((Test-Path -LiteralPath $sourceData) -and (Test-Path -LiteralPath $StageRoot)) {
    New-Item -ItemType Directory -Force -Path $destData | Out-Null
    Copy-Item -Path (Join-Path $sourceData "*") -Destination $destData -Recurse -Force
    Add-Row "Synthetic staged DATA fixture" "PASSED" "PHI-free synthetic DBF files copied into staged clinic-data-copy\DATA" "Real clinic DATA validation remains a field-test step."
  } else {
    Add-Row "Synthetic staged DATA fixture" "PROJECT FAILURE" "source or staged package folder missing"
  }
}

function Test-StagedPackage {
  if (-not (Test-Path -LiteralPath $StageRoot)) {
    Add-Row "Staged package exists" "PROJECT FAILURE" "dist\pilot-release\MicrodentModern missing"
    return
  }
  Add-Row "Staged package exists" "PASSED" "dist\pilot-release\MicrodentModern"

  $autoCmd = Join-Path $StageRoot "DOUBLE-CLICK-AUTO-TEST.cmd"
  if (Test-Path -LiteralPath $autoCmd) {
    Add-Row "DOUBLE-CLICK-AUTO-TEST.cmd exists" "PASSED" "staged package contains double-click auto smoke runner"
  } else {
    Add-Row "DOUBLE-CLICK-AUTO-TEST.cmd exists" "PROJECT FAILURE" "missing from staged package"
  }
}

function Invoke-StagedAutoTest {
  if ($SkipStagedAutoTest) {
    Add-Row "Staged double-click auto test" "WINDOWS-ONLY BLOCKED" "Skipped by -SkipStagedAutoTest" "Run on a Windows machine before field signoff."
    return
  }
  $autoCmd = Join-Path $StageRoot "DOUBLE-CLICK-AUTO-TEST.cmd"
  if (-not (Test-Path -LiteralPath $autoCmd)) {
    Add-Row "Staged double-click auto test" "PROJECT FAILURE" "DOUBLE-CLICK-AUTO-TEST.cmd missing"
    return
  }
  Invoke-CheckedStep "Staged double-click auto test non-interactive" "cmd.exe" @("/c", "`"$autoCmd`" --ci") "GUI/manual observation still remains a real field-test step." 180
}

function Write-ReportAndZip {
  $content = @(
    "# Microdent Modern Windows One-Click Check",
    "",
    "Generated: $(Get-Date -Format o)",
    "Mode: $(if ($Ci) { "ci" } elseif ($Full) { "full" } else { "quick" })",
    "",
    "This report is PHI-safe. Do not add screenshots, DBF files, SQLite files, logs, patient names, phone numbers, comments, notes, payment amounts, operator paths, or raw rows.",
    "",
    "| Scenario | Status | Evidence | Remaining gap |",
    "| --- | --- | --- | --- |"
  ) + $Rows + @(
    "",
    "## Windows-Only Items",
    "",
    "- GitHub Actions windows-latest can prove Windows build/test/package automation, but not clinic hardware, SmartScreen, antivirus, or operator GUI behavior.",
    "- A real clinic/test Windows PC must still run the staged package by double-clicking `DOUBLE-CLICK-AUTO-TEST.cmd`.",
    "- Real clinic DATA validation remains a field-test step. CI synthetic DATA is PHI-free and intentionally limited.",
    "- If any Windows-only item was not observed on this machine, keep it marked WINDOWS-ONLY BLOCKED.",
    "",
    "## Safe Artifact",
    "",
    "- Upload only `MicrodentModern-safe-results.zip` or this Markdown report plus generated PHI-safe evidence JSON files.",
    "- Do not upload DBF, SQLite, config, raw logs, screenshots, or copied DATA folders."
  )
  Set-Content -Path $Report -Value $content -Encoding UTF8

  if (Test-Path -LiteralPath $SafeZip) {
    Remove-Item -LiteralPath $SafeZip -Force
  }
  $zipFiles = @($Report)
  $smokeRoots = @()
  if (-not [string]::IsNullOrWhiteSpace($env:ProgramData)) {
    $smokeRoots += (Join-Path $env:ProgramData "MicrodentClinicPilot\qa-runs")
  }
  $smokeRoots += (Join-Path ([System.IO.Path]::GetTempPath()) "MicrodentClinicPilot\qa-runs")
  foreach ($smokeRoot in $smokeRoots) {
    $smokeReport = Join-Path $smokeRoot "WINDOWS-AUTO-TEST-REPORT.txt"
    $smokeZip = Join-Path $smokeRoot "MicrodentModern-safe-results.zip"
    if (Test-Path -LiteralPath $smokeReport) { $zipFiles += $smokeReport }
    if (Test-Path -LiteralPath $smokeZip) { $zipFiles += $smokeZip }
  }
  $stagedZip = Join-Path $StageRoot "qa-runs\MicrodentModern-safe-results.zip"
  if (Test-Path -LiteralPath $stagedZip) {
    $zipFiles += $stagedZip
  }
  $stepLogs = @(Get-ChildItem -LiteralPath $StepLogDir -Filter "*.txt" -File -ErrorAction SilentlyContinue)
  foreach ($stepLog in $stepLogs) {
    $zipFiles += $stepLog.FullName
  }
  $jsons = @(Get-ChildItem -LiteralPath $ReportDir -Filter "*.json" -File -ErrorAction SilentlyContinue)
  foreach ($json in $jsons) {
    if ($json.Name -like "TEMPLATE-*") { continue }
    $zipFiles += $json.FullName
  }
  $zipFiles = @($zipFiles | Select-Object -Unique)
  Compress-Archive -LiteralPath $zipFiles -DestinationPath $SafeZip -Force
  Write-Host "[windows-oneclick] report written: $Report"
  Write-Host "[windows-oneclick] safe results zip written: $SafeZip"
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
New-Item -ItemType Directory -Force -Path $StepLogDir | Out-Null
Test-WindowsHost
Test-AppDataAndSpaces
Test-NodeVersion

if ($SkipPnpm) {
  Add-Row "pnpm verification" "WINDOWS-ONLY BLOCKED" "Skipped by -SkipPnpm" "Run without -SkipPnpm on Windows CI or a target Windows test machine."
} else {
  $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($null -eq $pnpmCmd) {
    Add-Row "pnpm availability" "ENV BLOCKED" "pnpm not found on PATH" "Enable corepack/pnpm before full Windows verification."
  } else {
    Add-Row "pnpm availability" "PASSED" "pnpm found on PATH"
    if (-not $SkipInstall) {
      Invoke-CheckedStep "dependency install/check" "pnpm" @("install", "--frozen-lockfile")
    } else {
      Add-Row "dependency install/check" "PASSED" "Skipped by -SkipInstall; caller already installed dependencies"
    }
    Invoke-CheckedStep "contracts build" "pnpm" @("--filter", "@microdent/contracts", "run", "build")
    Invoke-CheckedStep "bridge build" "pnpm" @("--filter", "@microdent/bridge", "run", "build")
    Invoke-CheckedStep "sqlite mirror build" "pnpm" @("--filter", "@microdent/sqlite-mirror", "run", "build")
    Invoke-CheckedStep "web build" "pnpm" @("build:web")
    Invoke-CheckedStep "desktop build" "pnpm" @("--filter", "@microdent/desktop", "run", "build")
    Invoke-CheckedStep "desktop tests" "pnpm" @("--filter", "@microdent/desktop", "run", "test")
    Invoke-CheckedStep "desktop release smoke" "pnpm" @("desktop:release-smoke")
    Invoke-CheckedStep "pilot artifact tests" "pnpm" @("test:pilot-artifacts")
    Invoke-CheckedStep "stage pilot release" "pnpm" @("stage:pilot-release")
    Invoke-CheckedStep "verify staged release" "pnpm" @("pilot:verify-release")
    Invoke-CheckedStep "verify staged manifest" "pnpm" @("pilot:verify-manifest")
    Copy-SyntheticDataToStage
    Test-StagedPackage
    Invoke-StagedAutoTest
    if (-not $SkipOneClickQuick) {
      if ($Full) {
        Invoke-CheckedStep "Microdent one-click full verification" "pnpm" @("microdent:oneclick") "Windows GUI launch still requires operator observation."
      } else {
        Invoke-CheckedStep "Microdent one-click quick verification" "pnpm" @("microdent:oneclick:quick") "Real clinic GUI/field observation remains separate."
      }
    } else {
      Add-Row "Microdent one-click quick verification" "PASSED" "Skipped by -SkipOneClickQuick; earlier workflow step may have run it"
    }
  }
}

Write-ReportAndZip

$failedRows = $Rows | Where-Object { $_ -match "\| PROJECT FAILURE \|" -or $_ -match "\| ENV BLOCKED \|" }
Write-Host ""
Write-Host "Microdent Modern Windows one-click summary"
Write-Host "=========================================="
if ($failedRows.Count -eq 0) {
  Write-Host "PASS: no project failures or environment blockers in this run."
} else {
  Write-Host "FAIL/BLOCKED rows:"
  $failedRows | ForEach-Object { Write-Host $_ }
  if ($FailedStepLogs.Count -gt 0) {
    Write-Host ""
    Write-Host "Failed step log tails"
    Write-Host "---------------------"
    foreach ($logPath in $FailedStepLogs) {
      Write-Host ""
      Write-Host "--- $logPath"
      Get-Content -LiteralPath $logPath -Tail 80 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
    }
  }
}

if ($Failed) {
  exit 1
}
