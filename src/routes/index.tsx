import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GlobeCanvas } from "@/components/globe/globe-canvas";
import { Hud } from "@/components/overlay/hud";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 20_000,
    },
  },
});

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <QueryClientProvider client={queryClient}>
      <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
        {ready ? <GlobeCanvas /> : <div className="absolute inset-0 bg-bg" aria-hidden />}
        <Hud />
      </main>
    </QueryClientProvider>
  );
}

