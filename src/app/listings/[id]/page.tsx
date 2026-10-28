import Image from "next/image";
import ReportListing from "@/components/ReportListing";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicCatalog } from "@/lib/server/catalog";
import { money } from "@/lib/catalog";
import ListingActions, {
  type ListingAccess,
} from "@/components/ListingActions";
import { authenticated, HttpError } from "@/lib/server/db";
export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await publicCatalog();
  const l = data.listings.find((l) => l.id === id);
  if (!l) notFound();
  const vendor = data.vendors.find((v) => v.id === l.vendorId)!;
  let access: ListingAccess = data.demo ? "offline" : "guest";
  let initialQuantity = 1;
  let inCart = false;
  if (!data.demo) {
    try {
      const { client, user } = await authenticated(true);
      const role = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "customer")
        .eq("status", "approved")
        .maybeSingle();
      if (role.error) throw role.error;
      access = role.data ? "customer" : "other";
      if (access === "customer" && l.mode === "SELL") {
        const cart = await client
          .from("cart_items")
          .select("quantity")
          .eq("customer_id", user.id)
          .eq("listing_id", l.id)
          .maybeSingle();
        if (cart.error) throw cart.error;
        if (cart.data) {
          initialQuantity = cart.data.quantity;
          inCart = true;
        }
      }
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) access = "guest";
      else if (error instanceof HttpError && error.status === 403)
        access = "other";
      else throw error;
    }
  }
  return (
    <main className="simple-page">
      <Link href="/">← Explore your town</Link>
      <div className="modal-emoji">
        {l.photos?.[0] ? (
          <Image src={l.photos[0]} alt={l.title} width={600} height={400} />
        ) : (
          l.emoji
        )}
      </div>
      <div className="eyebrow">
        {vendor.demo ? "FICTIONAL DEMO VENDOR" : "MARKETPLACE VENDOR"} ·{" "}
        {l.mode}
      </div>
      <h1>{l.title}</h1>
      <p>{l.description}</p>
      <h2>
        {l.mode === "SELL"
          ? `${money(l.price)} · ${l.inventory} available`
          : "Quote required"}
      </h2>
      <p>
        <Link href={`/vendors/${vendor.id}`}>{vendor.name} →</Link>
      </p>
      <ListingActions
        key={l.id}
        listing={l}
        access={access}
        privateDemo={Boolean(data.isolatedDemo)}
        initialQuantity={initialQuantity}
        inCart={inCart}
      />
      {!data.demo && <ReportListing id={l.id} />}
    </main>
  );
}
