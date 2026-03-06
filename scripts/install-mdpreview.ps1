# Install the mdpreview skill and shell function for markdown.mbt playground.
#
# Usage:
#   .\scripts\install-mdpreview.ps1
#
# What it does:
#   1. Copies .claude\skills\mdpreview into ~\.claude\skills\mdpreview
#   2. Appends the mdpreview function to your PowerShell profile (if not already present)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$SkillSrc = Join-Path $RepoDir '.claude\skills\mdpreview'
$SkillDst = Join-Path $HOME '.claude\skills\mdpreview'

# --- 1. Install Claude Code skill ---
if (Test-Path $SkillDst) {
    # Remove existing and copy fresh
    Remove-Item -Recurse -Force $SkillDst
}

$parentDir = Split-Path -Parent $SkillDst
if (-not (Test-Path $parentDir)) {
    New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
}
Copy-Item -Recurse -Force $SkillSrc $SkillDst
Write-Host "Installed skill: $SkillSrc -> $SkillDst"

# --- 2. Install PowerShell function ---
$ProfilePath = $PROFILE.CurrentUserCurrentHost
$Marker = '# markdown.mbt mdpreview'

if ((Test-Path $ProfilePath) -and (Select-String -Path $ProfilePath -Pattern ([regex]::Escape($Marker)) -Quiet)) {
    Write-Host "Shell function already present in $ProfilePath"
} else {
    if (-not (Test-Path $ProfilePath)) {
        $profileDir = Split-Path -Parent $ProfilePath
        if (-not (Test-Path $profileDir)) {
            New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
        }
        New-Item -ItemType File -Path $ProfilePath -Force | Out-Null
    }

    $functionBlock = @'

# markdown.mbt mdpreview
# Open a markdown file in the markdown.mbt playground browser preview
function mdpreview {
    param([Parameter(Mandatory)][string]$FilePath)

    $abs = Resolve-Path $FilePath -ErrorAction SilentlyContinue
    if (-not $abs -or -not (Test-Path $abs)) {
        Write-Error "mdpreview: file not found: $FilePath"
        return
    }
    $url = "http://localhost:5173/?file=$abs"
    Start-Process $url
}
'@

    Add-Content -Path $ProfilePath -Value $functionBlock
    Write-Host "Added mdpreview function to $ProfilePath"
    Write-Host "Run '. `$PROFILE' or open a new terminal to use it."
}

Write-Host 'Done.'
