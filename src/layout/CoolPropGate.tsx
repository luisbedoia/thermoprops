import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { initCoolProp, isCoolPropLoaded } from "../coolprop";
import { tr } from "../i18n";

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
        {tr(
          "Unable to load CoolProp module.",
          "No se pudo cargar el módulo de CoolProp.",
        )}
      </p>
    );
  return <Loading />;
}

/**
 * The page's name over the wait: the built page's heading for search
 * engines, which read it before the app starts (the page's own replaces it).
 */
function pageName(pathname: string) {
  const page = pathname.replace(/\/+$/, "").split("/").pop();
  if (page === "worksheet") return tr("Worksheet", "Hoja de trabajo");
  if (page === "explorer" || page === "settings")
    return tr("State Explorer", "Explorador de estados");
  return null;
}

function Loading() {
  const name = pageName(useLocation().pathname);
  return (
    <div className="app-loader">
      {name && <h1 className="app-loader__title">{name}</h1>}
      <p role="status">
        {tr("Loading calculator…", "Cargando la calculadora…")}
      </p>
    </div>
  );
}
