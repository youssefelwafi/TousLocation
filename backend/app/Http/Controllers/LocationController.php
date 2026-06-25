<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\TenantScoped;
use App\Models\Materiel;
use App\Models\Location;
use App\Models\LigneLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LocationController extends Controller
{
    use TenantScoped;

    private const ACTIVE_STATUSES = ['pending', 'confirmed', 'ongoing'];

    public function index(Request $request): JsonResponse
    {
        $query = Location::with(['utilisateur', 'lignes.materiel', 'paiements.typePaiement'])->latest();

        if ($request->user()->isClient()) {
            // Un client ne voit que ses propres locations.
            $query->where('utilisateur_id', $request->user()->id);
        } else {
            // Manager : uniquement les locations de son tenant.
            $this->scopeToTenant($query, $request);
        }

        return response()->json($query->paginate(15));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'client_id' => ['nullable', 'exists:utilisateurs,id'],
            'date_debut' => ['required', 'date', 'after_or_equal:today'],
            'date_fin' => ['required', 'date', 'after_or_equal:date_debut'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.materiel_id' => ['required', 'exists:materiels,id'],
            'items.*.quantite' => ['required', 'integer', 'min:1'],
        ], [
            'date_debut.after_or_equal' => 'La date de début ne peut pas être dans le passé.',
        ]);

        // Tarification au jour calendaire : on ignore l'heure éventuelle (la colonne
        // ne stocke que la date), pour que le total corresponde à l'estimation client.
        $start = Carbon::parse($data['date_debut'])->startOfDay();
        $end = Carbon::parse($data['date_fin'])->startOfDay();
        $days = $start->diffInDays($end) + 1;

        // Les articles + la boutique cible.
        $materiels = Materiel::whereIn('id', collect($data['items'])->pluck('materiel_id'))->get()->keyBy('id');

        if ($request->user()->isStaff()) {
            // Staff : location dans SA boutique uniquement.
            $ownerId = $this->ownerId($request);
            foreach ($materiels as $m) {
                $this->ensureOwned($request, $m);
            }
            $clientId = ! empty($data['client_id']) ? $data['client_id'] : $request->user()->id;
        } else {
            // Client (place de marché) : commande rattachée à la boutique du produit.
            $owners = $materiels->pluck('proprietaire_id')->unique();
            abort_if($owners->count() !== 1, 422, 'Une commande ne peut concerner qu\'une seule boutique à la fois.');
            $ownerId = (int) $owners->first();
            $clientId = $request->user()->id;
        }

        $employeId = $request->user()->isStaff() ? $request->user()->id : null;
        $taxRate = \App\Models\Taxe::defaultRateFor($ownerId); // TVA par défaut de la boutique cible

        $location = DB::transaction(function () use ($data, $days, $start, $end, $clientId, $ownerId, $employeId, $materiels, $taxRate) {
            $location = Location::create([
                'proprietaire_id' => $ownerId,
                'utilisateur_id' => $clientId,
                'employe_id' => $employeId,
                'date_debut' => $data['date_debut'],
                'date_fin' => $data['date_fin'],
                'statut' => 'pending',
                'sous_total' => 0,
                'taux_taxe' => $taxRate,
                'montant_taxe' => 0,
                'montant_total' => 0,
            ]);

            $subtotal = 0; // HT
            foreach ($data['items'] as $item) {
                $materiel = $materiels[$item['materiel_id']] ?? Materiel::findOrFail($item['materiel_id']);

                // Disponibilité sur la période (réservations concurrentes + battement).
                $available = $this->availableQuantity($materiel, $start, $end);
                if ($available < $item['quantite']) {
                    abort(422, "Disponibilité insuffisante pour « {$materiel->nom} » sur cette période (dispo : {$available}).");
                }

                $lineTotal = $materiel->prix_par_jour * $item['quantite'] * $days;
                $subtotal += $lineTotal;

                $location->lignes()->create([
                    'materiel_id' => $materiel->id,
                    'quantite' => $item['quantite'],
                    'prix_unitaire' => $materiel->prix_par_jour, // prix/jour figé
                    'sous_total' => $lineTotal,
                ]);
            }

            $tax = round($subtotal * $taxRate / 100, 2);
            $location->update([
                'sous_total' => $subtotal,
                'montant_taxe' => $tax,
                'montant_total' => $subtotal + $tax, // TTC
            ]);

            return $location;
        });

        return response()->json($location->load(['utilisateur', 'lignes.materiel', 'paiements']), 201);
    }

    public function show(Request $request, Location $location): JsonResponse
    {
        $this->authorizeView($request, $location);

        return response()->json($location->load(['utilisateur', 'employe', 'lignes.materiel', 'contrat', 'paiements.utilisateur', 'paiements.typePaiement']));
    }

    public function confirm(Request $request, Location $location): JsonResponse
    {
        $this->requireModule($request, 'locations');
        $this->ensureOwned($request, $location);
        $location->update(['statut' => 'ongoing', 'employe_id' => $request->user()->id]);

        return response()->json($location->fresh()->load('lignes.materiel'));
    }

    public function return(Request $request, Location $location): JsonResponse
    {
        $this->requireModule($request, 'locations');
        $this->ensureOwned($request, $location);
        $location->update(['statut' => 'returned', 'date_retour' => now()]);

        return response()->json($location->fresh());
    }

    public function cancel(Request $request, Location $location): JsonResponse
    {
        $this->authorizeView($request, $location);
        abort_if(in_array($location->statut, ['returned', 'cancelled'], true), 422, 'Location non annulable.');
        $location->update(['statut' => 'cancelled']);

        return response()->json($location->fresh());
    }

    // Quantité disponible d'un article sur une période, en tenant compte des
    // réservations concurrentes et du battement post-location (jours_tampon).
    private function availableQuantity(Materiel $materiel, Carbon $start, Carbon $end, ?int $excludeRentalId = null): int
    {
        $items = LigneLocation::where('materiel_id', $materiel->id)
            ->whereHas('location', function ($q) use ($excludeRentalId) {
                $q->whereIn('statut', self::ACTIVE_STATUSES);
                if ($excludeRentalId) {
                    $q->where('id', '!=', $excludeRentalId);
                }
            })
            ->with('location:id,date_debut,date_fin')
            ->get();

        // Réservation max concurrente sur chaque jour de la période demandée.
        $maxReserved = 0;
        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $reserved = 0;
            foreach ($items as $it) {
                $rs = Carbon::parse($it->location->date_debut);
                $re = Carbon::parse($it->location->date_fin)->addDays($materiel->jours_tampon);
                if ($d->betweenIncluded($rs, $re)) {
                    $reserved += $it->quantite;
                }
            }
            $maxReserved = max($maxReserved, $reserved);
        }

        return max(0, $materiel->quantite - $maxReserved);
    }

    private function authorizeView(Request $request, Location $location): void
    {
        abort_unless(
            $request->user()->isStaff() || $request->user()->id === $location->utilisateur_id,
            403,
            'Accès refusé.'
        );
        // Le staff non super-admin reste limité à son tenant.
        if ($request->user()->isStaff()) {
            $this->ensureOwned($request, $location);
        }
    }
}
