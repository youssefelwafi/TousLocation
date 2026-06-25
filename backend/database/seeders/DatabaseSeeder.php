<?php

namespace Database\Seeders;

use App\Models\Achat;
use App\Models\Categorie;
use App\Models\Depense;
use App\Models\Devise;
use App\Models\Fournisseur;
use App\Models\Location;
use App\Models\Marque;
use App\Models\Materiel;
use App\Models\Taxe;
use App\Models\TypePaiement;
use App\Models\Unite;
use App\Models\Utilisateur;
use App\Models\Vente;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // --- Super-admin : voit toutes les données de tous les tenants ---
        Utilisateur::create([
            'nom' => 'Super Admin',
            'email' => 'admin@touslocations.com',
            'password' => Hash::make('1234567890'),
            'role' => 'admin',
            'statut' => 'active',
        ]);

        // --- Tenant A : manager principal avec données complètes ---
        $managerA = Utilisateur::create([
            'nom' => 'Karim Benani (Loc Maroc)',
            'email' => 'manager@touslocations.com',
            'password' => Hash::make('1234567890'),
            'role' => 'manager',
            'statut' => 'active',
        ]);
        $this->seedTenant($managerA->id, full: true);

        // --- Tenant B : second manager, données minimales (démontre l'isolation) ---
        $managerB = Utilisateur::create([
            'nom' => 'Sara El Idrissi (EventPro)',
            'email' => 'manager2@touslocations.com',
            'password' => Hash::make('1234567890'),
            'role' => 'manager',
            'statut' => 'active',
        ]);
        $this->seedTenant($managerB->id, full: false);

        // --- Boutiques importées (catalogues réels) si les fichiers existent ---
        if (is_file(database_path('data/makita-products.json'))) {
            \Illuminate\Support\Facades\Artisan::call('demo:makita');
        }
        if (is_file(database_path('data/transpalette-products.json'))) {
            \Illuminate\Support\Facades\Artisan::call('demo:transpalette');
        }
    }

    // Crée le catalogue + (option) une location de démo pour un tenant donné.
    private function seedTenant(int $ownerId, bool $full): void
    {
        // Devises (MAD par défaut)
        $mad = Devise::create(['proprietaire_id' => $ownerId, 'nom' => 'Dirham marocain', 'code' => 'MAD', 'symbole' => 'DH', 'taux_change' => 1, 'par_defaut' => true]);
        Devise::create(['proprietaire_id' => $ownerId, 'nom' => 'Euro', 'code' => 'EUR', 'symbole' => '€', 'taux_change' => 0.092]);
        Devise::create(['proprietaire_id' => $ownerId, 'nom' => 'Dollar US', 'code' => 'USD', 'symbole' => '$', 'taux_change' => 0.099]);

        // Unités
        $jour = Unite::create(['proprietaire_id' => $ownerId, 'nom' => 'Jour', 'symbole' => 'j']);
        Unite::create(['proprietaire_id' => $ownerId, 'nom' => 'Heure', 'symbole' => 'h']);
        Unite::create(['proprietaire_id' => $ownerId, 'nom' => 'Semaine', 'symbole' => 'sem']);
        Unite::create(['proprietaire_id' => $ownerId, 'nom' => 'Pièce', 'symbole' => 'pc']);

        // TVA (taux marocains, 20% par défaut)
        Taxe::create(['proprietaire_id' => $ownerId, 'nom' => 'TVA standard', 'taux' => 20, 'par_defaut' => true]);
        Taxe::create(['proprietaire_id' => $ownerId, 'nom' => 'TVA réduite', 'taux' => 14]);
        Taxe::create(['proprietaire_id' => $ownerId, 'nom' => 'TVA super-réduite', 'taux' => 10]);
        Taxe::create(['proprietaire_id' => $ownerId, 'nom' => 'Exonéré', 'taux' => 0]);

        // Types de paiement
        $cash = null;
        foreach (['Espèces', 'Carte bancaire', 'Virement', 'Chèque'] as $pt) {
            $created = TypePaiement::create(['proprietaire_id' => $ownerId, 'nom' => $pt]);
            $cash ??= $created;
        }

        // Marques
        $brands = [];
        foreach (['Dell', 'HP', 'LG', 'Epson', 'JBL', 'Shure', 'Bosch', 'Générique'] as $b) {
            $brands[$b] = Marque::create(['proprietaire_id' => $ownerId, 'nom' => $b]);
        }

        // Catalogue : complet pour A, réduit pour B.
        $catalog = $full ? [
            'Informatique' => [
                ['Ordinateur portable Dell Latitude', 180, 12, 'Dell'],
                ['Écran 27" LG UltraFine', 80, 20, 'LG'],
                ['Imprimante laser HP', 100, 6, 'HP'],
            ],
            'Audiovisuel' => [
                ['Vidéoprojecteur Epson EB-X05', 250, 5, 'Epson'],
                ['Sonorisation portable JBL', 350, 4, 'JBL'],
                ['Micro sans fil Shure', 120, 10, 'Shure'],
            ],
            'Événementiel' => [
                ['Tente pliante 3x3m', 400, 8, 'Générique'],
                ['Table buffet pliante', 60, 30, 'Générique'],
                ['Chaise pliante', 15, 200, 'Générique'],
            ],
            'Chantier' => [
                ['Perforateur Bosch', 220, 7, 'Bosch'],
                ['Échafaudage roulant', 450, 3, 'Générique'],
                ['Groupe électrogène 5kW', 600, 2, 'Générique'],
            ],
        ] : [
            'Événementiel' => [
                ['Sonorisation 2000W', 500, 3, 'JBL'],
                ['Podium modulaire', 300, 5, 'Générique'],
            ],
        ];

        foreach ($catalog as $categoryName => $equipments) {
            $category = Categorie::create(['proprietaire_id' => $ownerId, 'nom' => $categoryName]);
            foreach ($equipments as [$name, $price, $qty, $brandName]) {
                Materiel::create([
                    'proprietaire_id' => $ownerId,
                    'categorie_id' => $category->id,
                    'marque_id' => $brands[$brandName]->id,
                    'unite_id' => $jour->id,
                    'devise_id' => $mad->id,
                    'nom' => $name,
                    'prix_par_jour' => $price,
                    'quantite' => $qty,
                    'statut' => 'available',
                    'image' => $this->makeImage($ownerId, $name, $categoryName),
                ]);
            }
        }

        // Battements post-location (nettoyage / contrôle).
        Materiel::where('proprietaire_id', $ownerId)->where('nom', 'like', 'Vidéoprojecteur%')->update(['jours_tampon' => 1, 'note_tampon' => 'Nettoyage et test optique']);
        Materiel::where('proprietaire_id', $ownerId)->where('nom', 'like', 'Groupe électrogène%')->update(['jours_tampon' => 2, 'note_tampon' => 'Vidange et vérification moteur']);
        Materiel::where('proprietaire_id', $ownerId)->where('nom', 'like', 'Tente pliante%')->update(['jours_tampon' => 1, 'note_tampon' => 'Séchage et pliage']);

        if (! $full) {
            return;
        }

        // Employé + client appartenant à ce tenant.
        Utilisateur::create([
            'nom' => 'Employé Démo',
            'email' => 'employe@touslocations.com',
            'password' => Hash::make('1234567890'),
            'role' => 'employee',
            'proprietaire_id' => $ownerId,
            'statut' => 'active',
            'permissions' => ['materiels', 'locations', 'clients', 'rapports'],
        ]);
        $client = Utilisateur::create([
            'nom' => 'Client Démo',
            'email' => 'client@touslocations.com',
            'password' => Hash::make('1234567890'),
            'role' => 'client',
            'proprietaire_id' => $ownerId,
            'telephone' => '+212612345678',
            'statut' => 'active',
        ]);

        // Fournisseur + commande d'achat en attente (à réceptionner).
        $supplier = Fournisseur::create([
            'proprietaire_id' => $ownerId,
            'nom' => 'TechPro Distribution',
            'telephone' => '+212522334455',
            'email' => 'contact@techpro.ma',
            'adresse' => 'Casablanca',
        ]);
        $laptop = Materiel::where('proprietaire_id', $ownerId)->where('nom', 'like', 'Ordinateur%')->first();
        $purchase = Achat::create([
            'proprietaire_id' => $ownerId,
            'fournisseur_id' => $supplier->id,
            'utilisateur_id' => $ownerId,
            'reference' => 'BC-2026-001',
            'date_achat' => Carbon::parse('2026-06-05'),
            'statut' => 'pending',
            'montant_total' => 0,
        ]);
        $purchase->lignes()->create([
            'materiel_id' => $laptop->id,
            'quantite' => 5,
            'cout_unitaire' => 4500,
            'sous_total' => 22500,
        ]);
        $purchase->update(['montant_total' => 22500]);

        // Achat réceptionné (compte comme coût dans le rapport).
        $recv = Achat::create([
            'proprietaire_id' => $ownerId, 'fournisseur_id' => $supplier->id, 'utilisateur_id' => $ownerId,
            'reference' => 'BC-2026-002', 'date_achat' => Carbon::parse('2026-03-12'),
            'statut' => 'received', 'montant_total' => 9000,
        ]);
        $recv->lignes()->create(['materiel_id' => $laptop->id, 'quantite' => 2, 'cout_unitaire' => 4500, 'sous_total' => 9000]);

        // --- Données de démonstration pour les rapports ---
        $byName = fn ($like) => Materiel::where('proprietaire_id', $ownerId)->where('nom', 'like', $like)->first();

        // Ventes (avec TVA 20%)
        $sales = [
            ['2026-02-18', $byName('Chaise%'), 20, 45],
            ['2026-04-05', $byName('Table buffet%'), 6, 180],
            ['2026-05-22', $byName('Micro%'), 2, 900],
        ];
        foreach ($sales as $i => [$d, $eq, $qty, $price]) {
            if (! $eq) continue;
            $ht = $qty * $price;
            $tax = round($ht * 0.20, 2);
            $sale = Vente::create([
                'proprietaire_id' => $ownerId, 'client_id' => $client->id, 'utilisateur_id' => $ownerId,
                'reference' => 'VTE-2026-00'.($i + 1), 'date_vente' => Carbon::parse($d),
                'sous_total' => $ht, 'taux_taxe' => 20, 'montant_taxe' => $tax, 'montant_total' => $ht + $tax,
            ]);
            $sale->lignes()->create(['materiel_id' => $eq->id, 'quantite' => $qty, 'prix_unitaire' => $price, 'sous_total' => $ht]);
            $eq->decrement('quantite', $qty);
        }

        // Dépenses
        $expenses = [
            ['2026-01-05', 'Loyer', 'Loyer dépôt janvier', 4500],
            ['2026-02-05', 'Loyer', 'Loyer dépôt février', 4500],
            ['2026-03-05', 'Loyer', 'Loyer dépôt mars', 4500],
            ['2026-03-20', 'Électricité', 'Facture ONEE T1', 1200],
            ['2026-04-01', 'Salaires', 'Salaires équipe', 18000],
            ['2026-05-10', 'Carburant', 'Livraisons', 900],
        ];
        $cashType = TypePaiement::where('proprietaire_id', $ownerId)->value('id');
        foreach ($expenses as [$d, $cat, $label, $amount]) {
            Depense::create([
                'proprietaire_id' => $ownerId, 'utilisateur_id' => $ownerId, 'type_paiement_id' => $cashType,
                'categorie' => $cat, 'libelle' => $label, 'montant' => $amount, 'date_depense' => Carbon::parse($d),
            ]);
        }

        // Locations passées (variété de statuts + paiements)
        $past = [
            ['2026-02-01', '2026-02-05', 'returned', $byName('Vidéoprojecteur%'), 1, 'full'],
            ['2026-03-10', '2026-03-12', 'returned', $byName('Sonorisation%'), 1, 'full'],
            ['2026-05-15', '2026-05-18', 'ongoing', $byName('Tente pliante%'), 2, 'partial'],
            ['2026-06-02', '2026-06-04', 'pending', $byName('Perforateur%'), 1, 'none'],
        ];
        foreach ($past as [$s, $e, $st, $eq, $qty, $pay]) {
            if (! $eq) {
                continue;
            }
            $days = Carbon::parse($s)->diffInDays(Carbon::parse($e)) + 1;
            $ht = $eq->prix_par_jour * $qty * $days;
            $tax = round($ht * 0.20, 2);
            $ttc = $ht + $tax;
            $rent = Location::create([
                'proprietaire_id' => $ownerId, 'utilisateur_id' => $client->id, 'employe_id' => $ownerId,
                'date_debut' => Carbon::parse($s), 'date_fin' => Carbon::parse($e),
                'statut' => $st, 'sous_total' => $ht, 'taux_taxe' => 20, 'montant_taxe' => $tax, 'montant_total' => $ttc,
                'date_retour' => $st === 'returned' ? Carbon::parse($e) : null,
            ]);
            $rent->lignes()->create(['materiel_id' => $eq->id, 'quantite' => $qty, 'prix_unitaire' => $eq->prix_par_jour, 'sous_total' => $ht]);
            if ($pay !== 'none') {
                $rent->paiements()->create([
                    'utilisateur_id' => $ownerId, 'type_paiement_id' => $cashType,
                    'montant' => $pay === 'partial' ? round($ttc / 3, 2) : $ttc,
                    'date_paiement' => Carbon::parse($e), 'note' => $pay === 'partial' ? 'Acompte' : 'Réglé',
                ]);
            }
        }
    }

    // Génère une image SVG de démonstration (dégradé par catégorie + nom).
    private function makeImage(int $ownerId, string $name, string $category): string
    {
        $palette = [
            'Informatique' => ['#0071e3', '#42a5f5'],
            'Audiovisuel' => ['#7c3aed', '#a78bfa'],
            'Événementiel' => ['#ff9500', '#ffcc00'],
            'Chantier' => ['#ff3b30', '#ff9f0a'],
        ];
        [$c1, $c2] = $palette[$category] ?? ['#6e6e73', '#aeaeb2'];
        $icon = $this->toolIcon($name);
        $label = htmlspecialchars($name, ENT_QUOTES);
        // découpe le nom sur ~2 lignes
        $words = explode(' ', $label);
        $mid = (int) ceil(count($words) / 2);
        $line1 = implode(' ', array_slice($words, 0, $mid));
        $line2 = implode(' ', array_slice($words, $mid));

        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{$c1}"/><stop offset="1" stop-color="{$c2}"/>
    </linearGradient>
  </defs>
  <rect width="480" height="360" fill="url(#g)"/>
  <circle cx="410" cy="60" r="130" fill="rgba(255,255,255,0.10)"/>
  <circle cx="60" cy="320" r="80" fill="rgba(255,255,255,0.08)"/>
  <text x="40" y="44" font-family="Arial, sans-serif" font-size="14" letter-spacing="1" fill="rgba(255,255,255,0.85)">{$category}</text>
  <g transform="translate(174,70) scale(5.5)" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    {$icon}
  </g>
  <text x="40" y="318" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#fff">{$line1}</text>
  <text x="40" y="348" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#fff">{$line2}</text>
</svg>
SVG;

        $path = 'materiels/demo-'.$ownerId.'-'.Str::slug($name).'.svg';
        Storage::disk('public')->put($path, $svg);

        return $path;
    }

    // Icône vectorielle (style ligne, repère 24x24) correspondant au type de matériel.
    private function toolIcon(string $name): string
    {
        $n = Str::lower(Str::ascii($name));

        return match (true) {
            str_contains($n, 'ordinateur') || str_contains($n, 'portable') || str_contains($n, 'laptop')
                => '<rect x="3" y="5" width="18" height="11" rx="1.5"/><path d="M1.5 20h21l-2.2-3.5H3.7z"/>',
            str_contains($n, 'ecran') || str_contains($n, 'moniteur')
                => '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
            str_contains($n, 'imprimante')
                => '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><rect x="7" y="13" width="10" height="7" rx="1"/><path d="M16.8 12.5h.01"/>',
            str_contains($n, 'projecteur')
                => '<rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="9" cy="12" r="3.3"/><path d="M16 10h2M16 14h2M6 17v2M18 17v2"/>',
            str_contains($n, 'sonorisation') || str_contains($n, 'enceinte') || str_contains($n, 'haut-parleur')
                => '<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="15" r="4"/><circle cx="12" cy="6.5" r="1.7"/>',
            str_contains($n, 'micro')
                => '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8"/>',
            str_contains($n, 'tente')
                => '<path d="M12 4 2.5 20h19z"/><path d="M12 4v16M12 9l5 11M12 9 7 20"/>',
            str_contains($n, 'table')
                => '<path d="M3 7h18M5 7l-1 13M19 7l1 13M3 12h18"/>',
            str_contains($n, 'chaise')
                => '<path d="M8 3v9h8M8 12l-1 9M16 3v18M8 12h8M16 16h4"/>',
            str_contains($n, 'perforateur') || str_contains($n, 'perceuse') || str_contains($n, 'visseuse')
                => '<path d="M3 8h10v6H3z"/><path d="M13 9.5h4v3h-4zM17 11h4M6 14v3h4v-3M5 8V5h5v3"/>',
            str_contains($n, 'echafaudage') || str_contains($n, 'echelle')
                => '<path d="M6 2v20M18 2v20M6 7h12M6 12h12M6 17h12"/>',
            str_contains($n, 'electrogene') || str_contains($n, 'groupe') || str_contains($n, 'generateur')
                => '<rect x="3" y="8" width="18" height="10" rx="2"/><path d="M7 8V6h10v2M21 12h1M2 12h1M12 10.5l-2 3h4l-2 3"/>',
            str_contains($n, 'podium') || str_contains($n, 'scene') || str_contains($n, 'modulaire')
                => '<path d="M3 9l9-5 9 5-9 5z"/><path d="M3 9v6l9 5 9-5V9M12 14v6"/>',
            default
                => '<path d="M15 6a4 4 0 0 0-5.3 5.3L4 17l3 3 5.7-5.7A4 4 0 0 0 18 9l-2.8 2.8-2-2L16 6.8z"/>',
        };
    }
}
