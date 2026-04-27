param(
  [string]$OutputDir = ".mech-audio/freeze-captures"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outRoot = Join-Path $repoRoot $OutputDir
$outDir = Join-Path $outRoot $timestamp
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$report = Join-Path $outDir "capture-summary.txt"
$processFile = Join-Path $outDir "code-processes.txt"
$treeFile = Join-Path $outDir "code-process-tree.txt"
$keywordsFile = Join-Path $outDir "log-keywords.txt"
$sessionListFile = Join-Path $outDir "latest-log-sessions.txt"

$logRoot = Join-Path $env:APPDATA "Code\logs"
$sessions = Get-ChildItem -Path $logRoot -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 3

$patterns = @(
  "renderer process gone",
  "extension host terminated",
  "Extension host with pid",
  "out of memory",
  "JavaScript heap out of memory",
  "ENOSPC",
  "watcher",
  "gpu process crashed",
  "already registered",
  "restartExtensionHost"
)

"Capture Time: $(Get-Date -Format o)" | Set-Content -Path $report
"Repository: $repoRoot" | Add-Content -Path $report
"Log Root: $logRoot" | Add-Content -Path $report
"" | Add-Content -Path $report
"Latest Sessions:" | Add-Content -Path $report
$sessions | ForEach-Object { "- $($_.FullName)" } | Tee-Object -FilePath $sessionListFile | Add-Content -Path $report

"" | Add-Content -Path $report
"Code.exe Process Snapshot" | Add-Content -Path $report
"=========================" | Add-Content -Path $report
$codeProcesses = Get-Process -Name Code -ErrorAction SilentlyContinue
if (-not $codeProcesses) {
  "No active Code.exe processes found." | Tee-Object -FilePath $processFile | Add-Content -Path $report
} else {
  $codeProcesses |
    Sort-Object -Property Id |
    Select-Object Id, ProcessName, CPU, WorkingSet64, StartTime |
    Format-Table -AutoSize |
    Out-String |
    Tee-Object -FilePath $processFile | Add-Content -Path $report
}

"" | Add-Content -Path $report
"Code.exe Process Tree" | Add-Content -Path $report
"=====================" | Add-Content -Path $report
$codeCim = Get-CimInstance Win32_Process -Filter "Name = 'Code.exe'"
if (-not $codeCim) {
  "No Code.exe process tree data found." | Tee-Object -FilePath $treeFile | Add-Content -Path $report
} else {
  $codeCim |
    Sort-Object -Property ProcessId |
    Select-Object ProcessId, ParentProcessId, CommandLine |
    Format-Table -Wrap -AutoSize |
    Out-String |
    Tee-Object -FilePath $treeFile | Add-Content -Path $report
}

$matches = New-Object System.Collections.Generic.List[object]
foreach ($session in $sessions) {
  $logFiles = Get-ChildItem -Path $session.FullName -Recurse -File -Filter "*.log"
  foreach ($logFile in $logFiles) {
    $hits = Select-String -Path $logFile.FullName -Pattern $patterns -SimpleMatch -ErrorAction SilentlyContinue
    foreach ($hit in $hits) {
      $matches.Add([PSCustomObject]@{
        Path = $logFile.FullName
        LineNumber = $hit.LineNumber
        Line = $hit.Line.Trim()
      })
    }
  }
}

"" | Add-Content -Path $report
"Keyword Hits (latest 3 sessions)" | Add-Content -Path $report
"===============================" | Add-Content -Path $report
if ($matches.Count -eq 0) {
  "No keyword matches found." | Tee-Object -FilePath $keywordsFile | Add-Content -Path $report
} else {
  $matches |
    Select-Object -First 200 |
    ForEach-Object { "{0}:{1}: {2}" -f $_.Path, $_.LineNumber, $_.Line } |
    Tee-Object -FilePath $keywordsFile | Add-Content -Path $report
}

Write-Output "Capture complete: $outDir"
Write-Output "Summary: $report"
