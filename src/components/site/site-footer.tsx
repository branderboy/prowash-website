import type { FooterMenuColumn } from "@/lib/site/load";

type Props = {
  menu: FooterMenuColumn[] | null;
  primaryPhone: string | null;
};

export function SiteFooter({ menu, primaryPhone }: Props) {
  const year = new Date().getFullYear();
  const phone = primaryPhone || "(301) 307-1414";
  const cols = menu && menu.length > 0
    ? menu
    : [
        { heading: "QUICK LINKS", items: [
          { label: "All Services", href: "/services" },
          { label: "Car Wash", href: "/services/car-wash" },
          { label: "Car Detailing", href: "/services/car-detailing" },
          { label: "Window Tinting", href: "/services/window-tinting" },
        ] },
        { heading: "COMPANY", items: [
          { label: "About Us", href: "/about" },
          { label: "Book A Car Detailing Appt.", href: "/book" },
          { label: "FAQ", href: "/faq" },
        ] },
      ];

  return (
    <footer>
      <div className="container">
        <div className="footer-grid">
          <div>
            <span className="footer-logo"><img src="/images/logo.png" alt="Hand Car Wash & Car Detail Logo" /></span>
            <p>Built to set the standard in auto care with hand car wash, auto detailing, mobile service, and fleet washing.</p>
          </div>
          {cols.map((col) => (
            <div className="footer-col" key={col.heading}>
              <h5>{col.heading.toUpperCase()}</h5>
              <ul className="footer-links">
                {col.items.map((it) => (
                  <li key={it.href}><a href={it.href}>{it.label}</a></li>
                ))}
              </ul>
            </div>
          ))}
          <div className="footer-col">
            <h5>CONTACT US</h5>
            <div className="f-contact-item">
              <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              <div><span>Phone Number</span><strong>{phone}</strong></div>
            </div>
            <div className="f-contact-item">
              <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
              <div><span>Working Hours</span><strong>Mon-Sat 8am - 6pm</strong></div>
            </div>
          </div>
        </div>
        <div className="footer-bottom"><p>&copy; {year} Hand Car Wash &amp; Car Detail. All Rights Reserved.</p></div>
      </div>
    </footer>
  );
}
