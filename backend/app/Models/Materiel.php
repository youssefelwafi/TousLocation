<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['proprietaire_id', 'categorie_id', 'marque_id', 'unite_id', 'devise_id', 'nom', 'description', 'prix_par_jour', 'quantite', 'jours_tampon', 'note_tampon', 'statut', 'image'])]
class Materiel extends Model
{
    protected $table = 'materiels';

    protected $appends = ['url_image'];

    protected function casts(): array
    {
        return [
            'prix_par_jour' => 'decimal:2',
            'quantite' => 'integer',
            'jours_tampon' => 'integer',
        ];
    }

    // Boutique (gérant / tenant) propriétaire du matériel.
    public function proprietaire(): BelongsTo
    {
        return $this->belongsTo(Utilisateur::class, 'proprietaire_id');
    }

    public function categorie(): BelongsTo
    {
        return $this->belongsTo(Categorie::class);
    }

    public function marque(): BelongsTo
    {
        return $this->belongsTo(Marque::class);
    }

    public function unite(): BelongsTo
    {
        return $this->belongsTo(Unite::class);
    }

    public function devise(): BelongsTo
    {
        return $this->belongsTo(Devise::class);
    }

    // URL de l'image : URL absolue conservée telle quelle (catalogue importé),
    // sinon chemin relatif /storage (préfixé côté frontend par l'origine de l'API).
    protected function urlImage(): Attribute
    {
        return Attribute::get(function () {
            if (! $this->image) {
                return null;
            }

            return str_starts_with($this->image, 'http://') || str_starts_with($this->image, 'https://')
                ? $this->image
                : '/storage/'.$this->image;
        });
    }
}
