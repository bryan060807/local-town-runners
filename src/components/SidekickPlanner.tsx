"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Leaf,
  MapPin,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import { money } from "@/lib/catalog";
import type { ErrandPlan } from "@/lib/errand-plan";
import styles from "./SidekickPlanner.module.css";

type Turn = { role: "user" | "assistant"; text: string };
type Option = ErrandPlan["options"][number];
type Pickup = Option["vendorGroups"][number]["pickup"];
type SaveState = {
  kind: "idle" | "saved" | "error";
  savedIds: string[];
  message: string;
  accessError?: boolean;
};

const examples = [
  {
    label: "Bakery stop under $20",
    message:
      "I need two cinnamon rolls and one more bakery item to share, under $20 total. Compare two combinations from one shop and check pickup.",
  },
  {
    label: "A local thank-you gift",
    message:
      "I need a practical thank-you gift and a greeting card, under $35 total. Prefer locally made items from one shop. Compare two options and check pickup.",
  },
];
const emptySave: SaveState = { kind: "idle", savedIds: [], message: "" };

function timestamp(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;
  return Number.isFinite(number) ? number : null;
}

function compactSummary(plan: ErrandPlan, selectedId?: string | null) {
  const options = selectedId
    ? [
        ...plan.options.filter((option) => option.id === selectedId),
        ...plan.options.filter((option) => option.id !== selectedId),
      ]
    : plan.options;
  const summary = {
    status: plan.status,
    need: plan.understoodNeed.slice(0, 160) as string | undefined,
    budgetCents: plan.budgetCents,
    constraints: plan.constraints,
    ...(selectedId ? { reviewedOption: selectedId } : {}),
    ...(plan.question ? { question: plan.question.slice(0, 120) } : {}),
    options: options.slice(0, 3).map((option) => ({
      id: option.id,
      items: option.items.map((item) => [item.listing.id, item.quantity]),
      subtotalCents: option.subtotalCents as number | undefined,
    })),
    omittedOptions: undefined as number | undefined,
  };
  let encoded = JSON.stringify(summary);
  if (encoded.length > 1000) {
    summary.need = undefined;
    encoded = JSON.stringify(summary);
  }
  if (encoded.length > 1000) {
    for (const option of summary.options) option.subtotalCents = undefined;
    encoded = JSON.stringify(summary);
  }
  const optionCount = summary.options.length;
  while (encoded.length > 1000 && summary.options.length > 1) {
    summary.options.pop();
    summary.omittedOptions = optionCount - summary.options.length;
    encoded = JSON.stringify(summary);
  }
  if (encoded.length > 1000) throw Error("Plan context exceeds its size limit");
  return encoded;
}

function pickupText(pickup: Pickup, now: number | null, offline: boolean) {
  const until = timestamp(pickup.validUntil);
  if (pickup.status === "none")
    return "No compatible runner was listed for this shop at the catalog check.";
  if (until === null) return "Pickup needs a fresh availability check.";
  if (now !== null && until <= now)
    return "This pickup window has expired. Ask Sidekick to check again.";
  const name = pickup.runnerName || "A neighbor";
  if (offline)
    return `${name} is an illustrative ${pickup.status === "declared_trip" ? "trip candidate" : "pickup candidate"}.`;
  return pickup.status === "declared_trip"
    ? `${name} has a declared trip to this shop.`
    : `${name} is a compatible candidate; a trip to this shop is not confirmed.`;
}

