<?php

namespace App\Console\Commands;

use App\Support\CatalogImporter;
use Illuminate\Console\Command;

// Boutique de démonstration « Transpalette Maroc » (équipements de manutention).
class ImportTranspalette extends Command
{
    protected $signature = 'demo:transpalette {--fresh : Réimporte le catalogue (supprime les matériels existants de la boutique)}';

    protected $description = 'Importe le catalogue Transpalette Maroc comme boutique de démonstration';

    public function handle(): int
    {
        $bar = null;
        $res = CatalogImporter::import([
            'email' => 'gerant@transpalette-maroc.com',
            'store' => 'Transpalette Maroc',
            'telephone' => '+212661258941',
            'brand' => 'Manutention',
            'file' => 'transpalette-products.json',
            'employe_email' => 'employe@transpalette-maroc.com',
            'client_email' => 'client@transpalette-maroc.com',
            'client_tel' => '+212661000001',
        ], (bool) $this->option('fresh'), function ($done, $total) use (&$bar) {
            if (! $bar) { $bar = $this->output->createProgressBar($total); $bar->start(); }
            $bar->setProgress($done);
        });
        if ($bar) { $bar->finish(); $this->newLine(2); }

        return match ($res['status']) {
            'missing' => tap(self::FAILURE, fn () => $this->error('Fichier catalogue introuvable (database/data/transpalette-products.json).')),
            'empty' => tap(self::FAILURE, fn () => $this->error('Catalogue vide.')),
            'exists' => tap(self::SUCCESS, fn () => $this->warn("La boutique « Transpalette Maroc » existe déjà ({$res['count']} matériels). Utilisez --fresh pour réimporter.")),
            default => tap(self::SUCCESS, function () use ($res) {
                $this->info("✓ Boutique « Transpalette Maroc » importée : {$res['count']} matériels.");
                $this->line('  Connexion gérant : <info>gerant@transpalette-maroc.com</info> / <info>1234567890</info>');
            }),
        };
    }
}
