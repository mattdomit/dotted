"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="text-4xl font-bold text-destructive">Oops</div>
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-center text-muted-foreground">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try Again
      </button>
    </div>
  );
}
