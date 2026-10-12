// How people reach a person. Set NEXT_PUBLIC_CONTACT_EMAIL once there's an address on the site's own domain.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "";
export const CONTACT_FALLBACK = { href: "https://iantarter.com", text: "iantarter.com" };
