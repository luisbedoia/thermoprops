import { useEffect, useState } from "react";
import CP from "./coolprop/coolprop.js";
import { AppRouter } from "./Router";

export default function App() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const loadCoolProp = async () => {
      if (window.CP) {
        setLoading(false);
        return;
      }

      try {
        window.CP = await CP();
        setLoading(false);
      } catch (error) {
        console.error("Error loading library", error);
      }
    };

    loadCoolProp();
  });

  if (loading) {
    return <div>Loading library...</div>;
  }
  return <AppRouter />;
}
