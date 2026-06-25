<#
  TousLocation — Déploiement « un clic » pour Windows.
  Installe les dépendances, configure la base MySQL/MariaDB, migre + sème les
  données de démo, puis lance le backend (Laravel) et le frontend (Vite).

  Utilisation :
    Double-cliquer sur deploy-windows.bat
  ou en ligne de commande :
    powershell -ExecutionPolicy Bypass -File deploy-windows.ps1 [options]

  Options :
    -DbHost 127.0.0.1   -DbPort 3306   -DbName touslocation
    -DbUser root        -DbPass "monMotDePasse"
    -Fresh              Réinitialise la base et recharge les données de démo
    -NoBrowser          N'ouvre pas le navigateur automatiquement
    -BackendPort 8000   -FrontendPort 5173
#>
param(
  [string]$DbHost = "127.0.0.1",
  [int]$DbPort = 3306,
  [string]$DbName = "touslocation",
  [string]$DbUser = "root",
  [string]$DbPass = "",
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 5173,
  [switch]$Fresh,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$root     = $PSScriptRoot
$backend  = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

function Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)    { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Warn($msg)  { Write-Host "    [!] $msg" -ForegroundColor Yellow }
function Die($msg)   { Write-Host "`n[ERREUR] $msg" -ForegroundColor Red; Write-Host "Consultez DEPLOIEMENT-WINDOWS.md pour l'installation des prérequis." -ForegroundColor Red; exit 1 }
function Have($cmd)  { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "   TousLocation — Deploiement Windows (un clic)" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta

# --- 1. Prérequis ---------------------------------------------------------
Step "Verification des prerequis"
if (-not (Have "php"))  { Die "PHP 8.3+ introuvable dans le PATH." }
if (-not (Have "composer")) { Die "Composer introuvable dans le PATH." }
if (-not (Have "node")) { Die "Node.js 18+ introuvable dans le PATH." }
if (-not (Have "npm"))  { Die "npm introuvable dans le PATH." }
$phpv  = (php -r "echo PHP_VERSION;")
$nodev = (node -v)
Ok "PHP $phpv | Node $nodev | Composer present"
if (-not (Test-Path $backend))  { Die "Dossier backend introuvable ($backend)." }
if (-not (Test-Path $frontend)) { Die "Dossier frontend introuvable ($frontend)." }

# --- 2. Dépendances backend ----------------------------------------------
Step "Backend : dependances Composer"
Push-Location $backend
if (-not (Test-Path (Join-Path $backend "vendor"))) {
  composer install --no-interaction --prefer-dist
  if ($LASTEXITCODE -ne 0) { Pop-Location; Die "composer install a echoue." }
  Ok "Dependances installees"
} else { Ok "vendor/ deja present (saute)" }

# --- 3. Fichier .env ------------------------------------------------------
Step "Backend : configuration (.env)"
$envPath = Join-Path $backend ".env"
$firstRun = -not (Test-Path $envPath)
if ($firstRun) {
  Copy-Item (Join-Path $backend ".env.example") $envPath
  Ok ".env cree depuis .env.example"
} else { Ok ".env existant conserve" }

# Réécriture des clés essentielles (idempotent).
$lines = Get-Content $envPath
$set = @{
  "APP_NAME"            = "TousLocation"
  "APP_ENV"             = "local"
  "APP_DEBUG"           = "true"
  "APP_URL"             = "http://localhost:$BackendPort"
  "APP_LOCALE"          = "fr"
  "APP_FALLBACK_LOCALE" = "fr"
  "DB_CONNECTION"       = "mysql"
  "DB_HOST"             = $DbHost
  "DB_PORT"             = "$DbPort"
  "DB_DATABASE"         = $DbName
  "DB_USERNAME"         = $DbUser
  "DB_PASSWORD"         = $DbPass
}
$seen = @{}
$out = foreach ($l in $lines) {
  $m = [regex]::Match($l, '^\s*#?\s*([A-Z0-9_]+)=')
  if ($m.Success -and $set.ContainsKey($m.Groups[1].Value)) {
    $k = $m.Groups[1].Value; $seen[$k] = $true
    "$k=$($set[$k])"
  } else { $l }
}
foreach ($k in $set.Keys) { if (-not $seen.ContainsKey($k)) { $out += "$k=$($set[$k])" } }
Set-Content -Path $envPath -Value $out -Encoding UTF8
Ok "Cles APP_* et DB_* ecrites (base: $DbName @ $DbHost`:$DbPort)"

# Clé applicative.
if (-not (Select-String -Path $envPath -Pattern '^APP_KEY=base64:' -Quiet)) {
  php artisan key:generate --force | Out-Null
  Ok "APP_KEY generee"
} else { Ok "APP_KEY presente" }

# --- 4. Base de données ---------------------------------------------------
Step "Base de donnees : creation si absente"
$createDb = @"
<?php
try {
  `$pdo = new PDO("mysql:host=$DbHost;port=$DbPort", "$DbUser", "$DbPass", [PDO::ATTR_TIMEOUT => 5]);
  `$pdo->exec("CREATE DATABASE IF NOT EXISTS $DbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  echo "DB_OK";
} catch (Throwable `$e) { fwrite(STDERR, `$e->getMessage()); exit(1); }
"@
$tmpDb = Join-Path $backend "_createdb.php"
Set-Content -Path $tmpDb -Value $createDb -Encoding UTF8
$dbres = & php $tmpDb 2>&1
Remove-Item $tmpDb -Force -ErrorAction SilentlyContinue
if ($dbres -notmatch "DB_OK") {
  Die "Connexion MySQL impossible : $dbres`n  Verifiez que MySQL/MariaDB tourne et que les identifiants (-DbUser/-DbPass) sont corrects."
}
Ok "Base '$DbName' prete"

# --- 5. Migrations + données de démo -------------------------------------
Step "Base de donnees : migrations + donnees de demo"
if ($Fresh -or $firstRun) {
  php artisan migrate:fresh --seed --force
  if ($LASTEXITCODE -ne 0) { Pop-Location; Die "migrate:fresh a echoue." }
  Ok "Schema recree + donnees de demo chargees"
} else {
  php artisan migrate --force
  Ok "Migrations appliquees (donnees conservees ; utilisez -Fresh pour recharger la demo)"
}

# Lien de stockage public (images).
php artisan storage:link 2>$null | Out-Null
Ok "Lien storage public OK"
Pop-Location

# --- 6. Frontend ----------------------------------------------------------
Step "Frontend : dependances + configuration"
Push-Location $frontend
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  npm install
  if ($LASTEXITCODE -ne 0) { Pop-Location; Die "npm install a echoue." }
  Ok "Dependances npm installees"
} else { Ok "node_modules/ deja present (saute)" }
Set-Content -Path (Join-Path $frontend ".env") -Value "VITE_API_URL=http://127.0.0.1:$BackendPort/api" -Encoding UTF8
Ok "frontend/.env -> http://127.0.0.1:$BackendPort/api"
Pop-Location

# --- 7. Lancement ---------------------------------------------------------
Step "Lancement des serveurs"
Start-Process -FilePath "cmd.exe" -ArgumentList "/k","title TousLocation API && php artisan serve --host=127.0.0.1 --port=$BackendPort" -WorkingDirectory $backend
Start-Process -FilePath "cmd.exe" -ArgumentList "/k","title TousLocation Web && npm run dev -- --port $FrontendPort" -WorkingDirectory $frontend
Ok "Backend  -> http://127.0.0.1:$BackendPort"
Ok "Frontend -> http://localhost:$FrontendPort"

if (-not $NoBrowser) {
  Start-Sleep -Seconds 5
  Start-Process "http://localhost:$FrontendPort"
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "   TousLocation est lance !" -ForegroundColor Green
Write-Host "   Application : http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "   Comptes de demonstration (mot de passe : 1234567890) :" -ForegroundColor Green
Write-Host "     - Admin   : admin@touslocations.com" -ForegroundColor Green
Write-Host "     - Gerant  : manager@touslocations.com" -ForegroundColor Green
Write-Host "     - Employe : employe@touslocations.com" -ForegroundColor Green
Write-Host "     - Client  : client@touslocations.com" -ForegroundColor Green
Write-Host "   Boutique Makita (1268 produits) : gerant@outillagemaroc.ma" -ForegroundColor Green
Write-Host "   (Deux fenetres se sont ouvertes : API et Web. Les fermer arrete l'app.)" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green
