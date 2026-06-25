# Déploiement sur Windows — TousLocation

Guide d'installation et de lancement de l'application **TousLocation**
(Laravel 13 + React/Vite, MySQL/MariaDB) sur un poste Windows.

---

## 1. Installation en un clic (recommandé)

1. Installez les **prérequis** une seule fois (voir §3).
2. Assurez-vous que **MySQL/MariaDB est démarré**.
3. **Double-cliquez sur `deploy-windows.bat`** à la racine du projet.

Le script s'occupe de tout :

- vérifie les prérequis (PHP, Composer, Node, npm) ;
- installe les dépendances (`composer install`, `npm install`) ;
- crée et configure le fichier `backend/.env` ;
- génère la clé applicative (`APP_KEY`) ;
- **crée la base de données** si elle n'existe pas ;
- exécute les **migrations** et charge les **données de démonstration** (avec images du matériel) ;
- crée le lien de stockage public ;
- lance le **backend** (port 8000) et le **frontend** (port 5173) dans deux fenêtres ;
- ouvre l'application dans le navigateur : <http://localhost:5173>.

> Deux fenêtres `cmd` restent ouvertes (API et Web). **Les fermer arrête l'application.**

### Comptes de démonstration

Mot de passe commun : **`1234567890`**

| Rôle | E-mail |
|------|--------|
| Administrateur | `admin@touslocations.com` |
| Gérant (boutique) | `manager@touslocations.com` |
| Employé | `employe@touslocations.com` |
| Client | `client@touslocations.com` |
| Gérant boutique **Outillage Maroc** (catalogue Makita, 1268 produits) | `gerant@outillagemaroc.ma` |

> La boutique de démonstration **Outillage Maroc** (catalogue Makita complet, avec
> images et descriptions) est chargée automatiquement. Pour la (ré)importer
> manuellement : `cd backend && php artisan demo:makita` (ou `--fresh`).

---

## 2. Options du script

En ligne de commande (PowerShell), depuis la racine du projet :

```powershell
powershell -ExecutionPolicy Bypass -File deploy-windows.ps1 [options]
```

| Option | Défaut | Description |
|--------|--------|-------------|
| `-DbHost`       | `127.0.0.1` | Hôte MySQL |
| `-DbPort`       | `3306` | Port MySQL |
| `-DbName`       | `touslocation` | Nom de la base (créée si absente) |
| `-DbUser`       | `root` | Utilisateur MySQL |
| `-DbPass`       | *(vide)* | Mot de passe MySQL |
| `-BackendPort`  | `8000` | Port de l'API Laravel |
| `-FrontendPort` | `5173` | Port du serveur web Vite |
| `-Fresh`        | — | Réinitialise la base et **recharge** les données de démo |
| `-NoBrowser`    | — | N'ouvre pas le navigateur |

**Exemples**

```powershell
# Mot de passe MySQL personnalisé
powershell -ExecutionPolicy Bypass -File deploy-windows.ps1 -DbPass "monMotDePasse"

# Recharger des données de démo fraîches (ATTENTION : efface les données existantes)
powershell -ExecutionPolicy Bypass -File deploy-windows.ps1 -Fresh
```

> Le premier lancement effectue toujours un chargement complet des données de démo.
> Les lancements suivants **conservent** vos données (migrations seules) — sauf avec `-Fresh`.

---

## 3. Prérequis (installation unique)

| Logiciel | Version | Installation |
|----------|---------|--------------|
| **PHP** | 8.3+ (avec `pdo_mysql`, `mbstring`, `fileinfo`, `gd`) | <https://windows.php.net/download/> ou `winget install PHP.PHP.8.3` |
| **Composer** | 2.x | <https://getcomposer.org/Composer-Setup.exe> |
| **Node.js** | 18+ (npm inclus) | <https://nodejs.org/> ou `winget install OpenJS.NodeJS.LTS` |
| **MySQL / MariaDB** | 8.x / 10.x | `winget install MariaDB.Server` ou MySQL Community Server |

Après installation, **rouvrez une nouvelle fenêtre** pour que le `PATH` soit à jour, puis vérifiez :

```powershell
php -v
composer --version
node -v
```

### Activer les extensions PHP

Dans votre `php.ini`, décommentez (retirez le `;`) :

```
extension=pdo_mysql
extension=mbstring
extension=fileinfo
extension=gd
```

---

## 4. Installation manuelle (sans script)

<details>
<summary>Étapes détaillées</summary>

```powershell
# Backend
cd backend
composer install
copy .env.example .env
# Éditez .env : DB_CONNECTION=mysql, DB_DATABASE=touslocation, DB_USERNAME, DB_PASSWORD
php artisan key:generate
# Créez la base dans MySQL : CREATE DATABASE touslocation;
php artisan migrate:fresh --seed
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000

# Frontend (nouveau terminal)
cd frontend
npm install
echo VITE_API_URL=http://127.0.0.1:8000/api > .env
npm run dev
```

</details>

---

## 5. Mise en production (build optimisé)

Pour servir une version optimisée du frontend plutôt que le serveur de développement :

```powershell
cd frontend
npm run build      # genere frontend/dist/
npm run preview    # ou servez dist/ via nginx / IIS / Apache
```

Côté backend, passez `APP_ENV=production` et `APP_DEBUG=false` dans `.env`, puis :

```powershell
cd backend
php artisan config:cache
php artisan route:cache
```

Pour un déploiement serveur Linux/VPS (nginx + PHP-FPM), voir le dossier [`deploy/`](deploy/).

---

## 6. Dépannage

| Problème | Solution |
|----------|----------|
| `PHP introuvable dans le PATH` | Installez PHP et rouvrez le terminal (§3). |
| `Connexion MySQL impossible` | Démarrez MySQL/MariaDB ; vérifiez `-DbUser` / `-DbPass`. |
| `could not find driver` | Activez `extension=pdo_mysql` dans `php.ini` (§3). |
| Page blanche / erreurs API | Vérifiez que la fenêtre **API** (port 8000) tourne et que `frontend/.env` pointe vers `http://127.0.0.1:8000/api`. |
| Port 5173 déjà utilisé | Relancez avec `-FrontendPort 5174`. |
| Images du matériel absentes | Lancez `php artisan storage:link` dans `backend/`. |
| Réexécuter une démo propre | `deploy-windows.bat` puis répondez, ou `... deploy-windows.ps1 -Fresh`. |

---

## 7. Architecture rapide

```
yo-pfe/
├─ deploy-windows.bat      # lanceur un clic (double-clic)
├─ deploy-windows.ps1      # script de deploiement
├─ backend/                # API Laravel 13 (PHP)  -> http://127.0.0.1:8000
├─ frontend/               # SPA React + Vite      -> http://localhost:5173
├─ deploy/                 # deploiement VPS Linux (nginx)
└─ docs/                   # documentation, diagrammes, nomenclature FR
```

Nomenclature 100 % française : voir [`docs/NOMENCLATURE-FR.md`](docs/NOMENCLATURE-FR.md).
