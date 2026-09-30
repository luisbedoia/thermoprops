import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SettingsView } from "./Input";
import { WorkspaceView } from "./Result";
import { AppLayout } from "./layout/AppLayout";

export function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<SettingsView />} />
          {/* Legacy path kept for existing links and QR codes. */}
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/workspace" element={<WorkspaceView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
