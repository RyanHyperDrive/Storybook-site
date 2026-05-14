import { Link } from "@tanstack/react-router";
import { Mail, ShieldCheck } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-paper/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-4">
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
            <li><a href="/#faq" className="hover:text-foreground">FAQ</a></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold">Trust</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/privacy" className="hover:text-foreground">Privacy</Link></li>
            <li><Link to="/terms" className="hover:text-foreground">Terms</Link></li>
            <li className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              <a href="mailto:hello@storynest.app" className="hover:text-foreground">hello@storynest.app</a>
            </li>
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
      <div className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        <p>
          Stories and illustrations are created with AI and reviewed through parent approval and quality checks.
        </p>
        <p className="mt-1">© {new Date().getFullYear()} StoryNest. All rights reserved.</p>
      </div>
    </footer>
  );
}
