import { Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { initCoolProp, isCoolPropLoaded } from "../coolprop";

type Status = "loading" | "ready" | "error";

/**
 * The pages that compute (the State Explorer and the Worksheet) wait here
 * for CoolProp, and for their own code; the landing does not, so it shows
 * at once.
 */
export function CoolPropGate() {
  const [status, setStatus] = useState<Status>(() =>
    isCoolPropLoaded() ? "ready" : "loading",
  );

  useEffect(() => {
    if (status !== "loading") return;
    let live = true;
    initCoolProp().then(
      () => live && setStatus("ready"),
      (error: unknown) => {
        console.error("Error loading library", error);
        if (live) setStatus("error");
      },
    );
    return () => {
      live = false;
    };
  }, [status]);

  if (status === "ready")
    return (
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    );
  if (status === "error")
    return (
      <p className="app-loader error" role="status">
        Unable to load CoolProp module.
      </p>
    );
  return <Loading />;
}

function Loading() {
  return (
    <p className="app-loader" role="status">
      Loading calculator…
    </p>
  );
}
