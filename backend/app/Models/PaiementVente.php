<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['vente_id', 'type_paiement_id', 'utilisateur_id', 'montant', 'date_paiement', 'note'])]
class PaiementVente extends Model
{
    protected $table = 'paiements_vente';

    protected function casts(): array
    {
        return ['montant' => 'decimal:2', 'date_paiement' => 'date'];
    }

    public function vente(): BelongsTo
    {
        return $this->belongsTo(Vente::class);
    }

    public function typePaiement(): BelongsTo
    {
        return $this->belongsTo(TypePaiement::class);
    }
}
