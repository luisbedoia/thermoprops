import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import "./AppLayout.css";

export function AppLayout() {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand-title">Thermoprops</span>
        <Button
          variant="subtle"
          size="sm"
          className="about-button"
          onClick={() => setShowAbout(true)}
        >
          About
        </Button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>Powered by CoolProp WASM</span>
      </footer>
      <Modal
        isOpen={showAbout}
        onClose={() => setShowAbout(false)}
        ariaLabelledby="about-title"
        className="about-modal"
        contentClassName="about-modal__content"
      >
        <header className="about-modal__header">
          <h2 id="about-title">About Thermoprops</h2>
          <Button
            variant="plain"
            className="about-modal__close"
            onClick={() => setShowAbout(false)}
            aria-label="Close about dialog"
          >
            X
          </Button>
        </header>
        <div className="about-modal__body">
          <p>
            Thermoprops is a lightweight interface over CoolProp WASM that helps
            you explore thermodynamic states.
          </p>
        </div>
      </Modal>
    </div>
  );
}
