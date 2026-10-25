import { PageHead } from "@/components/ui";
import { requireAgent } from "@/lib/auth";

export const metadata = { title: "Post-incident review" };

// S12: stub from the shell step; built in its own commit.
export default async function Page() {
  await requireAgent();
  return <PageHead title="Post-incident review" intro="Coming in the next build step." />;
}
