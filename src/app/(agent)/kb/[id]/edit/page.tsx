import { PageHead } from "@/components/ui";
import { requireAgent } from "@/lib/auth";

export const metadata = { title: "Edit article" };

// S17: stub from the shell step; built in its own commit.
export default async function Page() {
  await requireAgent();
  return <PageHead title="Edit article" intro="Coming in the next build step." />;
}
