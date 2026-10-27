"use client";
import UploadAsset from "./UploadAsset";
export type VendorListingValues = {
  inventory: number;
  price: number;
  active: boolean;
};
export type VendorSaveFeedback = { pending: boolean; message: string };
export default function VendorEditor({
  id,
  vendorId,
  title,
  values,
  onChange,
  onSaved,
  feedback,
  onFeedbackChange,
}: {
  id: string;
  vendorId: string;
  title: string;
  values: VendorListingValues;
  onChange: (values: VendorListingValues) => void;
  onSaved: (values: VendorListingValues) => void;
  feedback: VendorSaveFeedback;
  onFeedbackChange: (feedback: VendorSaveFeedback) => void;
}) {
  function update(changes: Partial<VendorListingValues>) {
    onChange({ ...values, ...changes });
    onFeedbackChange({ pending: false, message: "" });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (feedback.pending) return;
    onFeedbackChange({ pending: true, message: "" });
    const saved = { ...values };
    try {
      const r = await fetch("/api/vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          listingId: id,
          inventory: saved.inventory,
          priceCents: saved.price,
          active: saved.active,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      onSaved(saved);
      onFeedbackChange({ pending: false, message: "Listing updated." });
    } catch (e) {
      onFeedbackChange({
        pending: false,
        message: e instanceof Error ? e.message : "Update failed",
      });
    }
  }
  return (
    <form onSubmit={save} className="vendor-listing-editor">
      <h3>{title}</h3>
      <fieldset disabled={feedback.pending}>
        <label>
          Available inventory
          <input
            type="number"
            min={0}
            max={100000}
            required
            value={values.inventory}
            onChange={(e) => update({ inventory: Number(e.target.value) })}
          />
        </label>
        <label>
          Price in cents
          <input
            type="number"
            min={0}
            max={10000000}
            required
            value={values.price}
            onChange={(e) => update({ price: Number(e.target.value) })}
          />
        </label>
        <label>
          <input
            style={{ display: "inline", width: "auto" }}
            type="checkbox"
            checked={values.active}
            onChange={(e) => update({ active: e.target.checked })}
          />{" "}
          Active
        </label>
        <button type="submit" className="primary">
          {feedback.pending ? "Saving…" : "Save listing"}
        </button>
      </fieldset>
      <UploadAsset
        label="Listing photo"
        data={{ target: "listing", vendorId, listingId: id }}
      />
      <p role="status">{feedback.message}</p>
    </form>
  );
}
