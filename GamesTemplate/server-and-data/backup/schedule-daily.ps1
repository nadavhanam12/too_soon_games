# Registers a Windows scheduled task that runs export.sh (the production D1 export) every day at 04:00.
# Run once in PowerShell:  powershell -ExecutionPolicy Bypass -File schedule-daily.ps1
# Remove it:               Unregister-ScheduledTask -TaskName "TooSoonGames D1 backup" -Confirm:$false
# Needs `wrangler login` to stay valid on this machine. If the computer is off at 04:00 the task runs at the next start
# (StartWhenAvailable). Each run appends to backups/schedule.log; export.sh keeps the last 30 exports.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$bash = 'C:\Program Files\Git\bin\bash.exe'
if (-not (Test-Path $bash)) { throw "Git Bash not found at $bash" }
$log = Join-Path $here 'backups\schedule.log'
New-Item -ItemType Directory -Force (Join-Path $here 'backups') | Out-Null
$script = (Join-Path $here 'export.sh') -replace '\\', '/'
$logU = $log -replace '\\', '/'
$action = New-ScheduledTaskAction -Execute $bash -Argument "-lc `"'$script' >> '$logU' 2>&1`""
$trigger = New-ScheduledTaskTrigger -Daily -At 4am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'TooSoonGames D1 backup' -Action $action -Trigger $trigger -Settings $settings -Description 'Daily export of the Too Soon Games D1 database (GamesTemplate/server-and-data/backup)' -Force | Out-Null
Write-Output "registered: daily 04:00 -> $log"