export default function SidekickPlanner({
  offline,
  onReview,
}: {
  offline: boolean;
  onReview: (listingId: string, quantity: number) => void;
}) {
  const router = useRouter();
  const instance = useId().replaceAll(":", "");
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [localOnly, setLocalOnly] = useState<boolean | undefined>();
  const [singleVendor, setSingleVendor] = useState<boolean | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [plan, setPlan] = useState<ErrandPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState("");
  const [accessError, setAccessError] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>(emptySave);
  const [now, setNow] = useState<number | null>(null);
  const inFlight = useRef(false);
  const cartInFlight = useRef(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const working = busy || saving;
  const reviewed = plan?.options.find((option) => option.id === reviewId);
  const budgetNumber = Number(budget);
  const budgetCents = Math.round(budgetNumber * 100);
  const validBudget =
    budget.trim() === "" ||
    (Number.isFinite(budgetNumber) &&
      budgetNumber >= 0 &&
      budgetCents <= 10000000 &&
      Math.abs(budgetNumber * 100 - budgetCents) < 0.00001);

  useEffect(() => {
    if (!plan) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      const future = plan.options
        .flatMap((option) =>
          option.vendorGroups.map((group) =>
            timestamp(group.pickup.validUntil),
          ),
        )
        .filter((value): value is number => value !== null && value > current);
      if (future.length)
        timer = setTimeout(
          tick,
          Math.min(30000, Math.max(25, Math.min(...future) - current + 25)),
        );
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [plan]);

  useEffect(() => {
    if (plan) {
      resultHeading.current?.focus({ preventScroll: true });
      resultHeading.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }, [plan]);

  useEffect(() => {
    if (reviewId) {
      reviewHeading.current?.focus({ preventScroll: true });
      reviewHeading.current?.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }, [reviewId]);

  async function requestPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (
      !hydrated ||
      !text ||
      !validBudget ||
      inFlight.current ||
      cartInFlight.current
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setFailure("");
    setAccessError(false);
    const history = turns
      .map((turn, index) =>
        plan && index === turns.length - 1 && turn.role === "assistant"
          ? { ...turn, text: compactSummary(plan, reviewId) }
          : turn,
      )
      .slice(-6);
    try {
      const response = await fetch("/api/assistant/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          turns: history,
          ...(budget.trim() !== "" ? { budgetCents } : {}),
          ...(localOnly !== undefined ? { localOnly } : {}),
          ...(singleVendor !== undefined ? { singleVendor } : {}),
        }),
      });
      if (!response.ok) {
        setAccessError(response.status === 401 || response.status === 403);
        setFailure(
          response.status === 401 || response.status === 403
            ? "Sign in or enter a private Customer demo from the marketplace to plan with the current catalog. Your request is still here."
            : response.status === 429
              ? "Sidekick needs a moment before another request. Your message is still here; try again shortly."
              : "We couldn’t build that plan just now. Your message is still here; please try again.",
        );
        return;
      }
      const result = (await response.json()) as ErrandPlan;
      if (
        !result ||
        !Array.isArray(result.options) ||
        !Array.isArray(result.notes) ||
        !Array.isArray(result.suggestions) ||
        !result.provenance ||
        !["model", "catalog"].includes(result.provenance.engine)
      )
        throw Error("Invalid plan response");
      setPlan(result);
      setNow(Date.now());
      setReviewId(null);
      setSave(emptySave);
      setTurns(
        [
          ...history,
          { role: "user", text } as Turn,
          { role: "assistant", text: compactSummary(result) } as Turn,
        ].slice(-6),
      );
      setMessage("");
    } catch {
      setFailure(
        "We couldn’t build that plan just now. Your message is still here; please try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function startNew() {
    if (inFlight.current || cartInFlight.current) return;
    setPlan(null);
    setTurns([]);
    setReviewId(null);
    setSave(emptySave);
    setFailure("");
    setAccessError(false);
    setMessage("");
    setBudget("");
    setLocalOnly(undefined);
    setSingleVendor(undefined);
    requestAnimationFrame(() => composer.current?.focus());
  }

  async function saveChoices(option: Option) {
    if (
      !hydrated ||
      offline ||
      inFlight.current ||
      cartInFlight.current ||
      option.items.some((item) => item.listing.mode !== "SELL") ||
      (plan?.budgetCents !== null &&
        plan?.budgetCents !== undefined &&
        option.subtotalCents > plan.budgetCents)
    )
      return;
    cartInFlight.current = true;
    setSaving(true);
    const saved: string[] = [];
    setSave(emptySave);
    try {
      for (const item of option.items) {
        const response = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listingId: item.listing.id,
            quantity: item.quantity,
          }),
        });
        if (!response.ok) {
          const prefix = `${saved.length} of ${option.items.length} choices were confirmed saved in this attempt. `;
          setSave({
            kind: "error",
            savedIds: saved,
            accessError: response.status === 401 || response.status === 403,
            message:
              prefix +
              (response.status === 401 || response.status === 403
                ? "A current Customer session is required. Sign in or switch to the Customer demo profile, then try again."
                : response.status === 409
                  ? "An item’s availability has changed. Review the current listing or ask Sidekick to check again."
                  : "We couldn’t save the next choice. You can retry; quantities are set rather than added twice."),
          });
          return;
        }
        saved.push(item.listing.id);
      }
      setSave({
        kind: "saved",
        savedIds: saved,
        message: `${saved.length} ${saved.length === 1 ? "choice" : "choices"} saved to your cart. Review your full cart before preparing an order.`,
      });
    } catch {
      setSave({
        kind: "error",
        savedIds: saved,
        message: `${saved.length} of ${option.items.length} choices were confirmed saved. A connection problem stopped this attempt; review your cart or retry. Retrying sets the chosen quantities and does not add duplicate units.`,
      });
    } finally {
      cartInFlight.current = false;
      setSaving(false);
    }
  }

  function openCart() {
    router.push("/cart");
    router.refresh();
  }

  const form = (
    <form
      className={styles.form}
      onSubmit={requestPlan}
      aria-label="Plan a local errand"
      aria-busy={busy}
    >
      <label className={styles.requestLabel}>
        {plan
          ? "Tell Sidekick what to change or clarify"
          : "Tell Sidekick what you need"}
        <textarea
          ref={composer}
          aria-label="Tell Sidekick what you need"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={1000}
          rows={3}
          required
          disabled={!hydrated}
          readOnly={working}
          placeholder={
            plan
              ? "Make it cheaper, choose one option, or answer Sidekick’s question…"
              : "What are you looking for, what’s your budget, and what matters to you?"
          }
        />
      </label>
      <div className={styles.controls}>
        <label className={styles.budget}>
          Total budget (USD, optional)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100000}
            step="0.01"
            placeholder="e.g. 20.00"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            disabled={!hydrated || working}
            aria-invalid={!validBudget}
          />
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={localOnly ?? plan?.constraints.localOnly ?? false}
            onChange={(event) => setLocalOnly(event.target.checked)}
            disabled={!hydrated || working}
          />{" "}
          Locally made only
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={singleVendor ?? plan?.constraints.singleVendor ?? false}
            onChange={(event) => setSingleVendor(event.target.checked)}
            disabled={!hydrated || working}
          />{" "}
          One shop only
        </label>
      </div>
      {!validBudget && (
        <p className={styles.error}>
          Use a USD amount with no more than two decimal places.
        </p>
      )}
      <div className={styles.formActions}>
        <button
          type="submit"
          className={styles.primary}
          disabled={!hydrated || working || !message.trim() || !validBudget}
        >
          <Sparkles size={16} aria-hidden="true" />{" "}
          {busy
            ? "Comparing the current catalog…"
            : plan
              ? "Update my plan"
              : "Build an errand plan"}
        </button>
        {plan && (
          <button
            type="button"
            className={styles.textButton}
            onClick={startNew}
            disabled={working}
          >
            Start a new plan
          </button>
        )}
        <span className={styles.formNote}>
          {plan
            ? "Keep refining the same request."
            : "Planning is read-only. You choose what happens next."}
        </span>
      </div>
      {failure && (
        <div className={styles.error} role="alert">
          <p>{failure}</p>
          {accessError && (
            <p>
              <Link href="/login">Sign in</Link> ·{" "}
              <Link href="/#explore">Explore the marketplace</Link>
            </p>
          )}
        </div>
      )}
      <p className={styles.pending} role="status">
        {busy
          ? "Comparing the current catalog. No order or payment is being made."
          : ""}
      </p>
    </form>
  );

  return (
    <section
      id="sidekick-planner"
      className={styles.shell}
      aria-label="Sidekick Errand Planner"
    >
      <div className={styles.header}>
        <div className={styles.intro}>
          <span className={styles.eyebrow}>
            <Sparkles size={14} aria-hidden="true" /> YOUR LOCAL SIDEKICK
          </span>
          <h2>Plan a little more. Figure out a little less.</h2>
          <p>
            Describe an errand, compare choices from the visible catalog, and
            review a plan that fits.
          </p>
        </div>
        <span className={styles.headerNote}>
          {offline ? "Illustrative catalog" : "Review before acting"}
        </span>
      </div>
      <div className={styles.examples} aria-label="Example errand requests">
        <span>Try a starting point</span>
        {examples.map((example) => (
          <button
            type="button"
            key={example.label}
            disabled={!hydrated || working}
            title={example.message}
            onClick={() => {
              setMessage(example.message);
              composer.current?.focus();
            }}
          >
            {example.label}
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        ))}
      </div>
      {!plan && form}
      {plan && (
        <div
          className={styles.result}
          aria-busy={busy || saving}
          data-plan-status={plan.status}
        >
          <div className={styles.resultHeader}>
            <div>
              <span
                className={styles.provenance}
                data-engine={plan.provenance.engine}
              >
                {plan.provenance.engine === "model" ? (
                  <>
                    <Sparkles size={14} aria-hidden="true" /> AI-assisted plan
                  </>
                ) : (
                  "Catalog suggestions — AI unavailable"
                )}
              </span>
              <h3 ref={resultHeading} tabIndex={-1}>
                {plan.understoodNeed}
              </h3>
            </div>
            <div
              className={styles.constraints}
              aria-label="Interpreted plan constraints"
            >
              {plan.budgetCents !== null && (
                <span>Up to {money(plan.budgetCents)}</span>
              )}
              {plan.constraints.localOnly && (
                <span>
                  <Leaf size={12} aria-hidden="true" /> Locally made
                </span>
              )}
              {plan.constraints.singleVendor && (
                <span>
                  <Store size={12} aria-hidden="true" /> One shop
                </span>
              )}
            </div>
          </div>
          {plan.status === "clarify" && (
            <div
              className={styles.question}
              role="group"
              aria-label="Sidekick clarification"
            >
              <span>ONE DETAIL WILL HELP</span>
              <p>
                {plan.question ||
                  "Could you share a little more about what you need?"}
              </p>
              <p className={styles.small}>
                Answer below and Sidekick will update this request.
              </p>
            </div>
          )}
          {plan.status === "no_match" && (
            <p className={styles.empty}>
              No current combination matches that request. You can change a
              constraint below or review the available suggestions.
            </p>
          )}
          {plan.status !== "clarify" && plan.options.length > 0 && (
            <div className={styles.options}>
              {plan.options.map((option, index) => {
                const remaining =
                  plan.budgetCents !== null
                    ? plan.budgetCents - option.subtotalCents
                    : null;
                const expanded = reviewId === option.id;
                const tripsAreCurrent =
                  now !== null &&
                  option.vendorGroups.length > 0 &&
                  option.vendorGroups.every((group) => {
                    const until = timestamp(group.pickup.validUntil);
                    return (
                      group.pickup.status === "declared_trip" &&
                      until !== null &&
                      until > now
                    );
                  });
                const freshReasons = option.reasons.filter(
                  (reason) =>
                    !/declared[\s-]*trip/i.test(reason) || tripsAreCurrent,
                );
                return (
                  <article
                    className={`${styles.option} ${index === plan.recommendedIndex ? styles.recommended : ""}`}
                    key={option.id}
                    aria-label={`Plan option ${index + 1}`}
                  >
                    <div className={styles.optionTop}>
                      <h4>Option {index + 1}</h4>
                      {index === plan.recommendedIndex &&
                        plan.provenance.engine === "model" && (
                          <span>Suggested</span>
                        )}
                    </div>
                    <ul className={styles.items}>
                      {option.items.map((item) => (
                        <li key={item.listing.id}>
                          <span className={styles.itemEmoji} aria-hidden="true">
                            {item.listing.emoji}
                          </span>
                          <div>
                            <button
                              type="button"
                              className={styles.itemButton}
                              disabled={working}
                              onClick={() =>
                                onReview(item.listing.id, item.quantity)
                              }
                              aria-label={`Review ${item.quantity} × ${item.listing.title}`}
                            >
                              {item.quantity} × {item.listing.title}
                            </button>
                            <small>
                              {item.listing.mode === "SELL"
                                ? `${money(item.listing.price)} each`
                                : "Vendor quote required"}
                              {item.listing.local ? " · Made locally" : ""}
                            </small>
                          </div>
                          <strong>
                            {item.listing.mode === "SELL"
                              ? money(item.lineTotalCents)
                              : "Quote"}
                          </strong>
                        </li>
                      ))}
                    </ul>
                    <div className={styles.optionTotal}>
                      <span>Selected items total</span>
                      <strong>{money(option.subtotalCents)}</strong>
                    </div>
                    {remaining !== null && (
                      <p
                        className={
                          remaining < 0 ? styles.error : styles.budgetFit
                        }
                      >
                        {remaining < 0
                          ? `${money(-remaining)} over the stated budget`
                          : `${money(remaining)} below the stated budget`}
                      </p>
                    )}
                    {freshReasons.length > 0 && (
                      <ul
                        className={styles.reasons}
                        aria-label="Why this option fits"
                      >
                        {freshReasons.map((reason, reasonIndex) => (
                          <li key={reasonIndex}>
                            <Check size={13} aria-hidden="true" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className={styles.shops}>
                      {option.vendorGroups.map((group) => {
                        const until = timestamp(group.pickup.validUntil);
                        const current =
                          until !== null && (now === null || until > now);
                        return (
                          <div className={styles.shop} key={group.vendor.id}>
                            <div>
                              <Store size={14} aria-hidden="true" />
                              <Link href={`/vendors/${group.vendor.id}`}>
                                {group.vendor.name}
                              </Link>
                              <strong>{money(group.subtotalCents)}</strong>
                            </div>
                            {group.vendor.demo && (
                              <small>Fictional demo vendor</small>
                            )}
                            <p>
                              <MapPin size={13} aria-hidden="true" />
                              <span>
                                {pickupText(group.pickup, now, offline)}
                              </span>
                            </p>
                            {group.pickup.status !== "none" &&
                              current &&
                              !offline && (
                                <small>
                                  Window ends{" "}
                                  {new Date(until).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}{" "}
                                  · runner confirmation needed
                                </small>
                              )}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      className={styles.reviewButton}
                      aria-expanded={expanded}
                      aria-controls={
                        expanded ? `${instance}-review` : undefined
                      }
                      disabled={working}
                      onClick={() => {
                        setReviewId(expanded ? null : option.id);
                        setSave(emptySave);
                      }}
                    >
                      Review this option
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
          {reviewed && (
            <section
              className={styles.review}
              id={`${instance}-review`}
              aria-label="Review selected plan"
            >
              <div className={styles.reviewHeader}>
                <div>
                  <span className={styles.eyebrow}>
                    YOUR CHOICES, BEFORE YOU ACT
                  </span>
                  <h3 ref={reviewHeading} tabIndex={-1}>
                    Review your choices
                  </h3>
                </div>
                <ShoppingBag size={24} aria-hidden="true" />
              </div>
              <ul className={styles.reviewItems}>
                {reviewed.items.map((item) => (
                  <li key={item.listing.id}>
                    <span>
                      {item.quantity} × {item.listing.title}
                    </span>
                    <strong>
                      {item.listing.mode === "SELL"
                        ? money(item.lineTotalCents)
                        : "Quote required"}
                    </strong>
                  </li>
                ))}
              </ul>
              <div className={styles.optionTotal}>
                <span>Selected items total</span>
                <strong>{money(reviewed.subtotalCents)}</strong>
              </div>
              <p>
                Other items already in your cart are not included in this total.
                Saving sets these item quantities; it does not reserve stock,
                prepare an order, assign a runner or make a payment.
              </p>
              <p>
                {reviewed.vendorGroups.length > 1
                  ? "This option uses more than one shop. Review and prepare each vendor’s order separately in the cart."
                  : "Review your full cart and delivery address before explicitly preparing this vendor’s order."}
              </p>
              {offline && (
                <p>
                  This is an illustrative catalog. A connected Customer session
                  is needed to save cart choices.
                </p>
              )}
              {reviewed.items.some((item) => item.listing.mode !== "SELL") && (
                <p>
                  Custom work and services need a vendor quote before they can
                  enter a purchase plan. Review those listing details first.
                </p>
              )}
              <div className={styles.reviewActions}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={
                    !hydrated ||
                    working ||
                    offline ||
                    save.kind === "saved" ||
                    reviewed.items.some(
                      (item) => item.listing.mode !== "SELL",
                    ) ||
                    (plan.budgetCents !== null &&
                      reviewed.subtotalCents > plan.budgetCents)
                  }
                  onClick={() => void saveChoices(reviewed)}
                >
                  <ShoppingBag size={16} aria-hidden="true" />
                  {saving
                    ? "Saving choices…"
                    : save.kind === "saved"
                      ? "Choices saved to cart"
                      : "Save these choices to cart"}
                </button>
                {save.savedIds.length > 0 && (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={openCart}
                    disabled={working}
                  >
                    View cart
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              {save.message && (
                <div
                  className={
                    save.kind === "error" ? styles.error : styles.saved
                  }
                  role={save.kind === "error" ? "alert" : "status"}
                >
                  <p>{save.message}</p>
                  {save.accessError && (
                    <p>
                      <Link href="/login">Sign in</Link> ·{" "}
                      <Link href="/#explore">Return to the marketplace</Link>
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
          {plan.options.length === 0 && plan.suggestions.length > 0 && (
            <div
              className={styles.catalogSuggestions}
              aria-label="Catalog suggestions"
            >
              <h4>Available finds to explore</h4>
              {plan.suggestions.map((listing) => (
                <button
                  type="button"
                  key={listing.id}
                  disabled={working}
                  onClick={() => onReview(listing.id, 1)}
                >
                  <span>
                    {listing.emoji} {listing.title}
                  </span>
                  <strong>
                    {listing.mode === "SELL"
                      ? money(listing.price)
                      : "Quote required"}
                  </strong>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
          {plan.notes.length > 0 && (
            <ul className={styles.notes} aria-label="Plan notes">
              {plan.notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          )}
          <details className={styles.explanation}>
            <summary>How this plan was made</summary>
            <p>
              {plan.provenance.engine === "model"
                ? "The model interpreted your request and proposed these choices. The server resolved the choices against the visible catalog and checked quantities, prices and constraints."
                : "This response contains catalog suggestions. A usable model-generated plan was not available for this request."}
            </p>
            {plan.provenance.engine === "model" && plan.provenance.model && (
              <p>Model: {plan.provenance.model}</p>
            )}
            <p>
              Catalog scope: {plan.catalogCompared} compared from{" "}
              {plan.catalogCount} visible listings. Pickup information is a
              snapshot; runner confirmation is required.
            </p>
          </details>
          <div className={styles.followup}>
            <h4>
              {plan.status === "clarify"
                ? "Add that detail"
                : "Keep the plan, change the details"}
            </h4>
            {form}
          </div>
        </div>
      )}
    </section>
  );
}
