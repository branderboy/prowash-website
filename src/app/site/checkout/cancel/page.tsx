export default function CheckoutCancelPage() {
  return (
    <section className="section-padding">
      <div className="container" style={{ maxWidth: 640, textAlign: "center", padding: "4rem 1rem" }}>
        <h1>Checkout cancelled</h1>
        <p style={{ marginTop: "1rem" }}>No charge was made. You can return to the shop and try again.</p>
        <a href="/shop" className="btn-add-cart" style={{ display: "inline-block", marginTop: "2rem" }}>
          Back to shop
        </a>
      </div>
    </section>
  );
}
