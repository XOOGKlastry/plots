param(
  [Parameter(Mandatory=$true)][string]$Cloudflared,
  [Parameter(Mandatory=$true)][int]$Port,
  [Parameter(Mandatory=$true)][string]$LogPath,
  [Parameter(Mandatory=$true)][string]$UrlFile,
  [Parameter(Mandatory=$true)][string]$ConfigJs,
  [int]$TimeoutSec = 90
)

$ErrorActionPreference = 'Continue'
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$errPath = "$LogPath.err"
foreach ($f in @($LogPath, $errPath)) {
  if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
}

# URL appears on STDERR (INF Visit it at https://....trycloudflare.com)
$p = Start-Process -FilePath $Cloudflared `
  -ArgumentList @('tunnel','--url',"http://127.0.0.1:$Port",'--no-autoupdate') `
  -RedirectStandardOutput $LogPath `
  -RedirectStandardError $errPath `
  -WindowStyle Minimized `
  -PassThru

Write-Host "cloudflared pid=$($p.Id), czekam do ${TimeoutSec}s na URL..."

$pattern = 'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
$tun = $null
$deadline = (Get-Date).AddSeconds($TimeoutSec)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 800
  foreach ($f in @($errPath, $LogPath)) {
    if (-not (Test-Path $f)) { continue }
    try {
      $text = Get-Content -Raw -ErrorAction Stop $f
    } catch { continue }
    $m = [regex]::Matches($text, $pattern)
    if ($m.Count -gt 0) {
      $tun = $m[$m.Count - 1].Value
      break
    }
  }
  if ($tun) { break }
  if ($p.HasExited) {
    Write-Host "cloudflared zakonczyl sie (exit=$($p.ExitCode))"
    break
  }
}

# merge logs for humans
try {
  $combined = ""
  if (Test-Path $LogPath) { $combined += (Get-Content -Raw $LogPath) }
  if (Test-Path $errPath) { $combined += (Get-Content -Raw $errPath) }
  [IO.File]::WriteAllText($LogPath, $combined)
} catch {}

if (-not $tun) {
  Write-Host "Nie udalo sie odczytac URL z $LogPath / $errPath"
  if (Test-Path $LogPath) { Get-Content $LogPath -Tail 40 }
  if (Test-Path $errPath) { Get-Content $errPath -Tail 40 }
  exit 1
}

[IO.File]::WriteAllText($UrlFile, $tun)
Write-Host ""
Write-Host "============================================"
Write-Host " TUNEL HTTPS: $tun"
Write-Host " Lokalnie:    http://127.0.0.1:$Port/"
Write-Host " Pages:       https://xoogklastry.github.io/plots/"
Write-Host "============================================"
Write-Host ""
Write-Host "Uwaga: trycloud URL ZMIENIA SIE po kazdym restarcie."
Write-Host "Zaktualizowano docs\config.js — wypchnij do GitHub, zeby Pages widzialo nowy URL."
Write-Host "Albo wspolpracownicy: $tun/  (mapa z tego samego originu)"
Write-Host ""

if (Test-Path $ConfigJs) {
  $c = Get-Content -Raw -Encoding UTF8 $ConfigJs
  $n = [regex]::Replace($c, 'TILES_URL:\s*"[^"]*"', ('TILES_URL: "' + $tun + '"'))
  [IO.File]::WriteAllText($ConfigJs, $n, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "config.js TILES_URL = $tun"
}

exit 0
