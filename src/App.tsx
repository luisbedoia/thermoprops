import { useEffect, useState } from "react";
import { CP } from "./coolprop";
import { AppRouter } from "./Router";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const loadCoolProp = async () => {
      if (window.CP) {
        setLoading(false);
        return;
      }

      try {
        window.CP = await CP();
        setLoading(false);
        setError(null);
      } catch (error) {
        console.error("Error loading library", error);
        setError("Unable to load CoolProp module.");
        setLoading(false);
      }
    };

    void loadCoolProp();
  }, []);

  if (loading) {
    return <div className="app-loader">Loading library...</div>;
  }

  if (error) {
    return <div className="app-loader error">{error}</div>;
  }
  return <AppRouter />;
}
