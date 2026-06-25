<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <style>
        * { font-family: DejaVu Sans, sans-serif; }
        body { color: #1f2937; font-size: 12px; margin: 0; padding: 28px; }
        .head { display: flex; justify-content: space-between; border-bottom: 3px solid #16a34a; padding-bottom: 14px; }
        .brand { font-size: 26px; font-weight: bold; color: #16a34a; }
        .brand small { display: block; font-size: 11px; color: #6b7280; font-weight: normal; }
        .doc-title { text-align: right; }
        .doc-title h1 { margin: 0; font-size: 22px; color: #111827; }
        .doc-title .num { color: #6b7280; }
        .meta { width: 100%; margin: 22px 0; }
        .meta td { vertical-align: top; width: 50%; }
        .box-title { font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; letter-spacing: .5px; }
        table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
        table.items th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-size: 11px; color: #475569; }
        table.items td { padding: 8px 10px; border-bottom: 1px solid #eef2f7; }
        .right { text-align: right; }
        .totals { width: 45%; float: right; margin-top: 14px; }
        .totals td { padding: 6px 10px; }
        .totals .ttc td { border-top: 2px solid #111827; font-weight: bold; font-size: 14px; }
        .totals .label { color: #6b7280; }
        .pay { clear: both; padding-top: 26px; }
        .pay h3 { font-size: 13px; margin-bottom: 6px; }
        table.pays { width: 100%; border-collapse: collapse; }
        table.pays th { text-align: left; padding: 6px 8px; font-size: 11px; color: #475569; border-bottom: 1px solid #e2e8f0; }
        table.pays td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
        .balance { margin-top: 10px; padding: 10px 12px; background: #f8fafc; border-radius: 6px; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 10px; }
        .paid { background: #dcfce7; color: #166534; }
        .partial { background: #fef9c3; color: #854d0e; }
        .unpaid { background: #fee2e2; color: #991b1b; }
        .foot { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 10px; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    </style>
</head>
<body>
    @php
        $money = fn ($n) => number_format((float) $n, 2, ',', ' ').' '.$symbole;
        $date = fn ($d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('d/m/Y') : '-';
        $statusLabels = ['paid' => 'Payé', 'partial' => 'Partiel', 'unpaid' => 'Non payé'];
    @endphp

    <div class="head">
        <div class="brand">TousLocation<small>Vente de matériel — Maroc</small></div>
        <div class="doc-title">
            <h1>REÇU DE VENTE</h1>
            <div class="num">N° {{ $numero }}</div>
            <div class="num">Date : {{ $date($vente->date_vente) }}</div>
        </div>
    </div>

    <table class="meta">
        <tr>
            <td>
                <div class="box-title">Client</div>
                @if($vente->client)
                    <strong>{{ $vente->client->nom }}</strong><br>
                    {{ $vente->client->email }}<br>
                    {{ $vente->client->telephone }}
                @else
                    <em style="color:#9ca3af">Vente comptoir</em>
                @endif
            </td>
            <td>
                <div class="box-title">Vente</div>
                Référence : {{ $numero }}<br>
                Date : {{ $date($vente->date_vente) }}
            </td>
        </tr>
    </table>

    <table class="items">
        <thead>
            <tr>
                <th>Désignation</th>
                <th class="right">Prix unitaire</th>
                <th class="right">Qté</th>
                <th class="right">Total HT</th>
            </tr>
        </thead>
        <tbody>
            @foreach($vente->lignes as $ligne)
            <tr>
                <td>{{ $ligne->materiel->nom ?? '—' }}</td>
                <td class="right">{{ $money($ligne->prix_unitaire) }}</td>
                <td class="right">{{ $ligne->quantite }}</td>
                <td class="right">{{ $money($ligne->sous_total) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <table class="totals">
        <tr>
            <td class="label">Total HT</td>
            <td class="right">{{ $money($vente->sous_total) }}</td>
        </tr>
        <tr>
            <td class="label">TVA ({{ rtrim(rtrim(number_format($vente->taux_taxe, 2), '0'), '.') }} %)</td>
            <td class="right">{{ $money($vente->montant_taxe) }}</td>
        </tr>
        <tr class="ttc">
            <td>Total TTC</td>
            <td class="right">{{ $money($vente->montant_total) }}</td>
        </tr>
    </table>

    <div class="pay">
        <h3>Encaissements</h3>
        @if($vente->paiements->count())
        <table class="pays">
            <thead>
                <tr><th>Date</th><th>Mode</th><th>Note</th><th class="right">Montant</th></tr>
            </thead>
            <tbody>
                @foreach($vente->paiements as $paiement)
                <tr>
                    <td>{{ $date($paiement->date_paiement) }}</td>
                    <td>{{ $paiement->typePaiement->nom ?? '-' }}</td>
                    <td>{{ $paiement->note }}</td>
                    <td class="right">{{ $money($paiement->montant) }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>
        @else
            <em style="color:#9ca3af">Aucun encaissement enregistré.</em>
        @endif

        <div class="balance">
            <table style="width:100%">
                <tr>
                    <td>Encaissé : <strong>{{ $money($vente->montant_paye) }}</strong></td>
                    <td class="right">
                        Reste à encaisser : <strong>{{ $money($vente->montant_restant) }}</strong>
                        <span class="badge {{ $vente->statut_paiement }}">{{ $statusLabels[$vente->statut_paiement] }}</span>
                    </td>
                </tr>
            </table>
        </div>
    </div>

    @if($vente->note)
        <div style="margin-top:18px;color:#6b7280"><strong>Note :</strong> {{ $vente->note }}</div>
    @endif

    <div class="foot">
        TousLocation — Merci de votre achat · Reçu généré le {{ $date(now()) }}
    </div>
</body>
</html>
