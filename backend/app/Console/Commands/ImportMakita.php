<?php

namespace App\Console\Commands;

use App\Support\CatalogImporter;
use Illuminate\Console\Command;

// Boutique de démonstration « Outillage Maroc » (catalogue Makita).
class ImportMakita extends Command
{
    protected $signature = 'demo:makita {--fresh : Réimporte le catalogue (supprime les matériels existants de la boutique)}';

    protected $description = 'Importe le catalogue Makita (Outillage Maroc) comme boutique de démonstration';

    public function handle(): int
    {
        $bar = null;
        $res = CatalogImporter::import([
            'email' => 'gerant@outillagemaroc.ma',
            'store' => 'Outillage Maroc',
            'telephone' => '+212522000000',
            'brand' => 'Makita',
            'file' => 'makita-products.json',
            'employe_email' => 'employe@outillagemaroc.ma',
            'client_email' => 'client@outillagemaroc.ma',
            'client_tel' => '+212661000000',
        ], (bool) $this->option('fresh'), function ($done, $total) use (&$bar) {
            if (! $bar) { $bar = $this->output->createProgressBar($total); $bar->start(); }
            $bar->setProgress($done);
        });
        if ($bar) { $bar->finish(); $this->newLine(2); }

        return $this->report($res, 'Outillage Maroc', 'gerant@outillagemaroc.ma');
    }

    private function report(array $res, string $store, string $email): int
    {
        return match ($res['status']) {
            'missing' => tap(self::FAILURE, fn () => $this->error('Fichier catalogue introuvable.')),
            'empty' => tap(self::FAILURE, fn () => $this->error('Catalogue vide.')),
            'exists' => tap(self::SUCCESS, fn () => $this->warn("La boutique « {$store} » existe déjà ({$res['count']} matériels). Utilisez --fresh pour réimporter.")),
            default => tap(self::SUCCESS, function () use ($res, $store, $email) {
                $this->info("✓ Boutique « {$store} » importée : {$res['count']} matériels.");
                $this->line("  Connexion gérant : <info>{$email}</info> / <info>1234567890</info>");
            }),
        };
    }
}
