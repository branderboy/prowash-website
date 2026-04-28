export const dynamic = "force-dynamic";

export default function CheckoutSuccessPage({ searchParams }: { searchParams: { session_id?: string } }) {
  return (
    <section className="section-padding">
      <div className="container" style={{ maxWidth: 640, textAlign: "center", padding: "4rem 1rem" }}>
        <h1>Thank you!</h1>
        <p style={{ marginTop: "1rem" }}>
          Your order has been received. You'll get an email confirmation from Stripe shortly.
        </p>
        {searchParams.session_id ? (
          <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#666" }}>
            Reference: <code>{searchParams.session_id}</code>
          </p>
        ) : null}
        <a href="/shop" className="btn-add-cart" style={{ display: "inline-block", marginTop: "2rem" }}>
          Back to shop
        </a>
      </div>
    </section>
  );
}
