<?php

namespace App\Console\Commands;

use App\Models\Categorie;
use App\Models\Devise;
use App\Models\Marque;
use App\Models\Materiel;
use App\Models\Unite;
use App\Models\Utilisateur;
use App\Support\TenantProvisioner;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

// Crée la boutique de démonstration « Outillage Maroc » (catalogue Makita)
// à partir de database/data/makita-products.json (noms, images, descriptions).
class ImportMakita extends Command
{
    protected $signature = 'demo:makita {--fresh : Réimporte le catalogue (supprime les matériels existants de la boutique)}';

    protected $description = 'Importe le catalogue Makita (Outillage Maroc) comme boutique de démonstration';

    public function handle(): int
    {
        $file = database_path('data/makita-products.json');
        if (! is_file($file)) {
            $this->error("Fichier introuvable : {$file}");

            return self::FAILURE;
        }
        $products = json_decode(file_get_contents($file), true);
        if (! is_array($products) || ! count($products)) {
            $this->error('Catalogue vide ou JSON invalide.');

            return self::FAILURE;
        }

        $email = 'gerant@outillagemaroc.ma';
        $manager = Utilisateur::where('email', $email)->first();

        if ($manager && ! $this->option('fresh')) {
            $this->warn("La boutique « Outillage Maroc » existe déjà ({$manager->materielsPossedes()->count()} matériels).");
            $this->line('Utilisez <info>php artisan demo:makita --fresh</info> pour réimporter.');

            return self::SUCCESS;
        }

        if (! $manager) {
            $this->info('Création de la boutique « Outillage Maroc »…');
            $manager = Utilisateur::create([
                'nom' => 'Outillage Maroc',
                'email' => $email,
                'password' => Hash::make('1234567890'),
                'role' => 'manager',
                'telephone' => '+212522000000',
                'statut' => 'active',
            ]);
            TenantProvisioner::provision($manager->id);
            // On retire les catégories génériques : la boutique aura ses propres catégories Makita.
            Categorie::where('proprietaire_id', $manager->id)->delete();

            // Employé + client rattachés à la boutique (mot de passe : 1234567890).
            Utilisateur::create([
                'nom' => 'Employé Outillage Maroc', 'email' => 'employe@outillagemaroc.ma',
                'password' => Hash::make('1234567890'), 'role' => 'employee',
                'proprietaire_id' => $manager->id, 'statut' => 'active',
                'permissions' => Utilisateur::MODULES,
            ]);
            Utilisateur::create([
                'nom' => 'Client Outillage Maroc', 'email' => 'client@outillagemaroc.ma',
                'password' => Hash::make('1234567890'), 'role' => 'client',
                'proprietaire_id' => $manager->id, 'telephone' => '+212661000000', 'statut' => 'active',
            ]);
        }

        $ownerId = $manager->id;

        if ($this->option('fresh')) {
            $this->info('Réinitialisation du catalogue de la boutique…');
            Materiel::where('proprietaire_id', $ownerId)->delete();
            Categorie::where('proprietaire_id', $ownerId)->delete();
            Marque::where('proprietaire_id', $ownerId)->where('nom', 'Makita')->delete();
        }

        // Référentiels.
        $deviseId = Devise::where('proprietaire_id', $ownerId)->where('par_defaut', true)->value('id');
        $uniteId = Unite::where('proprietaire_id', $ownerId)->where('nom', 'Jour')->value('id');
        $makitaId = Marque::firstOrCreate(['proprietaire_id' => $ownerId, 'nom' => 'Makita'])->id;

        // Catégories (créées à la volée).
        $catIds = [];
        foreach (array_unique(array_column($products, 'categorie')) as $catName) {
            $catIds[$catName] = Categorie::create(['proprietaire_id' => $ownerId, 'nom' => $catName])->id;
        }
        $this->info(count($catIds).' catégories créées.');

        // Insertion en masse des matériels.
        $now = Carbon::now();
        $rows = array_map(fn ($p) => [
            'proprietaire_id' => $ownerId,
            'categorie_id' => $catIds[$p['categorie']],
            'marque_id' => $makitaId,
            'unite_id' => $uniteId,
            'devise_id' => $deviseId,
            'nom' => $p['nom'],
            'description' => $p['description'],
            'prix_par_jour' => $p['prix_par_jour'],
            'quantite' => $p['quantite'],
            'jours_tampon' => 0,
            'statut' => 'available',
            'image' => $p['image'],
            'created_at' => $now,
            'updated_at' => $now,
        ], $products);

        $bar = $this->output->createProgressBar(count($rows));
        $bar->start();
        foreach (array_chunk($rows, 200) as $chunk) {
            Materiel::insert($chunk);
            $bar->advance(count($chunk));
        }
        $bar->finish();
        $this->newLine(2);

        $this->info('✓ Boutique « Outillage Maroc » importée : '.count($rows).' matériels Makita.');
        $this->line('  Connexion gérant : <info>gerant@outillagemaroc.ma</info> / <info>1234567890</info>');
        $this->line('  Boutique publique visible dans /boutiques.');

        return self::SUCCESS;
    }
}
