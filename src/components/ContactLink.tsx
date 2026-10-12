import { CONTACT_EMAIL, CONTACT_FALLBACK } from "@/lib/contact";

/** "email us at x" when there's an address, otherwise Ian's site. */
export function ContactLink() {
  return CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">
      {CONTACT_EMAIL}
    </a>
  ) : (
    <a href={CONTACT_FALLBACK.href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      {CONTACT_FALLBACK.text}
    </a>
  );
}
