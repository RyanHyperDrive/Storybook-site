import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-paper/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4">
        <div>
          <div className="font-display text-lg font-semibold">StoryNest</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Personalized illustrated storybooks made with parents, for the kids who matter most.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold">Product</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/create" className="hover:text-foreground">Create a book</Link></li>
            <li><Link to="/pricing" className="hover:text-foreground">Pricing</Link></li>
            <li><Link to="/library" className="hover:text-foreground">Library</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold">Trust</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link to="/terms" className="hover:text-foreground">Terms</Link></li>
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-sage" /> Made with care
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Photos used for character creation are private to your account and never sold or used to train models.
          </p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} StoryNest. All rights reserved.
      </div>
    </footer>
  );
}
