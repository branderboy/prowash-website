"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    findLocation?: () => void;
    toggleFaq?: (btn: HTMLElement) => void;
  }
}

const ZIP_LOCATIONS = [
  { name: "Capitol Heights, MD", address: "29 Hampton Park Blvd, Capitol Heights, MD 20743", link: "/locations/capitol-heights", zips: ["20743","20744","20785","20747","20781","20782","20784","20710","20737"] },
  { name: "Clinton, MD",         address: "6311 Coventry Way, Clinton, MD 20735",            link: "/locations/clinton",         zips: ["20735","20748","20762","20745","20746","20744","20373","20388"] },
  { name: "Bowie, MD",           address: "4406 Crain Highway, Bowie, MD 20716",             link: "/locations/bowie",           zips: ["20716","20715","20720","20721","21114","20706","20770","20707","20708"] },
  { name: "Upper Marlboro, MD",  address: "7538 Crain Highway, Upper Marlboro, MD 20772",    link: "/locations/upper-marlboro",  zips: ["20772","20774","20613","20623","20769"] },
  { name: "Washington, DC",      address: "Washington, DC",                                  link: "/locations/washington-dc",   zips: ["20019","20020","20032","20002","20003","20017","20018","20001","20024","20037"] },
];

export function PageBehaviors() {
  useEffect(() => {
    // 1) Reveal on scroll — the seeded markup uses .reveal { opacity:0 } and
    //    expects an .active class to fade in. Without this observer the entire
    //    page renders blank.
    const revealEls = document.querySelectorAll<HTMLElement>(".reveal");
    let observer: IntersectionObserver | null = null;
    if (revealEls.length > 0) {
      if ("IntersectionObserver" in window) {
        observer = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (e.isIntersecting) {
                e.target.classList.add("active");
                observer?.unobserve(e.target);
              }
            }
          },
          { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
        );
        revealEls.forEach((el) => observer!.observe(el));
      } else {
        revealEls.forEach((el) => el.classList.add("active"));
      }
    }

    // 2) FAQ accordions — the seed uses onclick="toggleFaq(this)". Define it.
    const toggleFaq = (btn: HTMLElement) => {
      btn.parentElement?.classList.toggle("open");
    };
    window.toggleFaq = toggleFaq;
    const faqClick = (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      const btn = target?.closest<HTMLElement>(".faq-question");
      if (btn) toggleFaq(btn);
    };
    document.addEventListener("click", faqClick);

    // 3) Booking page — service tabs (data-svc) and location tabs (data-loc).
    const onTabClick = (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      const svcBtn = target?.closest<HTMLElement>(".svc-btn[data-svc]");
      if (svcBtn) {
        const key = svcBtn.dataset.svc;
        document.querySelectorAll(".svc-btn").forEach((b) => b.classList.remove("active"));
        svcBtn.classList.add("active");
        document.querySelectorAll<HTMLElement>(".svc-panel").forEach((p) => {
          p.classList.toggle("active", p.id === `svc-${key}`);
        });
        return;
      }
      const locBtn = target?.closest<HTMLElement>(".loc-tab[data-loc]");
      if (locBtn) {
        const key = locBtn.dataset.loc;
        document.querySelectorAll(".loc-tab").forEach((b) => b.classList.remove("active"));
        locBtn.classList.add("active");
        document.querySelectorAll<HTMLElement>(".embed-panel").forEach((p) => {
          const matches = p.id === `embed-${key}`;
          p.classList.toggle("active", matches);
          if (matches) {
            const iframe = p.querySelector<HTMLIFrameElement>("iframe[data-src]");
            if (iframe && iframe.dataset.src && iframe.src !== iframe.dataset.src) {
              iframe.src = iframe.dataset.src;
            }
          }
        });
        return;
      }
    };
    document.addEventListener("click", onTabClick);

    // 4) Home page zip-code locator. Wires up `findLocation()` global so the
    //    legacy onclick handler in the seeded HTML keeps working.
    const findLocation = () => {
      const input = document.getElementById("zipInput") as HTMLInputElement | null;
      if (!input) return;
      const zip = input.value.trim();
      if (!zip || zip.length < 5) return;
      let found = ZIP_LOCATIONS.find((l) => l.zips.includes(zip)) || null;
      if (!found) {
        const zipNum = parseInt(zip, 10);
        if (zipNum >= 20000 && zipNum <= 20099) {
          found = ZIP_LOCATIONS[4];
        } else if (zipNum >= 20700 && zipNum <= 20799) {
          const centers: Array<[typeof ZIP_LOCATIONS[number], number]> = [
            [ZIP_LOCATIONS[0], 20743],
            [ZIP_LOCATIONS[1], 20735],
            [ZIP_LOCATIONS[2], 20716],
            [ZIP_LOCATIONS[3], 20772],
          ];
          centers.sort((a, b) => Math.abs(zipNum - a[1]) - Math.abs(zipNum - b[1]));
          found = centers[0][0];
        } else {
          found = ZIP_LOCATIONS[0];
        }
      }
      const name = document.getElementById("resultName");
      const addr = document.getElementById("resultAddress");
      const link = document.getElementById("resultLink") as HTMLAnchorElement | null;
      const result = document.getElementById("zipResult") as HTMLElement | null;
      if (name) name.textContent = `Your closest location: ${found.name}`;
      if (addr) addr.textContent = found.address;
      if (link) link.href = found.link;
      if (result) result.style.display = "block";
    };
    window.findLocation = findLocation;
    const zipInput = document.getElementById("zipInput");
    const onZipKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") findLocation();
    };
    zipInput?.addEventListener("keypress", onZipKey);

    return () => {
      observer?.disconnect();
      document.removeEventListener("click", faqClick);
      document.removeEventListener("click", onTabClick);
      zipInput?.removeEventListener("keypress", onZipKey);
      delete window.toggleFaq;
      delete window.findLocation;
    };
  }, []);

  return null;
}
