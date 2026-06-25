<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\TenantScoped;
use App\Models\Devise;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class DeviseController extends Controller
{
    use TenantScoped;

    public function index(Request $request): JsonResponse
    {
        $query = Devise::withCount('materiels')->orderByDesc('par_defaut')->orderBy('code');
        $rows = $this->dedupeForSuperAdmin($request, $this->scopeToTenant($query, $request)->get(), 'code');

        return response()->json($this->capSingleDefaultForSuperAdmin($request, $rows));
    }

    public function store(Request $request): JsonResponse
    {
        $this->requireModule($request, "parametres");

        $data = $request->validate([
            'nom' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'size:3'],
            'symbole' => ['required', 'string', 'max:8'],
            'taux_change' => ['required', 'numeric', 'min:0'],
            'par_defaut' => ['boolean'],
        ]);

        $data['code'] = strtoupper($data['code']);
        $data['proprietaire_id'] = $this->ownerId($request);

        $devise = DB::transaction(function () use ($data) {
            $devise = Devise::create($data);
            $this->syncDefault($devise, $data['par_defaut'] ?? false);

            return $devise;
        });

        return response()->json($devise->fresh(), 201);
    }

    public function update(Request $request, Devise $devise): JsonResponse
    {
        $this->requireModule($request, "parametres");
        $this->ensureOwned($request, $devise);

        $data = $request->validate([
            'nom' => ['sometimes', 'string', 'max:255'],
            'code' => ['sometimes', 'string', 'size:3'],
            'symbole' => ['sometimes', 'string', 'max:8'],
            'taux_change' => ['sometimes', 'numeric', 'min:0'],
            'par_defaut' => ['boolean'],
        ]);

        if (isset($data['code'])) {
            $data['code'] = strtoupper($data['code']);
        }

        DB::transaction(function () use ($devise, $data) {
            $devise->update($data);
            if (array_key_exists('par_defaut', $data)) {
                $this->syncDefault($devise, $data['par_defaut']);
            }
        });

        return response()->json($devise->fresh());
    }

    public function destroy(Request $request, Devise $devise): JsonResponse
    {
        $this->requireModule($request, "parametres");
        $this->ensureOwned($request, $devise);
        abort_if($devise->par_defaut, 422, 'Impossible de supprimer la devise par défaut.');
        abort_if($devise->materiels()->exists(), 422, 'Devise utilisée par du matériel : suppression impossible.');

        $devise->delete();

        return response()->json(['message' => 'Devise supprimée']);
    }

    // Une seule devise par défaut PAR TENANT.
    private function syncDefault(Devise $devise, bool $isDefault): void
    {
        if ($isDefault) {
            Devise::where('id', '!=', $devise->id)
                ->where('proprietaire_id', $devise->proprietaire_id)
                ->update(['par_defaut' => false]);
            $devise->update(['par_defaut' => true]);
        }
    }
}
