# harness-kit installer for Windows PowerShell.
#   irm https://raw.githubusercontent.com/7binh/harness-kit/main/install.ps1 | iex
# To pass options, download first:
#   irm https://raw.githubusercontent.com/7binh/harness-kit/main/install.ps1 -OutFile install.ps1; ./install.ps1 --dir docs/workflow
$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'harness-kit needs Node.js 18 or newer. Install it from https://nodejs.org and run this again.'
    exit 1
}

$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 18) {
    Write-Error "harness-kit needs Node.js 18 or newer; found $(node -v)."
    exit 1
}

npx --yes github:7binh/harness-kit init @args
exit $LASTEXITCODE
