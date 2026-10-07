import { Outlet } from "react-router-dom";
import { Info, X } from "lucide-react";
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
          <Info />
          About
        </Button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>
          Properties by{" "}
          <a href="https://coolprop.org" target="_blank" rel="noopener noreferrer">
            CoolProp
          </a>
          {" · "}WebAssembly via{" "}
          <a
            href="https://github.com/luisbedoia/coolprop-rs"
            target="_blank"
            rel="noopener noreferrer"
          >
            coolprop-rs
          </a>
        </span>
        <span className="app-version">{import.meta.env.VITE_APP_VERSION}</span>
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
            <X />
          </Button>
        </header>
        <div className="about-modal__body">
          <p>
            Thermoprops is a free calculator to explore thermodynamic states and
            property diagrams of fluids and refrigerants.
          </p>
          <p>
            Every property is computed by{" "}
            <a href="https://coolprop.org" target="_blank" rel="noopener noreferrer">
              CoolProp
            </a>
            , the open-source thermophysical property library created by Ian Bell
            and the CoolProp contributors. If you use these results in academic
            work, please cite:
          </p>
          <blockquote className="about-modal__citation">
            Bell, I. H.; Wronski, J.; Quoilin, S.; Lemort, V. Pure and
            Pseudo-pure Fluid Thermophysical Property Evaluation and the
            Open-Source Thermophysical Property Library CoolProp.{" "}
            <i>Ind. Eng. Chem. Res.</i> <b>2014</b>, 53 (6), 2498–2508.{" "}
            <a
              href="https://doi.org/10.1021/ie4033999"
              target="_blank"
              rel="noopener noreferrer"
            >
              doi:10.1021/ie4033999
            </a>
          </blockquote>
          <p>
            CoolProp runs in your browser as WebAssembly through{" "}
            <a
              href="https://github.com/luisbedoia/coolprop-rs"
              target="_blank"
              rel="noopener noreferrer"
            >
              coolprop-rs
            </a>
            , a thin layer that makes it easier to use on the web.
          </p>
          <p>
            Developed by the Department of Mechanical Engineering, Universidad de
            Antioquia.{" "}
            <a
              href="https://github.com/luisbedoia/thermoprops"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source code
            </a>
            .
          </p>
        </div>
      </Modal>
    </div>
  );
}
