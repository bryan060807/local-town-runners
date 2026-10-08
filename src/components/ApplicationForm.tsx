"use client";
import { useState } from "react";
import AgreementConsent, { Agreement } from "./AgreementConsent";
import { categories } from "@/lib/onboarding/schema";
type Payload = Record<string, unknown>;
const initialVendor = {
  name: "",
  representative: "",
  phone: "",
  serviceArea: "",
  description: "",
  category: "Food",
  businessInfo: "",
  products: [
    {
      title: "",
      description: "",
      mode: "SELL",
      priceCents: 0,
      inventory: 1,
      availability: "",
      photos: [] as string[],
    },
  ],
};
const initialRunner = {
  name: "",
  phone: "",
  serviceArea: "",
  description: "",
  transportation: "Walking",
  availability: "",
  radius: 5,
  maxDetour: 3,
  travelAreas: "",
  pickupAreas: "",
  routePreferences: "",
  deliveryTypes: ["Food"],
  eligibility: "",
  locationConsent: false,
};
export default function ApplicationForm({
  role,
  agreement,
  existing,
  email,
}: {
  role: "vendor" | "runner";
  agreement: Agreement | null;
  existing: { id: string; status: string; payload: Payload } | null;
  email: string;
}) {
  const [data, setData] = useState<Payload>(
    existing?.payload ?? (role === "vendor" ? initialVendor : initialRunner),
  );
  const [id, setId] = useState(existing?.id ?? "");
  const [stage, setStage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [receipt, setReceipt] = useState("");
  const [revising, setRevising] = useState(false);
  function set(k: string, v: unknown) {
    setData((d) => ({ ...d, [k]: v }));
    setStage(false);
  }
  const text = (
    key: string,
    label: string,
    required = true,
    multiline = false,
  ) => (
    <label key={key}>
      {label}
      {multiline ? (
        <textarea
          required={required}
          maxLength={2000}
          value={String(data[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          required={required}
          maxLength={150}
          value={String(data[key] ?? "")}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </label>
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft", role, payload: data }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setId(d.applicationId);
      setStage(true);
      setStatus("Draft saved. You can leave and resume after signing in.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Draft could not be saved");
    } finally {
      setBusy(false);
    }
  }
  const products = data.products as typeof initialVendor.products;
  function changeProduct(i: number, k: string, v: unknown) {
    set(
      "products",
      products.map((p, n) => (n === i ? { ...p, [k]: v } : p)),
    );
  }
  async function photo(i: number, file: File) {
    setBusy(true);
    try {
      const r = await fetch(`/api/onboarding/photos?application=${id}`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      changeProduct(i, "photos", [...products[i].photos, d.id]);
      setStatus(
        "Private photograph uploaded. Save the draft again to attach it.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload unavailable");
    } finally {
      setBusy(false);
    }
  }
  if (receipt)
    return (
      <section className="simple-card">
        <h2>Submission received</h2>
        <p role="status">{receipt}</p>
        <p>
          Your application is awaiting administrator review. Submission does not
          activate vendor or runner permissions.
        </p>
        <a href="/account">View account and consent receipts</a>
      </section>
    );
  if (existing && existing.status !== "draft" && !revising)
    return (
      <section className="simple-card">
        <h2>Application {existing.status.replace("_", " ")}</h2>
        <p>
          Your original application and consent remain stored. Contact the
          platform to correct a finalized application; new consent must be
          recorded separately.
        </p>
        <button
          type="button"
          onClick={() => {
            setRevising(true);
            setId("");
            setStage(false);
          }}
        >
          Start a new application revision
        </button>
        <a href="/account">View account</a>
      </section>
    );
  return (
    <>
      <p>
        Verified account email: {email}. Contact details remain private. Use a
        general service area; do not enter a home address or identity documents.
      </p>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          {text(
            "name",
            role === "vendor" ? "Business or display name" : "Full name",
          )}
          {role === "vendor" &&
            text("representative", "Authorized representative")}
          {text("phone", "Contact number")}
          {text("serviceArea", "General service area")}
          {text(
            "description",
            role === "vendor"
              ? "Products or services description"
              : "About your delivery preferences",
            true,
            true,
          )}
          {role === "vendor" ? (
            <>
              <label>
                Vendor category
                <select
                  value={String(data.category)}
                  onChange={(e) => set("category", e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              {text(
                "businessInfo",
                "Relevant business information (optional)",
                false,
                true,
              )}
              <h2>Initial products and services</h2>
              <p>
                These stay private until consent and application approval. MAKE
                and DO are quote requests.
              </p>
              {products.map((p, i) => (
                <fieldset key={i}>
                  <legend>Product or service {i + 1}</legend>
                  <label>
                    Title
                    <input
                      required
                      maxLength={150}
                      value={p.title}
                      onChange={(e) =>
                        changeProduct(i, "title", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      required
                      maxLength={2000}
                      value={p.description}
                      onChange={(e) =>
                        changeProduct(i, "description", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Mode
                    <select
                      value={p.mode}
                      onChange={(e) => changeProduct(i, "mode", e.target.value)}
                    >
                      {["SELL", "MAKE", "DO"].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {p.mode === "SELL"
                      ? "Price in cents"
                      : "Indicative quote price in cents (0 if unknown)"}
                    <input
                      type="number"
                      min={p.mode === "SELL" ? 1 : 0}
                      max={10000000}
                      value={p.priceCents}
                      onChange={(e) =>
                        changeProduct(i, "priceCents", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Stock or capacity
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={p.inventory}
                      onChange={(e) =>
                        changeProduct(i, "inventory", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Availability
                    <input
                      required
                      maxLength={200}
                      value={p.availability}
                      onChange={(e) =>
                        changeProduct(i, "availability", e.target.value)
                      }
                    />
                  </label>
                  <label>
                    Private review photograph (save draft first)
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={!id || p.photos.length >= 3}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void photo(i, f);
                      }}
                    />
                  </label>
                  <p>{p.photos.length} private photographs attached</p>
                </fieldset>
              ))}
              <button
                type="button"
                disabled={products.length >= 10}
                onClick={() =>
                  set("products", [
                    ...products,
                    { ...initialVendor.products[0], photos: [] },
                  ])
                }
              >
                Add product or service
              </button>
            </>
          ) : (
            <>
              {text("travelAreas", "Normal travel areas")}
              {text("pickupAreas", "Preferred pickup areas")}
              {text("availability", "Availability windows")}
              {text(
                "routePreferences",
                "General route or trip preferences",
                true,
                true,
              )}
              <label>
                Transportation
                <select
                  value={String(data.transportation)}
                  onChange={(e) => set("transportation", e.target.value)}
                >
                  {["Walking", "Bicycle", "Car"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Preferred delivery radius in miles
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={Number(data.radius)}
                  onChange={(e) => set("radius", Number(e.target.value))}
                />
              </label>
              <label>
                Maximum acceptable detour in miles
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={Number(data.maxDetour)}
                  onChange={(e) => set("maxDetour", Number(e.target.value))}
                />
              </label>
              <fieldset>
                <legend>Delivery types accepted</legend>
                {categories.map((c) => (
                  <label className="check-row" key={c}>
                    <input
                      type="checkbox"
                      checked={(data.deliveryTypes as string[]).includes(c)}
                      onChange={(e) =>
                        set(
                          "deliveryTypes",
                          e.target.checked
                            ? [...(data.deliveryTypes as string[]), c]
                            : (data.deliveryTypes as string[]).filter(
                                (x) => x !== c,
                              ),
                        )
                      }
                    />
                    {c}
                  </label>
                ))}
              </fieldset>
              {text(
                "eligibility",
                "Relevant eligibility information (optional; no documents)",
                false,
                true,
              )}
              <label className="check-row">
                <input
                  type="checkbox"
                  required
                  checked={Boolean(data.locationConsent)}
                  onChange={(e) => set("locationConsent", e.target.checked)}
                />
                I understand trip sharing is voluntary and limited; no
                continuous tracking is required.
              </label>
              <p>Insurance, licensing and background checks: unverified.</p>
            </>
          )}
          <button className="primary">
            {busy ? "Saving…" : "Save draft and continue"}
          </button>
        </fieldset>
      </form>
      <p role="status">{status}</p>
      {!agreement && (
        <section className="simple-card">
          <h2>Agreement source pending</h2>
          <p>
            The exact original 12-section VDPCP must be supplied before vendor
            consent can be submitted. Your draft remains private.
          </p>
        </section>
      )}
      {stage && agreement && (
        <AgreementConsent
          key={agreement.id}
          agreement={agreement}
          applicationId={id}
          onSaved={setReceipt}
        />
      )}
    </>
  );
}
