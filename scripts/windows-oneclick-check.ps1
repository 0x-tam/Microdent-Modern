param(
  [switch]$Full,
  [switch]$SkipPnpm
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ReportDir = Join-Path $Root "qa-runs"
$Report = Join-Path $ReportDir ("{0}-windows-oneclick-check.md" -f (Get-Date -Format "yyyy-MM-dd"))
$Rows = New-Object System.Collections.Generic.List[string]
$Failed = $false

function Add-Row {
  param(
    [string]$Scenario,
    [string]$Status,
    [string]$Evidence,
    [string]$RemainingGap = ""
  )
  $script:Rows.Add("| $Scenario | $Status | $($Evidence -replace '\|','\|') | $($RemainingGap -replace '\|','\|') |")
  if ($Status -eq "PROJECT FAILURE" -or $Status -eq "ENV BLOCKED") {
    $script:Failed = $true
  }
}

function Invoke-Step {
  param(
    [string]$Scenario,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$RemainingGap = ""
  )
  Write-Host "[windows-oneclick] $Scenario`: $FilePath $($Arguments -join ' ')"
  $proc = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $Root -NoNewWindow -PassThru -Wait
  if ($proc.ExitCode -eq 0) {
    Add-Row $Scenario "PASSED" "exit 0" $RemainingGap
  } else {
    Add-Row $Scenario "PROJECT FAILURE" "exit $($proc.ExitCode)" $RemainingGap
  }
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

if ($IsWindows -eq $false -and $PSVersionTable.Platform -ne "Win32NT") {
  Add-Row "Windows host" "WINDOWS-ONLY BLOCKED" "This PowerShell script must be run on Windows." "Run on Windows 10/11 clinic test machine."
} else {
  Add-Row "Windows host" "PASSED" "$([System.Environment]::OSVersion.VersionString)"
}

$AppData = [Environment]::GetFolderPath("ApplicationData")
if ([string]::IsNullOrWhiteSpace($AppData)) {
  Add-Row "AppData config location" "ENV BLOCKED" "ApplicationData folder not available"
} else {
  $ConfigDir = Join-Path $AppData "Microdent"
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
  Add-Row "AppData config location" "PASSED" "Microdent config folder can be created under AppData"
}

$TempProbe = Join-Path ([System.IO.Path]::GetTempPath()) "Microdent OneClick Path With Spaces"
New-Item -ItemType Directory -Force -Path $TempProbe | Out-Null
Remove-Item -Recurse -Force -Path $TempProbe
Add-Row "Windows path with spaces" "PASSED" "Temporary folder with spaces can be created and removed"

if (-not $SkipPnpm) {
  $PnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
  if ($null -eq $PnpmCmd) {
    Add-Row "pnpm availability" "ENV BLOCKED" "pnpm not found on PATH" "Install/enable pnpm before full Windows verification."
  } else {
    Add-Row "pnpm availability" "PASSED" "pnpm found on PATH"
    if ($Full) {
      Invoke-Step "Microdent one-click full verification" "pnpm" @("microdent:oneclick") "Windows GUI launch still requires operator observation."
    } else {
      Invoke-Step "Microdent one-click quick verification" "pnpm" @("microdent:oneclick:quick") "Run with -Full before release signoff."
    }
  }
} else {
  Add-Row "pnpm verification" "WINDOWS-ONLY BLOCKED" "Skipped by -SkipPnpm" "Run without -SkipPnpm on the target Windows machine."
}

$Content = @(
  "# Microdent Modern Windows One-Click Check",
  "",
  "Generated: $(Get-Date -Format o)",
  "",
  "This report is PHI-safe. Do not add screenshots, DBF files, SQLite files, logs, patient names, phone numbers, comments, notes, payment amounts, or raw rows.",
  "",
  "| Scenario | Status | Evidence | Remaining gap |",
  "| --- | --- | --- | --- |"
) + $Rows + @(
  "",
  "## Windows-Only Items",
  "",
  "- Confirm the desktop app opens by double-click, not by terminal.",
  "- Confirm the clinic service starts in the background and Settings shows it connected.",
  "- Confirm SmartScreen/firewall/antivirus behavior with the signed or unsigned package IT intends to deploy.",
  "- Confirm first-run setup saves config under AppData for the same Windows user who launches the app.",
  "- Confirm copied clinic data, local copy, backups, and support evidence stay outside the install folder.",
  "",
  "If any Windows-only item was not observed on this machine, keep it marked WINDOWS-ONLY BLOCKED."
)

Set-Content -Path $Report -Value $Content -Encoding UTF8
Write-Host "[windows-oneclick] report written: $Report"

if ($Failed) {
  exit 1
}
