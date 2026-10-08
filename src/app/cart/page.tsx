import Link from "next/link";
import { redirect } from "next/navigation";
import { authenticated } from "@/lib/server/db";
import CartView from "@/components/CartView";
import { demoAddress } from "@/lib/demo-catalog";
export default async function Cart() {
  let actor;
  try {
    actor = await authenticated(true);
  } catch {
    redirect("/login");
  }
  const { client, user, profile } = actor;
  const { data: cart, error } = await client
    .from("cart_items")
    .select("listing_id,quantity")
    .eq("customer_id", user.id);
  if (error) throw error;
  const ids = (cart || []).map((i) => i.listing_id);
  const { data: products, error: productError } = ids.length
    ? await client
        .from("listings")
        .select("id,title,price_cents,inventory,vendor_id")
        .in("id", ids)
    : { data: [], error: null };
  if (productError) throw productError;
  const vendorIds = [...new Set((products || []).map((l) => l.vendor_id))];
  const { data: vendors } = vendorIds.length
    ? await client.from("vendors").select("id,name").in("id", vendorIds)
    : { data: [] };
  const { data: preferences } = await client
    .from("customer_preferences")
    .select("delivery_address")
    .eq("customer_id", user.id)
    .maybeSingle();
  const rows = (cart || []).map((i) => {
    const l = products?.find((l) => l.id === i.listing_id);
    return {
      ...i,
      title: l?.title || "Unavailable item",
      price: Number(l?.price_cents || 0),
      inventory: l?.inventory || 0,
      vendorId: l?.vendor_id || "unavailable",
      vendorName:
        vendors?.find((v) => v.id === l?.vendor_id)?.name ||
        "Unavailable vendor",
    };
  });
  return (
    <main className="simple-page">
      <Link href="/">← Explore</Link>
      <h1>Your cart.</h1>
      <CartView
        items={rows}
        initialAddress={
          profile.demo_workspace
            ? demoAddress
            : preferences?.delivery_address || ""
        }
        demo={Boolean(profile.demo_workspace)}
      />
    </main>
  );
}
