param(
    [string]$LegacyDir = (Join-Path $PSScriptRoot '..\..\..\legacy-wealth-platform'),
    [switch]$StopDb,
    [switch]$RemoveDb
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$LegacyDir = [System.IO.Path]::GetFullPath($LegacyDir)
$runDir = Join-Path $repoRoot '.legacy-run'
$pidPath = Join-Path $runDir 'iisexpress.pid'
$webPath = [System.IO.Path]::GetFullPath((Join-Path $LegacyDir 'src\PV.Web')).TrimEnd('\')

function Invoke-TimedStopStep {
    param(
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host "==> $Name"
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        & $Action
    } finally {
        $timer.Stop()
        Write-Host ('    elapsed: {0:N1} seconds' -f $timer.Elapsed.TotalSeconds)
    }
}

function Invoke-DockerCommand {
    param(
        [string]$DockerPath,
        [string[]]$DockerArguments
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = @(& $DockerPath @DockerArguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    [pscustomobject]@{
        ExitCode = $exitCode
        Output = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    }
}

Invoke-TimedStopStep 'IIS Express' {
    $processIds = New-Object 'System.Collections.Generic.HashSet[int]'
    if (Test-Path -LiteralPath $pidPath) {
        $recordedId = 0
        if ([int]::TryParse((Get-Content -LiteralPath $pidPath -Raw).Trim(), [ref]$recordedId)) {
            $recordedProcess = Get-Process -Id $recordedId -ErrorAction SilentlyContinue
            if ($null -ne $recordedProcess -and $recordedProcess.ProcessName -ieq 'iisexpress') {
                [void]$processIds.Add($recordedId)
            }
        }
    }

    $processes = Get-CimInstance -ClassName Win32_Process -Filter "Name = 'iisexpress.exe'" -ErrorAction SilentlyContinue
    foreach ($process in $processes) {
        if ($null -ne $process.CommandLine -and
            $process.CommandLine.IndexOf($webPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            [void]$processIds.Add([int]$process.ProcessId)
        }
    }

    foreach ($processId in $processIds) {
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped IIS Express PID $processId."
    }
    if (Test-Path -LiteralPath $pidPath) {
        Remove-Item -LiteralPath $pidPath -Force
    }
}

if ($RemoveDb -or $StopDb) {
    Invoke-TimedStopStep 'SQL Server' {
        $dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
        if ($null -eq $dockerCommand) {
            $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
        }
        if ($null -eq $dockerCommand) {
            throw 'Docker CLI was not found on PATH.'
        }
        if ($RemoveDb) {
            $result = Invoke-DockerCommand -DockerPath $dockerCommand.Source -DockerArguments @('rm', '-f', 'pvsql')
            if ($result.ExitCode -ne 0) {
                $container = Invoke-DockerCommand -DockerPath $dockerCommand.Source -DockerArguments @('container', 'inspect', 'pvsql')
                if ($container.ExitCode -eq 0) {
                    throw "docker rm -f pvsql failed: $($result.Output)"
                }
            }
        } else {
            $result = Invoke-DockerCommand -DockerPath $dockerCommand.Source -DockerArguments @('stop', 'pvsql')
            if ($result.ExitCode -ne 0) {
                $container = Invoke-DockerCommand -DockerPath $dockerCommand.Source -DockerArguments @('container', 'inspect', 'pvsql')
                if ($container.ExitCode -eq 0) {
                    throw "docker stop pvsql failed: $($result.Output)"
                }
            }
        }
    }
}
