param(
    [string]$LegacyDir = (Join-Path $PSScriptRoot '..\..\..\legacy-wealth-platform'),
    [ValidateRange(1, 65535)]
    [int]$Port = 8080,
    [string]$DevPassword = 'Passw0rd!',
    [switch]$ResetDb,
    [switch]$SkipBuild,
    [switch]$NoDevPasswords
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$LegacyDir = [System.IO.Path]::GetFullPath($LegacyDir)
$webPath = Join-Path $LegacyDir 'src\PV.Web'
$archiveRoot = [System.IO.Path]::GetFullPath((Join-Path $webPath '..\..\archive'))
$runDir = Join-Path $repoRoot '.legacy-run'
$pidPath = Join-Path $runDir 'iisexpress.pid'
$logPath = Join-Path $runDir 'iisexpress.log'
$sqlPassword = 'Pv!Local2018'
$loginUsers = @(
    [pscustomobject]@{ User = 'PVADMIN'; Role = 'ADMIN' },
    [pscustomobject]@{ User = 'JSMITH'; Role = 'ADVISER' },
    [pscustomobject]@{ User = 'LBRENNAN'; Role = 'OPS' }
)

function Write-StepHeader {
    param([string]$Name)
    Write-Host "==> $Name"
    $script:stepTimer = [System.Diagnostics.Stopwatch]::StartNew()
}

function Write-StepElapsed {
    if ($null -ne $script:stepTimer) {
        $script:stepTimer.Stop()
        Write-Host ('    elapsed: {0:N1} seconds' -f $script:stepTimer.Elapsed.TotalSeconds)
        $script:stepTimer = $null
    }
}

function Show-LoginTable {
    $password = if ($NoDevPasswords) { '(unchanged)' } else { $DevPassword }
    $loginUsers |
        ForEach-Object {
            [pscustomobject]@{
                User = $_.User
                Role = $_.Role
                Password = $password
            }
        } |
        Format-Table -AutoSize |
        Out-String |
        Write-Host
}

function Invoke-DockerCommand {
    param([string[]]$DockerArguments)

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = @(& $script:dockerPath @DockerArguments 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    [pscustomobject]@{
        ExitCode = $exitCode
        Output = ($output | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    }
}

function Get-AppUserCount {
    $query = 'SET NOCOUNT ON; SELECT COUNT(*) FROM PortfolioViewer.dbo.APP_USER'
    $result = Invoke-DockerCommand @(
        'exec', 'pvsql', '/opt/mssql-tools18/bin/sqlcmd',
        '-S', 'localhost', '-U', 'sa', '-P', $sqlPassword,
        '-C', '-h', '-1', '-Q', $query
    )
    $number = [regex]::Match($result.Output, '(?m)^\s*(\d+)\s*$')
    if ($number.Success) {
        return [pscustomobject]@{
            Count = [int]$number.Groups[1].Value
            Missing = $false
            Output = $result.Output
        }
    }

    $missing = $result.Output -match 'Cannot open database|Database .+ does not exist|Invalid object name|does not exist or you do not have permissions'
    [pscustomobject]@{
        Count = $null
        Missing = $missing
        Output = $result.Output
    }
}

function Wait-ForAppUserCount {
    param(
        [int]$TimeoutSeconds = 180,
        [switch]$StopOnMissing
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $result = Get-AppUserCount
        if ($null -ne $result.Count -or ($StopOnMissing -and $result.Missing)) {
            return $result
        }
        Start-Sleep -Seconds 3
    } while ([DateTime]::UtcNow -lt $deadline)

    throw "SQL Server did not return the APP_USER count within $TimeoutSeconds seconds. Last response: $($result.Output)"
}

function Remove-PvSqlContainer {
    $inspect = Invoke-DockerCommand @('container', 'inspect', 'pvsql')
    if ($inspect.ExitCode -eq 0) {
        $removed = Invoke-DockerCommand @('rm', '-f', 'pvsql')
        if ($removed.ExitCode -ne 0) {
            throw "docker rm -f pvsql failed: $($removed.Output)"
        }
    }
}

function Run-DatabaseSetup {
    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    Remove-PvSqlContainer
    $setupPath = Join-Path $LegacyDir 'db\setup_db.bat'
    $setupLog = Join-Path $runDir 'db-setup.log'
    $setupErrorLog = Join-Path $runDir 'db-setup.stderr.log'
    $setupRunnerPath = Join-Path $runDir 'run-db-setup.bat'
    @(
        '@echo off'
        'setlocal DisableDelayedExpansion'
        'call "%PV_LEGACY_SETUP_PATH%"'
        'set "setupExitCode=%ERRORLEVEL%"'
        'echo DB_SETUP_EXITCODE=%setupExitCode%'
        'exit /b %setupExitCode%'
    ) | Set-Content -LiteralPath $setupRunnerPath -Encoding ASCII
    $previousSetupPath = [Environment]::GetEnvironmentVariable('PV_LEGACY_SETUP_PATH', 'Process')
    $env:PV_LEGACY_SETUP_PATH = $setupPath
    try {
        $setupProcess = Start-Process -FilePath $env:ComSpec `
        -ArgumentList @('/d', '/c', "`"$setupRunnerPath`"") `
        -WorkingDirectory $LegacyDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $setupLog `
        -RedirectStandardError $setupErrorLog `
        -PassThru
    } finally {
        if ($null -eq $previousSetupPath) {
            Remove-Item Env:PV_LEGACY_SETUP_PATH -ErrorAction SilentlyContinue
        } else {
            Set-Item Env:PV_LEGACY_SETUP_PATH $previousSetupPath
        }
    }
    $setupFinished = $setupProcess.WaitForExit(900000)
    if (-not $setupFinished) {
        Stop-Process -Id $setupProcess.Id -Force -ErrorAction SilentlyContinue
        throw 'db\setup_db.bat exceeded the 900-second timeout.'
    }
    $setupProcess.WaitForExit()
    $setupProcess.Refresh()
    $setupOutput = if (Test-Path -LiteralPath $setupLog) { Get-Content -LiteralPath $setupLog -Raw } else { '' }
    $setupExitCodeMatch = [regex]::Match($setupOutput, '(?m)^DB_SETUP_EXITCODE=(\d+)\s*$')
    if (-not $setupExitCodeMatch.Success) {
        throw "Could not read db\setup_db.bat exit code from its output. See $setupLog."
    }
    $setupExitCode = [int]$setupExitCodeMatch.Groups[1].Value
    if ($setupExitCode -ne 0) {
        $details = if (Test-Path $setupErrorLog) { Get-Content $setupErrorLog -Raw } else { '' }
        throw "db\setup_db.bat failed with exit code $setupExitCode. $details See $setupLog."
    }

    $seeded = Wait-ForAppUserCount -TimeoutSeconds 180
    if ($null -eq $seeded.Count -or $seeded.Count -eq 0) {
        throw 'db\setup_db.bat finished but PortfolioViewer.dbo.APP_USER has no seeded users.'
    }
}

function Start-IisExpressProcess {
    param(
        [string]$IisExpressPath,
        [int]$ListenPort,
        [string]$StandardOutputPath,
        [string]$StandardErrorPath,
        [switch]$UseApplicationHost
    )

    if (Test-Path -LiteralPath $StandardOutputPath) {
        Remove-Item -LiteralPath $StandardOutputPath -Force
    }
    if (Test-Path -LiteralPath $StandardErrorPath) {
        Remove-Item -LiteralPath $StandardErrorPath -Force
    }

    if ($UseApplicationHost) {
        $configPath = Join-Path $runDir 'applicationhost.config'
        $xmlWebPath = [System.Security.SecurityElement]::Escape($webPath)
        $applicationHost = @"
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.applicationHost>
    <applicationPools>
      <add name="LegacyPortfolioViewerPool" managedRuntimeVersion="v4.0" managedPipelineMode="Integrated" />
    </applicationPools>
    <sites>
      <site name="Legacy Portfolio Viewer" id="1">
        <application path="/" applicationPool="LegacyPortfolioViewerPool">
          <virtualDirectory path="/" physicalPath="$xmlWebPath" />
        </application>
        <bindings>
          <binding protocol="http" bindingInformation="*:$ListenPort:localhost" />
        </bindings>
      </site>
    </sites>
  </system.applicationHost>
</configuration>
"@
        Set-Content -LiteralPath $configPath -Value $applicationHost -Encoding UTF8
        $arguments = @(
            ('/config:"{0}"' -f $configPath),
            '/site:"Legacy Portfolio Viewer"',
            '/clr:v4.0',
            '/systray:false'
        )
    } else {
        $arguments = @(
            ('/path:"{0}"' -f $webPath),
            "/port:$ListenPort",
            '/clr:v4.0',
            '/systray:false'
        )
    }

    try {
        $process = Start-Process -FilePath $IisExpressPath `
            -ArgumentList $arguments `
            -WindowStyle Hidden `
            -RedirectStandardOutput $StandardOutputPath `
            -RedirectStandardError $StandardOutputPath `
            -PassThru
    } catch {
        $process = Start-Process -FilePath $IisExpressPath `
            -ArgumentList $arguments `
            -WindowStyle Hidden `
            -RedirectStandardOutput $StandardOutputPath `
            -RedirectStandardError $StandardErrorPath `
            -PassThru
        Write-Host "IIS Express stderr is in $StandardErrorPath because Windows could not redirect both streams to one file."
    }
    Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding ASCII
    $process
}

function Wait-ForLoginPage {
    param(
        [int]$ProcessId,
        [string]$Url,
        [int]$TimeoutSeconds = 300
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $lastError = ''
    do {
        if ($null -eq (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) {
            return [pscustomobject]@{ Ready = $false; Error = "IIS Express PID $ProcessId exited before Login.aspx became ready." }
        }
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 15
            if ([int]$response.StatusCode -eq 200) {
                return [pscustomobject]@{ Ready = $true; Error = '' }
            }
            $lastError = "HTTP $($response.StatusCode)"
        } catch {
            $lastError = $_.Exception.Message
        }
        if ([DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Seconds 3
        }
    } while ([DateTime]::UtcNow -lt $deadline)

    [pscustomobject]@{ Ready = $false; Error = "Login.aspx did not return HTTP 200 within $TimeoutSeconds seconds. Last response: $lastError" }
}

if (-not (Test-Path -LiteralPath $LegacyDir -PathType Container)) {
    throw "Legacy repository not found at '$LegacyDir'. Pass -LegacyDir with the legacy-wealth-platform directory."
}
if (-not (Test-Path -LiteralPath (Join-Path $LegacyDir 'db\setup_db.bat') -PathType Leaf)) {
    throw "Legacy repository at '$LegacyDir' does not contain db\setup_db.bat."
}

Write-StepHeader 'Port guard'
try {
    $reservedPorts = @(1521, 3001, 5173, 1433)
    if ($Port -in $reservedPorts) {
        throw "Port $Port is reserved by the Oracle, API, Vite, or SQL Server service."
    }

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($null -ne $listener) {
        $ownerId = [int]$listener.OwningProcess
        $owner = Get-Process -Id $ownerId -ErrorAction SilentlyContinue
        $recordedId = $null
        if (Test-Path -LiteralPath $pidPath) {
            $parsedId = 0
            if ([int]::TryParse((Get-Content -LiteralPath $pidPath -Raw).Trim(), [ref]$parsedId)) {
                $recordedId = $parsedId
            }
        }

        $recordedIisExpress = $ownerId -eq $recordedId -and
            $null -ne $owner -and
            $owner.ProcessName -ieq 'iisexpress'
        if (-not $recordedIisExpress -and $ownerId -eq 4 -and $null -ne $recordedId) {
            $recordedProcess = Get-Process -Id $recordedId -ErrorAction SilentlyContinue
            if ($null -ne $recordedProcess -and $recordedProcess.ProcessName -ieq 'iisexpress') {
                try {
                    $serviceState = (& netsh.exe http show servicestate view=requestq verbose=yes 2>$null) -join [Environment]::NewLine
                    $queueBlocks = $serviceState -split '(?m)^Request queue name:\s*'
                    $controllerPattern = '(?im)^\s*Controller process:\s*\r?\n\s*ID:\s*{0},\s*image:\s*.*\\iisexpress\.exe' -f $recordedId
                    $urlPattern = '(?im)^\s*HTTP://(?:\+|\*|LOCALHOST|127\.0\.0\.1):{0}/' -f $Port
                    foreach ($queueBlock in $queueBlocks) {
                        if ([regex]::IsMatch($queueBlock, $controllerPattern) -and
                            [regex]::IsMatch($queueBlock, $urlPattern)) {
                            $recordedIisExpress = $true
                            break
                        }
                    }
                } catch {
                }
            }
        }

        if ($recordedIisExpress) {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$Port/Login.aspx" -UseBasicParsing -TimeoutSec 8
                if ([int]$response.StatusCode -eq 200) {
                    Write-Host "Legacy Portfolio Viewer: http://localhost:$Port/Login.aspx"
                    Write-StepElapsed
                    Show-LoginTable
                    exit 0
                }
            } catch {
            }
        }

        $ownerName = if ($null -ne $owner) { $owner.ProcessName } else { 'unknown process' }
        throw "Port $Port is already listening, owned by $ownerName (PID $ownerId)."
    }
} catch {
    Write-StepElapsed
    throw
}
Write-StepElapsed

Write-StepHeader 'SQL Server'
try {
    $dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
    if ($null -eq $dockerCommand) {
        $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
    }
    if ($null -eq $dockerCommand) {
        throw 'Docker CLI was not found on PATH.'
    }
    $script:dockerPath = $dockerCommand.Source

    $container = Invoke-DockerCommand @('container', 'inspect', 'pvsql')
    $containerExists = $container.ExitCode -eq 0
    if ($ResetDb -and $containerExists) {
        $removed = Invoke-DockerCommand @('rm', '-f', 'pvsql')
        if ($removed.ExitCode -ne 0) {
            throw "docker rm -f pvsql failed: $($removed.Output)"
        }
        $containerExists = $false
    }

    if ($containerExists) {
        $started = Invoke-DockerCommand @('start', 'pvsql')
        if ($started.ExitCode -ne 0) {
            throw "docker start pvsql failed: $($started.Output)"
        }
        $db = Wait-ForAppUserCount -StopOnMissing
        if ($db.Missing -or $db.Count -eq 0) {
            if ($db.Missing) {
                Write-Host 'PortfolioViewer database or APP_USER table is missing; recreating pvsql.'
            } else {
                Write-Host 'APP_USER has no seeded rows; recreating pvsql to seed a clean database.'
            }
            Run-DatabaseSetup
        } else {
            Write-Host "pvsql is ready; found $($db.Count) application users, skipping seed scripts."
        }
    } else {
        Write-Host 'pvsql does not exist; creating and seeding the database.'
        Run-DatabaseSetup
    }
} catch {
    Write-StepElapsed
    throw
}
Write-StepElapsed

Write-StepHeader 'Dev passwords'
try {
    if (-not $NoDevPasswords) {
        $sha1 = [System.Security.Cryptography.SHA1]::Create()
        try {
            $hashBytes = $sha1.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($DevPassword))
        } finally {
            $sha1.Dispose()
        }
        $passwordHash = [BitConverter]::ToString($hashBytes).Replace('-', '')
        $updateQuery = "SET NOCOUNT ON; UPDATE dbo.APP_USER SET PWD_HASH = '$passwordHash' WHERE ACTIVE_FLG = 'Y' AND ((USERNAME = 'PVADMIN' AND ROLE_CD = 'ADMIN') OR (USERNAME = 'JSMITH' AND ROLE_CD = 'ADVISER') OR (USERNAME = 'LBRENNAN' AND ROLE_CD = 'OPS')); SELECT @@ROWCOUNT;"
        $update = Invoke-DockerCommand @(
            'exec', 'pvsql', '/opt/mssql-tools18/bin/sqlcmd',
            '-S', 'localhost', '-U', 'sa', '-P', $sqlPassword,
            '-d', 'PortfolioViewer', '-C', '-b', '-h', '-1', '-Q', $updateQuery
        )
        if ($update.ExitCode -ne 0) {
            throw "Could not update local dev passwords: $($update.Output)"
        }
        $updatedCount = [regex]::Match($update.Output, '(?m)^\s*(\d+)\s*$')
        if (-not $updatedCount.Success -or [int]$updatedCount.Groups[1].Value -ne 3) {
            throw "Expected to update exactly the three active dev accounts; sqlcmd response: $($update.Output)"
        }
        Write-Host 'Updated the three active development accounts in the local pvsql container.'
    } else {
        Write-Host 'Dev password updates disabled by -NoDevPasswords.'
    }
} catch {
    Write-StepElapsed
    throw
}
Write-StepElapsed

if (-not $SkipBuild) {
    Write-StepHeader 'Build'
    try {
        $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
        if (-not (Test-Path -LiteralPath $vswhere -PathType Leaf)) {
            throw "vswhere.exe was not found at '$vswhere'."
        }
        $msbuildCandidates = @(& $vswhere -latest -products '*' -requires Microsoft.Component.MSBuild -find 'MSBuild\**\Bin\MSBuild.exe')
        if ($LASTEXITCODE -ne 0 -or $msbuildCandidates.Count -eq 0) {
            throw 'vswhere did not find an MSBuild installation with Microsoft.Component.MSBuild.'
        }
        $msbuildPath = $msbuildCandidates[0].ToString().Trim()
        if (-not (Test-Path -LiteralPath $msbuildPath -PathType Leaf)) {
            throw "MSBuild was not found at '$msbuildPath'."
        }

        $packagesPath = Join-Path $LegacyDir 'packages'
        $requiredPackages = @(
            (Join-Path $packagesPath 'log4net.2.0.8'),
            (Join-Path $packagesPath 'NUnit.2.6.4'),
            (Join-Path $packagesPath 'NUnit.Runners.2.6.4')
        )
        $missingPackages = @($requiredPackages | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Container) })
        if ($missingPackages.Count -gt 0) {
            $nugetCommand = Get-Command nuget.exe -ErrorAction SilentlyContinue
            if ($null -eq $nugetCommand -and $env:ChocolateyInstall) {
                $nugetPath = Join-Path $env:ChocolateyInstall 'bin\nuget.exe'
                if (Test-Path -LiteralPath $nugetPath -PathType Leaf) {
                    $nugetCommand = [pscustomobject]@{ Source = $nugetPath }
                }
            }
            if ($null -eq $nugetCommand) {
                throw 'nuget.exe was not found on PATH or in the Chocolatey bin directory.'
            }
            Push-Location $LegacyDir
            try {
                & $nugetCommand.Source restore PortfolioViewer.sln -PackagesDirectory packages -Source https://api.nuget.org/v3/index.json -NonInteractive
                if ($LASTEXITCODE -ne 0) {
                    throw "nuget restore failed with exit code $LASTEXITCODE."
                }
            } finally {
                Pop-Location
            }
        } else {
            Write-Host 'Required log4net and NUnit packages are already present; skipping NuGet restore.'
        }

        Push-Location $LegacyDir
        try {
            & $msbuildPath PortfolioViewer.sln /p:Configuration=Debug '/p:Platform=Any CPU' /v:m /nologo
            if ($LASTEXITCODE -ne 0) {
                throw "MSBuild failed with exit code $LASTEXITCODE."
            }
        } finally {
            Pop-Location
        }
    } catch {
        Write-StepElapsed
        throw
    }
    Write-StepElapsed
} else {
    Write-Host '==> Build (skipped)'
    Write-Host '    elapsed: 0.0 seconds'
}

Write-StepHeader 'IIS Express'
try {
    $iisExpressPath = Join-Path $env:ProgramFiles 'IIS Express\iisexpress.exe'
    if (-not (Test-Path -LiteralPath $iisExpressPath -PathType Leaf)) {
        throw "IIS Express was not found at '$iisExpressPath'."
    }
    if (-not (Test-Path -LiteralPath $webPath -PathType Container)) {
        throw "Web application directory not found at '$webPath'."
    }
    if (-not (Test-Path -LiteralPath $archiveRoot -PathType Container)) {
        throw "Archive directory resolved from Web.config was not found at '$archiveRoot'."
    }

    New-Item -ItemType Directory -Path $runDir -Force | Out-Null
    if (Test-Path -LiteralPath $logPath) {
        Remove-Item -LiteralPath $logPath -Force
    }
    $stderrPath = Join-Path $runDir 'iisexpress.stderr.log'
    if (Test-Path -LiteralPath $stderrPath) {
        Remove-Item -LiteralPath $stderrPath -Force
    }
    $iisProcess = Start-IisExpressProcess -IisExpressPath $iisExpressPath `
        -ListenPort $Port -StandardOutputPath $logPath -StandardErrorPath $stderrPath
    Write-Host "Started IIS Express (PID $($iisProcess.Id)); logs: $logPath"
} catch {
    Write-StepElapsed
    throw
}
Write-StepElapsed

Write-StepHeader 'HTTP readiness'
try {
    $loginUrl = "http://localhost:$Port/Login.aspx"
    $readiness = Wait-ForLoginPage -ProcessId $iisProcess.Id -Url $loginUrl
    if (-not $readiness.Ready) {
        Write-Host "IIS Express /path mode was not ready: $($readiness.Error)"
        Stop-Process -Id $iisProcess.Id -Force -ErrorAction SilentlyContinue
        $iisProcess = Start-IisExpressProcess -IisExpressPath $iisExpressPath `
            -ListenPort $Port -StandardOutputPath $logPath -StandardErrorPath $stderrPath `
            -UseApplicationHost
        Write-Host "Started IIS Express with applicationhost.config (PID $($iisProcess.Id))."
        $readiness = Wait-ForLoginPage -ProcessId $iisProcess.Id -Url $loginUrl
    }
    if (-not $readiness.Ready) {
        $logTail = if (Test-Path -LiteralPath $logPath) { (Get-Content -LiteralPath $logPath -Tail 30) -join [Environment]::NewLine } else { '' }
        $stderrTail = if (Test-Path -LiteralPath $stderrPath) { (Get-Content -LiteralPath $stderrPath -Tail 30) -join [Environment]::NewLine } else { '' }
        throw "$($readiness.Error) stdout: $logTail stderr: $stderrTail"
    }
} catch {
    Write-StepElapsed
    throw
}
Write-StepElapsed

Write-Host "Archive root from Web.config: $archiveRoot"
Write-Host "Legacy Portfolio Viewer: http://localhost:$Port/Login.aspx"
Show-LoginTable
