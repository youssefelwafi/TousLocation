<?php

namespace App\Support;

use App\Models\Categorie;
use App\Models\Devise;
use App\Models\Marque;
use App\Models\Materiel;
use App\Models\Unite;
use App\Models\Utilisateur;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * Importe un catalogue de démonstration (JSON) en tant que boutique :
 * crée le gérant + employé + client, provisionne les référentiels, crée les
 * catégories et insère les matériels (avec images et descriptions).
 *
 * $config = [
 *   'email','store','telephone','brand','file',
 *   'employe_email','client_email','client_tel'
 * ]
 */
class CatalogImporter
{
    public static function import(array $config, bool $fresh = false, ?\Closure $onProgress = null): array
    {
        $path = database_path('data/'.$config['file']);
        if (! is_file($path)) {
            return ['status' => 'missing', 'count' => 0];
        }
        $products = json_decode(file_get_contents($path), true);
        if (! is_array($products) || ! count($products)) {
            return ['status' => 'empty', 'count' => 0];
        }

        $manager = Utilisateur::where('email', $config['email'])->first();
        if ($manager && ! $fresh) {
            return ['status' => 'exists', 'count' => $manager->materielsPossedes()->count(), 'manager' => $manager];
        }

        if (! $manager) {
            $manager = Utilisateur::create([
                'nom' => $config['store'],
                'email' => $config['email'],
                'password' => Hash::make('1234567890'),
                'role' => 'manager',
                'telephone' => $config['telephone'] ?? null,
                'statut' => 'active',
            ]);
            TenantProvisioner::provision($manager->id);
            // Catégories génériques retirées : la boutique aura ses propres catégories.
            Categorie::where('proprietaire_id', $manager->id)->delete();
            Marque::where('proprietaire_id', $manager->id)->delete();

            Utilisateur::create([
                'nom' => 'Employé '.$config['store'], 'email' => $config['employe_email'],
                'password' => Hash::make('1234567890'), 'role' => 'employee',
                'proprietaire_id' => $manager->id, 'statut' => 'active',
                'permissions' => Utilisateur::MODULES,
            ]);
            Utilisateur::create([
                'nom' => 'Client '.$config['store'], 'email' => $config['client_email'],
                'password' => Hash::make('1234567890'), 'role' => 'client',
                'proprietaire_id' => $manager->id, 'telephone' => $config['client_tel'] ?? null, 'statut' => 'active',
            ]);
        }

        $ownerId = $manager->id;
        if ($fresh) {
            Materiel::where('proprietaire_id', $ownerId)->delete();
            Categorie::where('proprietaire_id', $ownerId)->delete();
            Marque::where('proprietaire_id', $ownerId)->where('nom', $config['brand'])->delete();
        }

        $deviseId = Devise::where('proprietaire_id', $ownerId)->where('par_defaut', true)->value('id');
        $uniteId = Unite::where('proprietaire_id', $ownerId)->where('nom', 'Jour')->value('id');
        $marqueId = Marque::firstOrCreate(['proprietaire_id' => $ownerId, 'nom' => $config['brand']])->id;

        $catIds = [];
        foreach (array_unique(array_column($products, 'categorie')) as $catName) {
            $catIds[$catName] = Categorie::create(['proprietaire_id' => $ownerId, 'nom' => $catName])->id;
        }

        $now = Carbon::now();
        $rows = array_map(fn ($p) => [
            'proprietaire_id' => $ownerId,
            'categorie_id' => $catIds[$p['categorie']],
            'marque_id' => $marqueId,
            'unite_id' => $uniteId,
            'devise_id' => $deviseId,
            'nom' => $p['nom'],
            'description' => $p['description'] ?? null,
            'prix_par_jour' => $p['prix_par_jour'],
            'quantite' => $p['quantite'],
            'jours_tampon' => 0,
            'statut' => 'available',
            'image' => $p['image'] ?? null,
            'created_at' => $now,
            'updated_at' => $now,
        ], $products);

        $done = 0;
        foreach (array_chunk($rows, 200) as $chunk) {
            Materiel::insert($chunk);
            $done += count($chunk);
            if ($onProgress) {
                $onProgress($done, count($rows));
            }
        }

        return ['status' => $fresh ? 'reimported' : 'created', 'count' => count($rows), 'categories' => count($catIds), 'manager' => $manager];
    }
}
