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
            <li>Upload your photos and a collage is generated automatically. Tap shuffle to try a new layout.</li>
            <li>Photos with people are automatically cropped to keep faces in frame. Tap any photo to fine-tune its crop or remove it.</li>
            <li>Mark one or two photos as a "hero" using the star icon to give them extra prominence in the layout.</li>
            <li>Drag photos in the collage to swap their positions.</li>
            <li>With 10 or more photos, use the shape slider to push the collage toward portrait, square, or landscape.</li>
            <li>Adjust spacing, colors, and other settings below the collage.</li>
            <li>Tap the download button to save your collage as a high-resolution PNG.</li>
            <li>Your photos and collage are saved locally in your browser so you can pick up where you left off.</li>
          </ul>
        </main>
      </div>
    </div>
  );
};

export default Help;
