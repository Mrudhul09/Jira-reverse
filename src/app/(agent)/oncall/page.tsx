import { PageHead } from "@/components/ui";
import { requireAgent } from "@/lib/auth";

export const metadata = { title: "On call" };

// S21: stub from the shell step; built in its own commit.
export default async function Page() {
  await requireAgent();
  return <PageHead title="On call" intro="Coming in the next build step." />;
}
