import { redirect } from "next/navigation";
import { homeOf, requireSignedIn } from "@/lib/session";

// Staff start on Students, a teacher on their attendance.
export default async function HomePage() {
  redirect(homeOf(await requireSignedIn()));
}
