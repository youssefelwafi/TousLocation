import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, PackageCheck, Pencil, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";
import api from "../api";
import { toast, confirmDialog } from "../notify";
import Modal from "../components/Modal";
import Loader from "../components/Loader";
import { formatDate, formatMoney } from "../utils/format";

export default function Purchases() {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [editId, setEditId] = useState(null);
  const [editLocked, setEditLocked] = useState(false); // articles verrouillés (réceptionné)
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("received");
  const [lines, setLines] = useState([{ materiel_id: "", quantite: 1, cout_unitaire: "" }]);

  // Modal paiements
  const [payFor, setPayFor] = useState(null); // purchase courant
  const [payList, setPayList] = useState([]);
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState("");
  const [payDate, setPayDate] = useState("");
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState("");

  function load() {
    setLoading(true);
    api.get("/achats").then((r) => setRows(r.data.data || r.data)).finally(() => setLoading(false));
  }
  const reloadEquip = () => api.get("/materiels", { params: { per_page: 100 } }).then((r) => setEquipments(r.data.data || r.data));
  useEffect(() => {
    load();
    api.get("/fournisseurs").then((r) => setSuppliers(r.data));
    api.get("/types-paiement").then((r) => setPaymentTypes(r.data));
    reloadEquip();
  }, []);

  function openCreate() {
    setEditId(null); setEditLocked(false);
    setSupplierId(""); setReference(""); setDate(new Date().toISOString().slice(0, 10));
    setStatus("received"); setLines([{ materiel_id: "", quantite: 1, cout_unitaire: "" }]);
    setError(""); setOpen(true);
  }
  function openEdit(p) {
    setEditId(p.id); setEditLocked(p.statut === "received");
    setSupplierId(p.fournisseur_id || ""); setReference(p.reference || "");
    setDate((p.date_achat || "").slice(0, 10)); setStatus(p.statut);
    setLines((p.lignes || []).map((i) => ({ materiel_id: i.materiel_id, quantite: i.quantite, cout_unitaire: i.cout_unitaire })));
    setError(""); setOpen(true);
  }
  const setLine = (i, k, v) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLine = () => setLines((ls) => [...ls, { materiel_id: "", quantite: 1, cout_unitaire: "" }]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const total = useMemo(
    () => lines.reduce((s, l) => s + Number(l.cout_unitaire || 0) * Number(l.quantite || 0), 0),
    [lines]
  );

  async function save(e) {
    e.preventDefault();
    setError("");
    const items = lines.filter((l) => l.materiel_id && l.cout_unitaire !== "")
      .map((l) => ({ materiel_id: Number(l.materiel_id), quantite: Number(l.quantite), cout_unitaire: Number(l.cout_unitaire) }));
    if (!editLocked && !items.length) { setError(t("purchases.no_items")); return; }
    setSaving(true);
    try {
      if (editId) {
        const payload = { fournisseur_id: supplierId || null, reference: reference || null, date_achat: date };
        if (!editLocked) payload.items = items; // articles modifiables tant que non réceptionné
        await api.put(`/achats/${editId}`, payload);
      } else {
        await api.post("/achats", {
          fournisseur_id: supplierId || null, reference: reference || null,
          date_achat: date, statut: status, items,
        });
      }
      setOpen(false); load(); reloadEquip();
    } catch (err) {
      setError(err.response?.data?.message || t("common.error"));
    } finally { setSaving(false); }
  }

  async function receive(p) {
    try { await api.put(`/achats/${p.id}/receptionner`); load(); reloadEquip(); }
    catch (err) { toast(err.response?.data?.message || t("common.error")); }
  }
  async function remove(p) {
    if (!await confirmDialog(t("common.confirm_delete", { name: p.reference || `#${p.id}` }))) return;
    try { await api.delete(`/achats/${p.id}`); load(); reloadEquip(); }
    catch (err) { toast(err.response?.data?.message || t("common.error")); }
  }

  // --- Paiements ---
  function openPayments(p) {
    setPayFor(p); setPayError(""); setPayAmount(""); setPayType(paymentTypes[0]?.id || "");
    setPayDate(new Date().toISOString().slice(0, 10));
    api.get(`/achats/${p.id}/paiements`).then((r) => setPayList(r.data));
  }
  function refreshPayFor() {
    // recharge le purchase courant depuis la liste pour MAJ paid/remaining
    api.get("/achats").then((r) => {
      const data = r.data.data || r.data;
      setRows(data);
      const cur = data.find((x) => x.id === payFor.id);
      if (cur) setPayFor(cur);
    });
  }
  async function addPayment(e) {
    e.preventDefault();
    setPayError("");
    if (!payAmount || Number(payAmount) <= 0) { setPayError(t("purchases.amount")); return; }
    setPaySaving(true);
    try {
      await api.post(`/achats/${payFor.id}/paiements`, {
        montant: Number(payAmount), type_paiement_id: payType || null, date_paiement: payDate,
      });
      const r = await api.get(`/achats/${payFor.id}/paiements`);
      setPayList(r.data); setPayAmount(""); refreshPayFor();
    } catch (err) {
      setPayError(err.response?.data?.message || t("common.error"));
    } finally { setPaySaving(false); }
  }
  async function removePayment(pay) {
    if (!await confirmDialog(t("common.confirm_delete", { name: formatMoney(pay.montant) }))) return;
    try {
      await api.delete(`/paiements-achat/${pay.id}`);
      const r = await api.get(`/achats/${payFor.id}/paiements`);
      setPayList(r.data); refreshPayFor();
    } catch (err) { toast(err.response?.data?.message || t("common.error")); }
  }

  const payBadge = (s) => (s === "paid" ? "available" : s === "partial" ? "pending" : "unpaid");

  return (
    <div>
      <div className="page-head">
        <h2>{t("purchases.title")}</h2>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> {t("purchases.new")}</button>
      </div>

      {loading ? <Loader /> : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("purchases.reference")}</th><th>{t("purchases.supplier")}</th><th>{t("purchases.date")}</th>
              <th>{t("purchases.item")}</th><th>{t("purchases.total")}</th><th>{t("common.status")}</th>
              <th>{t("purchases.pay_status")}</th>
              <th className="actions-col">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.reference || `#${p.id}`}</td>
                <td>{p.fournisseur?.nom || "-"}</td>
                <td>{formatDate(p.date_achat)}</td>
                <td>{p.lignes?.reduce((s, i) => s + i.quantite, 0)} ({p.lignes?.length})</td>
                <td>{formatMoney(p.montant_total)}</td>
                <td><span className={`badge badge-${p.statut === "received" ? "available" : "pending"}`}>{t(`status.${p.statut}`)}</span></td>
                <td>
                  <span className={`badge badge-${payBadge(p.statut_paiement)}`}>{t(`status.${p.statut_paiement}`)}</span>
                  {p.statut_paiement !== "paid" && Number(p.montant_restant) > 0 && (
                    <small className="muted" style={{ display: "block" }}>{formatMoney(p.montant_restant)}</small>
                  )}
                </td>
                <td className="actions-col">
                  <button className="icon-btn" title={t("purchases.manage_payments")} onClick={() => openPayments(p)}><Wallet size={16} /></button>
                  <button className="icon-btn" title={t("purchases.edit")} onClick={() => openEdit(p)}><Pencil size={16} /></button>
                  {p.statut === "pending" && (
                    <button className="icon-btn" title={t("purchases.mark_received")} onClick={() => receive(p)}>
                      <PackageCheck size={16} />
                    </button>
                  )}
                  <button className="icon-btn danger" title={t("common.delete")} onClick={() => remove(p)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="8" className="empty">{t("purchases.none")}</td></tr>}
          </tbody>
        </table>
      )}

      {open && (
        <Modal title={editId ? t("purchases.edit") : t("purchases.create")} onClose={() => setOpen(false)}>
          <form className="form" onSubmit={save}>
            {error && <div className="alert">{error}</div>}
            <label>{t("purchases.supplier")}</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">{t("purchases.choose_supplier")}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>

            <div className="form-row">
              <div>
                <label>{t("purchases.reference")}</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="BC-2026-002" />
              </div>
              <div>
                <label>{t("purchases.date")}</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
            </div>

            {!editId && (
              <>
                <label>{t("common.status")}</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="received">{t("status.received")} — {t("purchases.received_info")}</option>
                  <option value="pending">{t("status.pending")}</option>
                </select>
              </>
            )}

            <label style={{ marginTop: 10 }}>{t("purchases.item")}</label>
            {editLocked && <p className="muted" style={{ marginTop: 0 }}>{t("purchases.received_lock")}</p>}
            {lines.map((l, i) => (
              <div key={i} className="rent-line">
                <select value={l.materiel_id} onChange={(e) => setLine(i, "materiel_id", e.target.value)} disabled={editLocked}>
                  <option value="">{t("materials.choose")}</option>
                  {equipments.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
                <input type="number" min="1" value={l.quantite} onChange={(e) => setLine(i, "quantite", e.target.value)} className="qty-input" title={t("purchases.quantity")} disabled={editLocked} />
                <input type="number" min="0" step="0.01" value={l.cout_unitaire} onChange={(e) => setLine(i, "cout_unitaire", e.target.value)} className="qty-input" placeholder={t("purchases.unit_cost")} style={{ width: 90 }} disabled={editLocked} />
                <span className="line-total">{formatMoney(Number(l.cout_unitaire || 0) * Number(l.quantite || 0))}</span>
                <button type="button" className="icon-btn danger" onClick={() => removeLine(i)} disabled={editLocked || lines.length === 1}><Trash2 size={15} /></button>
              </div>
            ))}
            {!editLocked && <button type="button" className="btn-ghost add-line" onClick={addLine}><Plus size={14} /> {t("purchases.add_item")}</button>}

            <div className="pay-summary" style={{ marginTop: 14 }}>
              <div className="ttc"><span>{t("purchases.total")}</span><strong>{formatMoney(total)}</strong></div>
            </div>

            <div className="form-actions">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? t("common.saving") : (editId ? t("common.save") : t("purchases.create"))}</button>
            </div>
          </form>
        </Modal>
      )}

      {payFor && (
        <Modal title={`${t("purchases.payments")} — ${payFor.reference || `#${payFor.id}`}`} onClose={() => setPayFor(null)}>
          <div className="pay-summary" style={{ marginBottom: 14 }}>
            <div><span>{t("purchases.total")}</span><strong>{formatMoney(payFor.montant_total)}</strong></div>
            <div><span>{t("purchases.paid")}</span><strong>{formatMoney(payFor.montant_paye)}</strong></div>
            <div className="ttc"><span>{t("purchases.remaining")}</span><strong>{formatMoney(payFor.montant_restant)}</strong></div>
          </div>

          <div className="pay-list">
            {payList.length === 0 && <p className="muted">{t("purchases.no_payments")}</p>}
            {payList.map((pay) => (
              <div className="cart-line" key={pay.id}>
                <div className="cl-info">
                  <strong>{formatMoney(pay.montant)}</strong>
                  <span className="muted">{formatDate(pay.date_paiement)}{pay.type_paiement ? ` · ${pay.type_paiement.nom}` : ""}</span>
                </div>
                <button type="button" className="icon-btn danger" onClick={() => removePayment(pay)}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          {Number(payFor.montant_restant) > 0 && (
            <form className="form" onSubmit={addPayment} style={{ marginTop: 14 }}>
              {payError && <div className="alert">{payError}</div>}
              <div className="form-row">
                <div>
                  <label>{t("purchases.amount")}</label>
                  <input type="number" min="0.01" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={String(payFor.montant_restant)} required />
                </div>
                <div>
                  <label>{t("purchases.payment_type")}</label>
                  <select value={payType} onChange={(e) => setPayType(e.target.value)}>
                    {paymentTypes.map((pt) => <option key={pt.id} value={pt.id}>{pt.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label>{t("purchases.paid_at")}</label>
                  <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={paySaving}><Plus size={14} /> {paySaving ? t("common.saving") : t("purchases.add_payment")}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
