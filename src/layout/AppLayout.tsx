import { Link, Outlet, useLocation } from "react-router-dom";
import { Info, Languages, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { appTitle, pageTitle } from "../pages";
import { useInstalled } from "../lib/installed";
import {
  LOCALE_NAMES,
  landingPath,
  localizedPath,
  locale,
  setLocale,
  tr,
} from "../i18n";
import "./AppLayout.css";

export function AppLayout() {
  const [showAbout, setShowAbout] = useState(false);
  const { pathname } = useLocation();
  const installed = useInstalled();
  const other = locale === "es" ? "en" : "es";
  useEffect(() => {
    const title = installed ? appTitle(pathname) : pageTitle(pathname);
    if (title) document.title = title;
    // The browser's (or the installed app's) bar takes the page's ground:
    // black on the landing, white everywhere else.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        pathname === "/" || pathname === "/es" ? "#000000" : "#ffffff",
      );
  }, [pathname, installed]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {tr("Skip to content", "Ir al contenido")}
      </a>
      <header className="app-header">
        <Link to={landingPath()} className="brand-title">
          Thermoprops
        </Link>
        <div className="app-header__actions">
          {/* The other language, named in itself: whoever reads it finds it. */}
          <Button
            variant="subtle"
            size="sm"
            className="locale-button"
            lang={other}
            title={tr("Ver en español", "View in English")}
            onClick={() => setLocale(other)}
          >
            <Languages aria-hidden="true" />
            {LOCALE_NAMES[other]}
          </Button>
          <Button
            variant="subtle"
            size="sm"
            className="about-button"
            onClick={() => setShowAbout(true)}
          >
            <Info />
            {tr("About", "Acerca de")}
          </Button>
        </div>
      </header>
      <main className="app-main" id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="app-footer">
        <Link to={localizedPath("/fluids", locale)!}>
          {tr("Fluid properties", "Propiedades de fluidos")}
        </Link>
        <span>
          {tr("Properties by", "Propiedades por")}{" "}
          <a
            href="https://coolprop.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            CoolProp
          </a>
          {" · "}
          {tr("WebAssembly via", "WebAssembly con")}{" "}
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
          <h2 id="about-title">
            {tr("About Thermoprops", "Acerca de Thermoprops")}
          </h2>
          <Button
            variant="plain"
            className="about-modal__close"
            onClick={() => setShowAbout(false)}
            aria-label={tr("Close about dialog", "Cerrar el cuadro Acerca de")}
          >
            <X />
          </Button>
        </header>
        <div className="about-modal__body">{tr(<AboutEn />, <AboutEs />)}</div>
      </Modal>
    </div>
  );
}

const COOLPROP = (
  <a href="https://coolprop.org" target="_blank" rel="noopener noreferrer">
    CoolProp
  </a>
);

const COOLPROP_RS = (
  <a
    href="https://github.com/luisbedoia/coolprop-rs"
    target="_blank"
    rel="noopener noreferrer"
  >
    coolprop-rs
  </a>
);

/** CoolProp's paper: its title stays as published. */
const CITATION = (
  <blockquote className="about-modal__citation">
    Bell, I. H.; Wronski, J.; Quoilin, S.; Lemort, V. Pure and Pseudo-pure Fluid
    Thermophysical Property Evaluation and the Open-Source Thermophysical
    Property Library CoolProp. <i>Ind. Eng. Chem. Res.</i> <b>2014</b>, 53 (6),
    2498–2508.{" "}
    <a
      href="https://doi.org/10.1021/ie4033999"
      target="_blank"
      rel="noopener noreferrer"
    >
      doi:10.1021/ie4033999
    </a>
  </blockquote>
);

const SOURCE = "https://github.com/luisbedoia/thermoprops";

function AboutEn() {
  return (
    <>
      <p>
        Thermoprops is a free calculator to explore thermodynamic states and
        property diagrams of fluids and refrigerants.
      </p>
      <p>
        Every property is computed by {COOLPROP}, the open-source thermophysical
        property library created by Ian Bell and the CoolProp contributors. If
        you use these results in academic work, please cite:
      </p>
      {CITATION}
      <p>
        CoolProp runs in your browser as WebAssembly through {COOLPROP_RS}, a
        thin layer that makes it easier to use on the web.
      </p>
      <p>
        Developed by the Department of Mechanical Engineering, Universidad de
        Antioquia.{" "}
        <a href={SOURCE} target="_blank" rel="noopener noreferrer">
          Source code
        </a>
        .
      </p>
    </>
  );
}

function AboutEs() {
  return (
    <>
      <p>
        Thermoprops es una calculadora gratuita para explorar estados
        termodinámicos y diagramas de propiedades de fluidos y refrigerantes.
      </p>
      <p>
        Cada propiedad la calcula {COOLPROP}, la biblioteca de código abierto de
        propiedades termofísicas creada por Ian Bell y los colaboradores de
        CoolProp. Si usas estos resultados en un trabajo académico, cita:
      </p>
      {CITATION}
      <p>
        CoolProp funciona en tu navegador como WebAssembly mediante{" "}
        {COOLPROP_RS}, una capa delgada que facilita usarlo en la web.
      </p>
      <p>
        Desarrollado por el Departamento de Ingeniería Mecánica de la
        Universidad de Antioquia.{" "}
        <a href={SOURCE} target="_blank" rel="noopener noreferrer">
          Código fuente
        </a>
        .
      </p>
    </>
  );
}
