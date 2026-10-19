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
import { CoolPropGate } from "./layout/CoolPropGate";

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

/** The pages, under whichever router renders them (the browser's or the build's). */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Landing />} />
        <Route element={<CoolPropGate />}>
          {/* The State Explorer: a fluid and units, then its states. */}
          <Route path="/explorer" element={<SettingsView />} />
          {/* Legacy path kept for existing links and QR codes. */}
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/workspace" element={<WorkspaceView />} />
          <Route path="/worksheet" element={<ScriptView />} />
        </Route>
        <Route path="/script" element={<ScriptRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
