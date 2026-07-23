import { redirect } from "next/navigation";
import { destinationFor, getAccessProfile } from "@/lib/auth/session";

export default async function HomePage() {
  const profile = await getAccessProfile();
  redirect(destinationFor(profile));
}
