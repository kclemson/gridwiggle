import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LayoutRating from "./pages/LayoutRating";
import V3Test from "./pages/V3Test";
import { remoteLogger } from "@/lib/remoteLogger";

const queryClient = new QueryClient();

const App = () => {
  // Global safety net for unhandled promise rejections - sends to remote logging
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      remoteLogger.error("unhandled", "Promise rejection", {
        reason: event.reason?.message ?? String(event.reason),
        stack: event.reason?.stack,
      });
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => window.removeEventListener("unhandledrejection", handleRejection);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            {/* DEV-ONLY: Layout tools for algorithm tuning */}
            {import.meta.env.DEV && (
              <>
                <Route path="/layout-rating" element={<LayoutRating />} />
                <Route path="/v3-test" element={<V3Test />} />
              </>
            )}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
