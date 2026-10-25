import { redirect } from "next/navigation";
import { isAgent } from "@/lib/access";
import { currentUser } from "@/lib/auth";

export default async function Home() {
  const user = await currentUser();
  redirect(!user ? "/login" : isAgent(user) ? "/queues" : "/portal");
}
