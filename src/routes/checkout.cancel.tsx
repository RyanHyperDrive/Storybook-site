import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export const Route = createFileRoute("/checkout/cancel")({
  component: () => (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <XCircle className="mx-auto h-12 w-12 text-muted-foreground" />
      <h1 className="mt-4 font-display text-3xl font-semibold">Checkout cancelled</h1>
      <p className="mt-2 text-muted-foreground">No charge was made. Your draft is saved.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/create/character-sheet"><Button variant="ember">Resume</Button></Link>
        <Link to="/library"><Button variant="outline">My library</Button></Link>
      </div>
    </div>
  ),
});
