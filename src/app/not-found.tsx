import { Card, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface p-6">
      <Card className="max-w-sm space-y-3 text-center">
        <h1 className="text-xl">Not found</h1>
        <p className="text-muted">That page doesn't exist, or you don't have access to it.</p>
        <LinkButton href="/" variant="primary">
          Go home
        </LinkButton>
      </Card>
    </main>
  );
}
