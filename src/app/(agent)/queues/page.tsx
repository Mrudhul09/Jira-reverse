import { redirect } from "next/navigation";
import { requireAgent } from "@/lib/auth";
import { queuesFor } from "@/lib/queues";

export default async function Queues({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAgent();
  const sp = await searchParams;
  const queues = queuesFor(user.id);
  const first = queues.find((q) => q.starred) ?? queues[0];
  const pass = new URLSearchParams();
  for (const k of ["ok", "error"]) if (sp[k]) pass.set(k, sp[k]!);
  redirect(first ? `/queues/${first.id}${pass.size ? `?${pass}` : ""}` : "/queues/new");
}
