import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Eye, ReceiptText, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import api, { downloadSaleReceipt } from "../api";
import { toast, confirmDialog } from "../notify";
import Modal from "../components/Modal";
import Loader from "../components/Loader";
import { formatDate, formatMoney } from "../utils/format";

export default function Sales() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [clients, setClients] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [taxRate, setTaxRate] = useState(20);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [clientId, setClientId] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [lines, setLines] = useState([{ materiel_id: "", quantite: 1, prix_unitaire: "" }]);

  // Vue détaillée + encaissements
  const [detail, setDetail] = useState(null); // vente complète
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState("");
  const [payDate, setPayDate] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState("");

  function loadEquip() {
    api.get("/materiels", { params: { per_page: 100 } }).then((r) => setEquipments(r.data.data || r.data));
  }
  function load() {
    setLoading(true);
    api.get("/ventes").then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.get("/clients").then((r) => setClients(r.data.data || r.data));
    api.get("/types-paiement").then((r) => setPaymentTypes(r.data));
    api.get("/taxes").then((r) => { const d = (r.data || []).find((x) => x.par_defaut); if (d) setTaxRate(Number(d.taux)); });
    loadEquip();
  }, []);

  const priceOf = (id) => Number(equipments.find((e) => e.id === Number(id))?.prix_par_jour || 0);
  const purchaseOf = (id) => equipments.find((e) => e.id === Number(id))?.prix_achat;

  function openCreate() {
    setClientId(""); setReference(""); setDate(new Date().toISOString().slice(0, 10));
    setLines([{ materiel_id: "", quantite: 1, prix_unitaire: "" }]); setError(""); setOpen(true);
  }
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLine = () => setLines((ls) => [...ls, { materiel_id: "", quantite: 1, prix_unitaire: "" }]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.prix_unitaire || 0) * Number(l.quantite || 0), 0),
    [lines]
  );
  const tax = +(subtotal * taxRate / 100).toFixed(2);
  const ttc = subtotal + tax;

  async function save(e) {
    e.preventDefault();
    setError("");
    const items = lines.filter((l) => l.materiel_id && l.prix_unitaire !== "")
      .map((l) => ({ materiel_id: Number(l.materiel_id), quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire) }));
    if (!items.length) { setError(t("sales.no_items")); return; }
    setSaving(true);
    try {
      await api.post("/ventes", { client_id: clientId || null, reference: reference || null, date_vente: date, items });
      setOpen(false); load(); loadEquip();
    } catch (err) {
      setError(err.response?.data?.message || t("common.error"));
    } finally { setSaving(false); }
  }

  async function remove(s) {
    if (!await confirmDialog(t("common.confirm_delete", { name: s.reference || `#${s.id}` }))) return;
    try { await api.delete(`/ventes/${s.id}`); load(); loadEquip(); }
    catch (err) { toast(err.response?.data?.message || t("common.error")); }
  }

  // --- Vue détaillée + encaissements ---
  function openDetail(s) {
    setPayError(""); setPayAmount(""); setPayType(paymentTypes[0]?.id || "");
    setPayDate(new Date().toISOString().slice(0, 10));
    api.get(`/ventes/${s.id}`).then((r) => setDetail(r.data));
  }
  function refreshDetail() {
    if (!detail) return;
    api.get(`/ventes/${detail.id}`).then((r) => setDetail(r.data));
    load();
  }
  async function addPayment(e) {
    e.preventDefault();
    setPayError("");
    if (!payAmount || Number(payAmount) <= 0) { setPayError(t("sales.amount")); return; }
    setPaySaving(true);
    try {
      await api.post(`/ventes/${detail.id}/paiements`, {
        montant: Number(payAmount), type_paiement_id: payType || null, date_paiement: payDate,
      });
      setPayAmount(""); refreshDetail();
    } catch (err) {
      setPayError(err.response?.data?.message || t("common.error"));
    } finally { setPaySaving(false); }
  }
  async function removePayment(pay) {
    if (!await confirmDialog(t("common.confirm_delete", { name: formatMoney(pay.montant) }))) return;
    try { await api.delete(`/paiements-vente/${pay.id}`); refreshDetail(); }
    catch (err) { toast(err.response?.data?.message || t("common.error")); }
  }
  async function receipt(s) {
    try { await downloadSaleReceipt(s.id); }
    catch { toast(t("common.error")); }
  }

  const payBadge = (s) => (s === "paid" ? "available" : s === "partial" ? "pending" : "unpaid");

  return (
    <div>
      <div className="page-head">
        <h2>{t("sales.title")}</h2>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> {t("sales.new")}</button>
      </div>

      {loading ? <Loader /> : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("sales.reference")}</th><th>{t("sales.client")}</th><th>{t("sales.date")}</th>
              <th>{t("sales.item")}</th><th>{t("sales.ttc")}</th><th>{t("sales.pay_status")}</th>
              <th className="actions-col">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.reference || `#${s.id}`}</td>
                <td>{s.client?.nom || "-"}</td>
                <td>{formatDate(s.date_vente)}</td>
                <td>{s.lignes?.reduce((a, i) => a + i.quantite, 0)} ({s.lignes?.length})</td>
                <td>{formatMoney(s.montant_total)}</td>
                <td>
                  <span className={`badge badge-${payBadge(s.statut_paiement)}`}>{t(`status.${s.statut_paiement}`)}</span>
                  {s.statut_paiement !== "paid" && Number(s.montant_restant) > 0 && (
                    <small className="muted" style={{ display: "block" }}>{formatMoney(s.montant_restant)}</small>
                  )}
                </td>
                <td className="actions-col">
                  <button className="icon-btn" title={t("sales.details")} onClick={() => openDetail(s)}><Eye size={16} /></button>
                  <button className="icon-btn" title={t("sales.receipt")} onClick={() => receipt(s)}><ReceiptText size={16} /></button>
                  <button className="icon-btn danger" title={t("common.delete")} onClick={() => remove(s)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="7" className="empty">{t("sales.none")}</td></tr>}
          </tbody>
        </table>
      )}

      {/* Création */}
      {open && (
        <Modal title={t("sales.create")} onClose={() => setOpen(false)}>
          <form className="form" onSubmit={save}>
            {error && <div className="alert">{error}</div>}
            <div className="form-row">
              <div>
                <label>{t("sales.client")}</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">{t("sales.choose_client")}</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div>
                <label>{t("sales.date")}</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>
            <label>{t("sales.reference")}</label>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="VTE-2026-001" />

            <label style={{ marginTop: 10 }}>{t("sales.item")}</label>
            {lines.map((l, i) => {
              const eq = equipments.find((x) => x.id === Number(l.materiel_id));
              return (
                <div key={i} className="rent-line">
                  <select value={l.materiel_id} onChange={(e) => { setLine(i, "materiel_id", e.target.value); if (!l.prix_unitaire) setLine(i, "prix_unitaire", priceOf(e.target.value) || ""); }}>
                    <option value="">{t("materials.choose")}</option>
                    {equipments.map((e) => <option key={e.id} value={e.id} disabled={e.quantite <= 0}>{e.nom} ({t("materials.stock")}: {e.quantite})</option>)}
                  </select>
                  <input type="number" min="1" max={eq?.quantite || undefined} value={l.quantite} onChange={(e) => setLine(i, "quantite", e.target.value)} className="qty-input" />
                  <input type="number" min="0" step="0.01" value={l.prix_unitaire} onChange={(e) => setLine(i, "prix_unitaire", e.target.value)} className="qty-input" style={{ width: 90 }}
                    placeholder={purchaseOf(l.materiel_id) ? `${purchaseOf(l.materiel_id)}` : t("sales.unit_price")} />
                  <span className="line-total">{formatMoney(Number(l.prix_unitaire || 0) * Number(l.quantite || 0))}</span>
                  <button type="button" className="icon-btn danger" onClick={() => removeLine(i)} disabled={lines.length === 1}><Trash2 size={15} /></button>
                </div>
              );
            })}
            <button type="button" className="btn-ghost add-line" onClick={addLine}><Plus size={14} /> {t("sales.add_item")}</button>

            <div className="pay-summary" style={{ marginTop: 14 }}>
              <div><span>{t("sales.ht")}</span><strong>{formatMoney(subtotal)}</strong></div>
              <div><span>{t("sales.tva")} ({taxRate}%)</span><strong>{formatMoney(tax)}</strong></div>
              <div className="ttc"><span>{t("sales.ttc")}</span><strong>{formatMoney(ttc)}</strong></div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? t("common.saving") : t("sales.create")}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Vue détaillée + encaissements */}
      {detail && (
        <Modal title={`${t("sales.view")} — ${detail.reference || `#${detail.id}`}`} onClose={() => setDetail(null)} wide>
          <div className="sale-detail">
            {/* En-tête infos */}
            <div className="sd-head">
              <div>
                <span className="muted">{t("sales.client")}</span>
                <strong>{detail.client?.nom || t("sales.choose_client")}</strong>
              </div>
              <div>
                <span className="muted">{t("sales.date")}</span>
                <strong>{formatDate(detail.date_vente)}</strong>
              </div>
              <div>
                <span className="muted">{t("sales.pay_status")}</span>
                <span className={`badge badge-${payBadge(detail.statut_paiement)}`}>{t(`status.${detail.statut_paiement}`)}</span>
              </div>
              <button className="btn-ghost" onClick={() => receipt(detail)}><ReceiptText size={15} /> {t("sales.receipt")}</button>
            </div>

            {/* Articles */}
            <h4 className="sd-title">{t("sales.items_title")}</h4>
            <table className="table compact">
              <thead>
                <tr>
                  <th>{t("sales.item")}</th><th className="num">{t("sales.unit_price")}</th>
                  <th className="num">{t("sales.quantity")}</th><th className="num">{t("sales.ht")}</th>
                </tr>
              </thead>
              <tbody>
                {detail.lignes?.map((l) => (
                  <tr key={l.id}>
                    <td>{l.materiel?.nom || "—"}</td>
                    <td className="num">{formatMoney(l.prix_unitaire)}</td>
                    <td className="num">{l.quantite}</td>
                    <td className="num">{formatMoney(l.sous_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="sd-cols">
              {/* Totaux */}
              <div className="pay-summary">
                <div><span>{t("sales.ht")}</span><strong>{formatMoney(detail.sous_total)}</strong></div>
                <div><span>{t("sales.tva")} ({Number(detail.taux_taxe)}%)</span><strong>{formatMoney(detail.montant_taxe)}</strong></div>
                <div className="ttc"><span>{t("sales.ttc")}</span><strong>{formatMoney(detail.montant_total)}</strong></div>
                <div style={{ marginTop: 6 }}><span>{t("sales.paid")}</span><strong style={{ color: "#34c759" }}>{formatMoney(detail.montant_paye)}</strong></div>
                <div><span>{t("sales.remaining")}</span><strong style={{ color: "#ff3b30" }}>{formatMoney(detail.montant_restant)}</strong></div>
              </div>

              {/* Encaissements */}
              <div className="sd-pay">
                <h4 className="sd-title"><Wallet size={15} /> {t("sales.payments")}</h4>
                <div className="pay-list">
                  {(!detail.paiements || detail.paiements.length === 0) && <p className="muted">{t("sales.no_payments")}</p>}
                  {detail.paiements?.map((pay) => (
                    <div className="cart-line" key={pay.id}>
                      <div className="cl-info">
                        <strong>{formatMoney(pay.montant)}</strong>
                        <span className="muted">{formatDate(pay.date_paiement)}{pay.type_paiement ? ` · ${pay.type_paiement.nom}` : ""}</span>
                      </div>
                      <button type="button" className="icon-btn danger" onClick={() => removePayment(pay)}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>

                {Number(detail.montant_restant) > 0 && (
                  <form className="form" onSubmit={addPayment} style={{ marginTop: 10 }}>
                    {payError && <div className="alert">{payError}</div>}
                    <div className="form-row">
                      <div>
                        <label>{t("sales.amount")}</label>
                        <input type="number" min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={String(detail.montant_restant)} required />
                      </div>
                      <div>
                        <label>{t("sales.payment_type")}</label>
                        <select value={payType} onChange={(e) => setPayType(e.target.value)}>
                          {paymentTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.nom}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>{t("sales.paid_at")}</label>
                        <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={paySaving}><Plus size={14} /> {paySaving ? t("common.saving") : t("sales.add_payment")}</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
