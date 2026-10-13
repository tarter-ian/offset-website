import { redirect } from "next/navigation";

// The old "Link your accounts" page. Counting real use now starts on the home page.
export default function StartPage() {
  redirect("/");
}
