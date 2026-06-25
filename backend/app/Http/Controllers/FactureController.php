<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\TenantScoped;
use App\Models\Location;
use App\Models\Vente;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class FactureController extends Controller
{
    use TenantScoped;

    public function download(Request $request, Location $location): Response
    {
        // Staff, ou le client propriétaire de la location.
        abort_unless(
            $request->user()->isStaff() || $request->user()->id === $location->utilisateur_id,
            403
        );

        $location->load(['utilisateur', 'employe', 'lignes.materiel.devise', 'paiements.typePaiement']);

        // Devise par défaut pour l'affichage des montants.
        $symbole = \App\Models\Devise::where('par_defaut', true)->value('symbole') ?? 'DH';

        $pdf = Pdf::loadView('facture', [
            'location' => $location,
            'symbole' => $symbole,
            'numero' => 'FACT-'.str_pad((string) $location->id, 5, '0', STR_PAD_LEFT),
        ])->setPaper('a4');

        return $pdf->download("facture-{$location->id}.pdf");
    }

    // Reçu PDF d'une vente.
    public function vente(Request $request, Vente $vente): Response
    {
        abort_unless($request->user()->isStaff() || $request->user()->id === $vente->client_id, 403);
        if ($request->user()->isStaff()) {
            $this->ensureOwned($request, $vente);
        }

        $vente->load(['client', 'lignes.materiel', 'paiements.typePaiement']);
        $symbole = \App\Models\Devise::where('par_defaut', true)->value('symbole') ?? 'DH';

        $pdf = Pdf::loadView('recu-vente', [
            'vente' => $vente,
            'symbole' => $symbole,
            'numero' => $vente->reference ?: 'VTE-'.str_pad((string) $vente->id, 5, '0', STR_PAD_LEFT),
        ])->setPaper('a4');

        return $pdf->download("recu-vente-{$vente->id}.pdf");
    }
}
