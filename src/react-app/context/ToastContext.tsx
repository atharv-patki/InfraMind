import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Info, XCircle } from "lucide-react";
import { cn } from "@/react-app/lib/utils";

type ToastTone = "success" | "error" | "warning" | "info";

type ToastItem = {
  id: string;
  title: string;
  tone: ToastTone;
};

type ToastContextValue = {
  pushToast: (title: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const pushToast = useCallback((title: string, tone: ToastTone = "info") => {
    const id = `toast-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    setItems((prev) => [...prev, { id, title, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 2600);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast,
    }),
    [pushToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-20 right-4 z-[70] space-y-2 w-80 max-w-[calc(100vw-2rem)]">
        {items.map((item) => (
          <article
            key={item.id}
            className={cn(
              "rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md text-sm flex items-center gap-2",
              item.tone === "success" && "border-success/30 bg-success/15 text-success",
              item.tone === "error" && "border-destructive/30 bg-destructive/15 text-destructive",
              item.tone === "warning" && "border-warning/30 bg-warning/20 text-warning",
              item.tone === "info" && "border-primary/30 bg-primary/15 text-primary"
            )}
          >
            {item.tone === "success" ? <CheckCircle2 className="w-4 h-4" /> : null}
            {item.tone === "error" ? <XCircle className="w-4 h-4" /> : null}
            {item.tone === "warning" ? <CircleAlert className="w-4 h-4" /> : null}
            {item.tone === "info" ? <Info className="w-4 h-4" /> : null}
            <span>{item.title}</span>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }
  return context;
}
