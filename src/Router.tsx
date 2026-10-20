import { lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { Landing } from "./landing/Landing";
import { Home } from "./home/Home";
import { useInstalled } from "./lib/installed";
import { CoolPropGate } from "./layout/CoolPropGate";
import { landingPath } from "./i18n";
import { FluidIndex } from "./fluids/FluidIndex";
import { FluidPage } from "./fluids/FluidPage";

// Each mode's code loads only when one of its pages is opened, so the
// landing carries neither (the worksheet's editor is CodeMirror).
const SettingsView = lazy(() =>
  import("./Input").then((m) => ({ default: m.SettingsView })),
);
const WorkspaceView = lazy(() =>
  import("./Result").then((m) => ({ default: m.WorkspaceView })),
);
const ScriptView = lazy(() =>
  import("./script/ScriptView").then((m) => ({ default: m.ScriptView })),
);

/** The worksheet's first address: its link, script (?s=) and all, still opens. */
export function ScriptRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "/worksheet", search }} replace />;
}

/**
 * "/": the website's landing in a browser; the installed app's home in the
 * app (which index.html sends to /home before its first paint).
 */
function Root() {
  // Also when the page turns into the app while on it (installed from here).
  const installed = useInstalled();
  return installed ? <Navigate to="/home" replace /> : <Landing />;
}

/** The pages, under whichever router renders them (the browser's or the build's). */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Root />} />
        {/* The landing in Spanish, with its own address for search engines. */}
        <Route path="/es" element={<Root />} />
        <Route path="/home" element={<Home />} />
        {/* Each fluid's properties, in each language: for search engines. */}
        <Route path="/fluids" element={<FluidIndex />} />
        <Route path="/fluids/:slug" element={<FluidPage />} />
        <Route path="/es/fluidos" element={<FluidIndex />} />
        <Route path="/es/fluidos/:slug" element={<FluidPage />} />
        <Route element={<CoolPropGate />}>
          {/* The State Explorer: a fluid and units, then its states. */}
          <Route path="/explorer" element={<SettingsView />} />
          {/* Legacy path kept for existing links and QR codes. */}
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/workspace" element={<WorkspaceView />} />
          <Route path="/worksheet" element={<ScriptView />} />
        </Route>
        <Route path="/script" element={<ScriptRedirect />} />
        <Route path="*" element={<Navigate to={landingPath()} replace />} />
      </Route>
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  );
}
