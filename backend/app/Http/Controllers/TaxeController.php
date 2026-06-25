<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\TenantScoped;
use App\Models\Taxe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TaxeController extends Controller
{
    use TenantScoped;

    public function index(Request $request): JsonResponse
    {
        $query = Taxe::orderByDesc('par_defaut')->orderBy('taux');
        $rows = $this->dedupeForSuperAdmin($request, $this->scopeToTenant($query, $request)->get(), 'nom');

        return response()->json($this->capSingleDefaultForSuperAdmin($request, $rows));
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireModule($request, "parametres");

        $data = $request->validate([
            'nom' => ['required', 'string', 'max:255'],
            'taux' => ['required', 'numeric', 'min:0', 'max:100'],
            'par_defaut' => ['boolean'],
        ]);
        $data['proprietaire_id'] = $this->ownerId($request);

        $taxe = DB::transaction(function () use ($data) {
            $taxe = Taxe::create($data);
            $this->syncDefault($taxe, $data['par_defaut'] ?? false);

            return $taxe;
        });

        return response()->json($taxe->fresh(), 201);
    }

    public function update(Request $request, Taxe $taxe): JsonResponse
    {
        $this->requireModule($request, "parametres");
        $this->ensureOwned($request, $taxe);

        $data = $request->validate([
            'nom' => ['sometimes', 'string', 'max:255'],
            'taux' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'par_defaut' => ['boolean'],
        ]);

        DB::transaction(function () use ($taxe, $data) {
            $taxe->update($data);
            if (array_key_exists('par_defaut', $data)) {
                $this->syncDefault($taxe, $data['par_defaut']);
            }
        });

        return response()->json($taxe->fresh());
    }

    public function destroy(Request $request, Taxe $taxe): JsonResponse
    {
        $this->requireModule($request, "parametres");
        $this->ensureOwned($request, $taxe);
        abort_if($taxe->par_defaut, 422, 'Impossible de supprimer la TVA par défaut.');

        $taxe->delete();

        return response()->json(['message' => 'Taux de TVA supprimé']);
    }

    // Un seul taux par défaut par tenant.
    private function syncDefault(Taxe $taxe, bool $isDefault): void
    {
        if ($isDefault) {
            Taxe::where('id', '!=', $taxe->id)->where('proprietaire_id', $taxe->proprietaire_id)->update(['par_defaut' => false]);
            $taxe->update(['par_defaut' => true]);
        }
    }
}
