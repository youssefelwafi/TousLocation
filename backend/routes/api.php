<?php

use App\Http\Controllers\AchatController;
use App\Http\Controllers\AjustementController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BoutiqueController;
use App\Http\Controllers\CategorieController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\DeviseController;
use App\Http\Controllers\DepenseController;
use App\Http\Controllers\EmployeController;
use App\Http\Controllers\FactureController;
use App\Http\Controllers\FournisseurController;
use App\Http\Controllers\MarqueController;
use App\Http\Controllers\MaterielController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\PaiementController;
use App\Http\Controllers\RapportController;
use App\Http\Controllers\TableauBordController;
use App\Http\Controllers\TaxeController;
use App\Http\Controllers\TypePaiementController;
use App\Http\Controllers\UniteController;
use App\Http\Controllers\UtilisateurController;
use App\Http\Controllers\VenteController;
use Illuminate\Support\Facades\Route;

// --- Public ---
// NB : les gérants (managers) sont créés UNIQUEMENT par le super-admin (cf. /utilisateurs).
// Seuls les clients peuvent s'inscrire publiquement (rattachés à une boutique).
Route::post('/inscription-client', [AuthController::class, 'registerClient']);
Route::post('/connexion', [AuthController::class, 'login']);
// Boutiques publiques
Route::get('/boutiques', [BoutiqueController::class, 'index']);
Route::get('/boutiques/{boutique}', [BoutiqueController::class, 'show']);

