"use client";
import { useEffect, useState } from "react";
import type { HeaderMenuItem } from "@/lib/site/load";

type Props = {
  menu: HeaderMenuItem[] | null;
  primaryPhone: string | null;
};

export function SiteHeader({ menu, primaryPhone }: Props) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const phone = primaryPhone || "(301) 307-1414";

  return (
    <>
      <div className="accent-stripe" />

      <div className="top-bar">
        <div className="container top-bar-inner">
          <span className="top-bar-item desktop-only">
            <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            {" "}Serving Washington DC &amp; Maryland
          </span>
          <span className="top-bar-item">
            <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
            {" "}Facility Hours: Mon-Sat 8 AM - 6 PM
          </span>
          <span className="top-bar-item desktop-only">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            {" "}Walk-Ins &amp; Appointments Welcome
          </span>
          <span className="top-bar-item">
            <svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
            {" "}{phone}
          </span>
        </div>
      </div>

      <header id="header" className={scrolled ? "scrolled" : ""}>
        <div className="container nav-container">
          <div className="logo-area">
            <a href="/"><img src="/images/logo.png" alt="Hand Car Wash & Car Detail Logo" /></a>
          </div>
          <button className="mobile-menu-btn" onClick={() => setOpen((v) => !v)} aria-label="Open menu">
            <svg viewBox="0 0 24 24" width="28" height="28"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
          </button>
          <nav
            className="nav-links"
            id="navLinks"
            style={
              open
                ? { display: "flex", flexDirection: "column", position: "absolute", top: "100%", left: 0, width: "100%", background: "#fff", padding: 20, boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }
                : undefined
            }
          >
            {menu && menu.length > 0 ? menu.map((item, i) => {
              if (item.children && item.children.length > 0) {
                return (
                  <div className="nav-dropdown" key={`${item.label}-${i}`}>
                    {item.href && item.href !== "#" ? (
                      <a href={item.href} className="nav-item dropdown-toggle">{item.label}</a>
                    ) : (
                      <span className="nav-item dropdown-toggle">{item.label}</span>
                    )}
                    <div className="dropdown-menu">
                      {item.children.map((c) => (
                        <a key={c.href} href={c.href}>{c.label}</a>
                      ))}
                    </div>
                  </div>
                );
              }
              const cls = item.style === "cta" ? "btn btn-red" : "nav-item";
              return (
                <a key={`${item.label}-${i}`} href={item.href} className={cls}>{item.label}</a>
              );
            }) : (
              <>
                <a href="/" className="nav-item">Home</a>
                <a href="/services" className="nav-item">Services</a>
                <a href="/locations" className="nav-item">Locations</a>
                <a href="/shop" className="nav-item">Shop</a>
                <a href="/faq" className="nav-item">FAQ</a>
                <a href="/book" className="btn btn-red">Book Now</a>
              </>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
