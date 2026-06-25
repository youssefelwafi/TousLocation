<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['proprietaire_id', 'client_id', 'utilisateur_id', 'reference', 'date_vente', 'sous_total', 'taux_taxe', 'montant_taxe', 'montant_total', 'note'])]
class Vente extends Model
{
    protected $table = 'ventes';

    protected $appends = ['montant_paye', 'montant_restant', 'statut_paiement'];

    protected function casts(): array
    {
        return [
            'date_vente' => 'date',
            'sous_total' => 'decimal:2',
            'taux_taxe' => 'decimal:2',
            'montant_taxe' => 'decimal:2',
            'montant_total' => 'decimal:2',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'client_id');
    }

    public function lignes(): HasMany
    {
        return $this->hasMany(LigneVente::class);
    }

    public function paiements(): HasMany
    {
        return $this->hasMany(PaiementVente::class);
    }

    protected function montantPaye(): Attribute
    {
        return Attribute::get(fn () => (float) $this->paiements()->sum('montant'));
    }

    protected function montantRestant(): Attribute
    {
        return Attribute::get(fn () => max(0, (float) $this->montant_total - $this->montant_paye));
    }

    // unpaid | partial | paid (encaissement client)
    protected function statutPaiement(): Attribute
    {
        return Attribute::get(function () {
            $paid = $this->montant_paye;
            if ($paid <= 0) {
                return 'unpaid';
            }

            return $paid >= (float) $this->montant_total ? 'paid' : 'partial';
        });
    }
}
