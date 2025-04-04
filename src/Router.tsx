import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Input } from "./Input";
import { ResultView } from "./Result";

export function AppRouter() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Navigate to="/input" />} />
        <Route path="/input" element={<Input />} />
        <Route path="/result" element={<ResultView />} />
      </Routes>
    </BrowserRouter>
  );
}
