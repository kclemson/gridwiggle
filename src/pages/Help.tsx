import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const Help = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto w-full">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-3 px-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-medium tracking-wide">
              <span className="text-muted-foreground">grid</span>
              <span className="text-primary">wiggle</span>
            </h1>
          </div>
        </header>

        <main className="py-6 px-4 space-y-6">
          <h2 className="text-xl font-semibold text-foreground">How It Works</h2>
          <ul className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <li>
              Create a great-looking photo collage in seconds — just upload your photos and hit shuffle.
            </li>
            <li>
              Upload as many photos as you like. There's no limit.
            </li>
            <li>
              Photos with people are automatically cropped to keep faces in frame. You can fine-tune the crop on any photo by tapping it.
            </li>
            <li>
              Mark one or two photos as a "hero" using the star icon to give them extra prominence in the layout.
            </li>
            <li>
              Tap the shuffle button to generate a new layout. Keep going until you find one you love.
            </li>
            <li>
              When you're happy, tap download to save your collage as a PNG.
            </li>
          </ul>
        </main>
      </div>
    </div>
  );
};

export default Help;
