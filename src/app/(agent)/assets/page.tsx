import { PageHead } from "@/components/ui";
import { requireAgent } from "@/lib/auth";

export const metadata = { title: "Assets" };

// S19: stub from the shell step; built in its own commit.
export default async function Page() {
  await requireAgent();
  return <PageHead title="Assets" intro="Coming in the next build step." />;
}
