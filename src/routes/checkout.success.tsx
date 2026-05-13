import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/checkout/success")({
  component: () => (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-sage" />
      <h1 className="mt-4 font-display text-3xl font-semibold">Payment received</h1>
      <p className="mt-2 text-muted-foreground">Your book is being generated. We'll email you when it's ready.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/library"><Button variant="ember">Go to library</Button></Link>
      </div>
    </div>
  ),
});
