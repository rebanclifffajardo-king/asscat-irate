"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-md bg-white p-8 text-center shadow-card">
      <AlertTriangle className="mx-auto h-10 w-10 text-lte-warning" aria-hidden />
      <h1 className="mt-3 text-lg font-semibold text-gray-900">Something went wrong</h1>
      <p className="mt-1 text-sm text-gray-600">
        The page could not be loaded. Please try again. If the problem persists, contact the system administrator.
      </p>
      {error.digest && <p className="mt-2 text-xs text-gray-400">Reference: {error.digest}</p>}
      <Button className="mt-5" onClick={reset}>Try again</Button>
    </div>
  );
}