// --- Authentifié ---
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/deconnexion', [AuthController::class, 'logout']);
    Route::get('/profil', [AuthController::class, 'me']);

    // Gérants (super-admin)
    Route::get('/utilisateurs', [UtilisateurController::class, 'index']);
    Route::post('/utilisateurs', [UtilisateurController::class, 'store']);
    Route::put('/utilisateurs/{utilisateur}', [UtilisateurController::class, 'update']);
    Route::delete('/utilisateurs/{utilisateur}', [UtilisateurController::class, 'destroy']);

    // Employés (gérant) + modules disponibles
    Route::get('/modules', fn () => response()->json(\App\Models\Utilisateur::MODULES));
    Route::get('/employes', [EmployeController::class, 'index']);
    Route::post('/employes', [EmployeController::class, 'store']);
    Route::put('/employes/{employe}', [EmployeController::class, 'update']);
    Route::delete('/employes/{employe}', [EmployeController::class, 'destroy']);

    // Clients
    Route::get('/clients', [ClientController::class, 'index']);
    Route::post('/clients', [ClientController::class, 'store']);
    Route::get('/clients/{client}', [ClientController::class, 'show']);
    Route::put('/clients/{client}', [ClientController::class, 'update']);
    Route::delete('/clients/{client}', [ClientController::class, 'destroy']);

    // Catégories
    Route::get('/categories', [CategorieController::class, 'index']);
    Route::post('/categories', [CategorieController::class, 'store']);
    Route::put('/categories/{categorie}', [CategorieController::class, 'update']);
    Route::delete('/categories/{categorie}', [CategorieController::class, 'destroy']);

    // Marques
    Route::get('/marques', [MarqueController::class, 'index']);
    Route::post('/marques', [MarqueController::class, 'store']);
    Route::put('/marques/{marque}', [MarqueController::class, 'update']);
    Route::delete('/marques/{marque}', [MarqueController::class, 'destroy']);

    // Fournisseurs
    Route::get('/fournisseurs', [FournisseurController::class, 'index']);
    Route::post('/fournisseurs', [FournisseurController::class, 'store']);
    Route::put('/fournisseurs/{fournisseur}', [FournisseurController::class, 'update']);
    Route::delete('/fournisseurs/{fournisseur}', [FournisseurController::class, 'destroy']);

    // Achats (alimentent l'inventaire)
    Route::get('/achats', [AchatController::class, 'index']);
    Route::post('/achats', [AchatController::class, 'store']);
    Route::get('/achats/{achat}', [AchatController::class, 'show']);
    Route::put('/achats/{achat}', [AchatController::class, 'update']);
    Route::put('/achats/{achat}/receptionner', [AchatController::class, 'receive']);
    Route::delete('/achats/{achat}', [AchatController::class, 'destroy']);
    // Paiements fournisseur (partiels)
    Route::get('/achats/{achat}/paiements', [AchatController::class, 'payments']);
    Route::post('/achats/{achat}/paiements', [AchatController::class, 'storePayment']);
    Route::delete('/paiements-achat/{paiement}', [AchatController::class, 'destroyPayment']);

    // Ventes (retirent du stock)
    Route::get('/ventes', [VenteController::class, 'index']);
    Route::post('/ventes', [VenteController::class, 'store']);
    Route::get('/ventes/{vente}', [VenteController::class, 'show']);
    Route::delete('/ventes/{vente}', [VenteController::class, 'destroy']);
    Route::get('/ventes/{vente}/recu', [FactureController::class, 'vente']);
    // Encaissements (paiements partiels)
    Route::get('/ventes/{vente}/paiements', [VenteController::class, 'payments']);
    Route::post('/ventes/{vente}/paiements', [VenteController::class, 'storePayment']);
    Route::delete('/paiements-vente/{paiement}', [VenteController::class, 'destroyPayment']);

    // Dépenses
    Route::get('/depenses', [DepenseController::class, 'index']);
    Route::post('/depenses', [DepenseController::class, 'store']);
    Route::put('/depenses/{depense}', [DepenseController::class, 'update']);
    Route::delete('/depenses/{depense}', [DepenseController::class, 'destroy']);

    // Ajustements d'inventaire
    Route::get('/ajustements', [AjustementController::class, 'index']);
    Route::post('/ajustements', [AjustementController::class, 'store']);

    // TVA / Taxes
    Route::get('/taxes', [TaxeController::class, 'index']);
    Route::post('/taxes', [TaxeController::class, 'store']);
    Route::put('/taxes/{taxe}', [TaxeController::class, 'update']);
    Route::delete('/taxes/{taxe}', [TaxeController::class, 'destroy']);

    // Types de paiement
    Route::get('/types-paiement', [TypePaiementController::class, 'index']);
    Route::post('/types-paiement', [TypePaiementController::class, 'store']);
    Route::put('/types-paiement/{typePaiement}', [TypePaiementController::class, 'update']);
    Route::delete('/types-paiement/{typePaiement}', [TypePaiementController::class, 'destroy']);

    // Devises
    Route::get('/devises', [DeviseController::class, 'index']);
    Route::post('/devises', [DeviseController::class, 'store']);
    Route::put('/devises/{devise}', [DeviseController::class, 'update']);
    Route::delete('/devises/{devise}', [DeviseController::class, 'destroy']);

    // Unités
    Route::get('/unites', [UniteController::class, 'index']);
    Route::post('/unites', [UniteController::class, 'store']);
    Route::put('/unites/{unite}', [UniteController::class, 'update']);
    Route::delete('/unites/{unite}', [UniteController::class, 'destroy']);

    // Matériel
    Route::get('/materiels', [MaterielController::class, 'index']);
    Route::get('/materiels-disponibilite', [MaterielController::class, 'availabilityRange']);
    Route::post('/materiels', [MaterielController::class, 'store']);
    Route::get('/materiels/{materiel}', [MaterielController::class, 'show']);
    Route::get('/materiels/{materiel}/disponibilite', [MaterielController::class, 'availability']);
    Route::put('/materiels/{materiel}', [MaterielController::class, 'update']);
    Route::delete('/materiels/{materiel}', [MaterielController::class, 'destroy']);

    // Locations
    Route::get('/locations', [LocationController::class, 'index']);
    Route::post('/locations', [LocationController::class, 'store']);
    Route::get('/locations/{location}', [LocationController::class, 'show']);
    Route::put('/locations/{location}/confirmer', [LocationController::class, 'confirm']);
    Route::put('/locations/{location}/retour', [LocationController::class, 'return']);
    Route::put('/locations/{location}/annuler', [LocationController::class, 'cancel']);

    // Paiements (partiels)
    Route::get('/locations/{location}/paiements', [PaiementController::class, 'index']);
    Route::post('/locations/{location}/paiements', [PaiementController::class, 'store']);
    Route::delete('/paiements/{paiement}', [PaiementController::class, 'destroy']);

    // Facture PDF
    Route::get('/locations/{location}/facture', [FactureController::class, 'download']);

    // Rapports
    Route::get('/rapports/benefice', [RapportController::class, 'profit']);
    Route::get('/rapports/locations', [RapportController::class, 'rentals']);

    // Tableau de bord
    Route::get('/tableau-de-bord/stats', [TableauBordController::class, 'stats']);
});
