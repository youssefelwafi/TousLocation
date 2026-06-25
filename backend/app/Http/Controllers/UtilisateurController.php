<?php

namespace App\Http\Controllers;

use App\Models\Utilisateur;
use App\Support\TenantProvisioner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

// Gestion des comptes "manager" (réservée au super-admin).
class UtilisateurController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $query = Utilisateur::where('role', 'manager')
            ->withCount(['locations as rentals_count'])
            ->latest();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('nom', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate(15));
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $data = $request->validate([
            'nom' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:utilisateurs,email'],
            'telephone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:6'],
            'statut' => ['nullable', 'in:active,inactive'],
        ]);

        $data['role'] = 'manager';
        $data['proprietaire_id'] = null; // un manager est un tenant racine
        $data['password'] = Hash::make($data['password']);
        $data['statut'] ??= 'active';

        $manager = DB::transaction(function () use ($data) {
            $manager = Utilisateur::create($data);
            // Référentiels par défaut (devises, TVA, unités, types de paiement…)
            // pour que la nouvelle boutique soit immédiatement utilisable.
            TenantProvisioner::provision($manager->id);

            return $manager;
        });

        return response()->json($manager, 201);
    }

    public function update(Request $request, Utilisateur $utilisateur): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);
        abort_unless($utilisateur->role === 'manager', 404);

        $data = $request->validate([
            'nom' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', Rule::unique('utilisateurs', 'email')->ignore($utilisateur->id)],
            'telephone' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'string', 'min:6'],
            'statut' => ['sometimes', 'in:active,inactive'],
        ]);

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        $utilisateur->update($data);

        return response()->json($utilisateur->fresh());
    }

    public function destroy(Request $request, Utilisateur $utilisateur): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);
        abort_unless($utilisateur->role === 'manager', 404);

        $utilisateur->delete();

        return response()->json(['message' => 'Manager supprimé']);
    }
}
