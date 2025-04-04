import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Input } from "./Input";
import { Result } from "./Result";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/input" />} />
        <Route path="/input" element={<Input />} />
        <Route path="/result" element={<Result />} />
      </Routes>
    </BrowserRouter>
  );
}
