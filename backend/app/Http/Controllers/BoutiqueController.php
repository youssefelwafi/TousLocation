<?php

namespace App\Http\Controllers;

use App\Models\Materiel;
use App\Models\Utilisateur;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

// Boutiques publiques (SaaS multi-boutiques) — accès sans authentification.
class BoutiqueController extends Controller
{
    // Liste des boutiques (managers actifs ayant du matériel).
    public function index(): JsonResponse
    {
        $shops = Utilisateur::where('role', 'manager')->where('statut', 'active')
            ->withCount(['materielsPossedes as products_count'])
            ->orderBy('nom')
            ->get(['id', 'nom'])
            ->filter(fn ($m) => $m->products_count > 0)
            ->values()
            ->map(fn ($m) => ['id' => $m->id, 'name' => $m->nom, 'products_count' => $m->products_count]);

        return response()->json($shops);
    }

    // Catalogue global (toutes boutiques) — paginé, avec recherche et filtre boutique.
    // Permet à un client connecté de parcourir et commander dans n'importe quelle boutique.
    public function catalogue(Request $request): JsonResponse
    {
        $query = Materiel::query()
            ->where('statut', 'available')
            ->where('quantite', '>', 0)
            ->whereHas('proprietaire', fn ($q) => $q->where('role', 'manager')->where('statut', 'active'))
            ->with(['categorie', 'marque', 'unite', 'devise', 'proprietaire:id,nom']);

        if ($search = trim((string) $request->query('search'))) {
            $query->where(function ($q) use ($search) {
                $q->where('nom', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('marque', fn ($m) => $m->where('nom', 'like', "%{$search}%"))
                  ->orWhereHas('categorie', fn ($c) => $c->where('nom', 'like', "%{$search}%"));
            });
        }
        if ($boutiqueId = $request->query('boutique')) {
            $query->where('proprietaire_id', $boutiqueId);
        }

        return response()->json($query->latest()->paginate(24));
    }

    // Détail d'une boutique + ses produits disponibles.
    public function show(Utilisateur $boutique): JsonResponse
    {
        abort_unless($boutique->role === 'manager', 404);

        $products = Materiel::where('proprietaire_id', $boutique->id)
            ->where('statut', 'available')
            ->with(['categorie', 'marque', 'unite', 'devise'])
            ->latest()
            ->get();

        return response()->json([
            'shop' => ['id' => $boutique->id, 'name' => $boutique->nom],
            'products' => $products,
        ]);
    }
}
