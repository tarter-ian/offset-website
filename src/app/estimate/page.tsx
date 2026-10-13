import { redirect } from "next/navigation";

// The old footprint wizard, with its own prices and carbon modes. The store on the home page replaced it.
export default function EstimatePage() {
  redirect("/");
}
