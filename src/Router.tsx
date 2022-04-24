import React, { useState } from "react";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
// import { isBrowser, isMobile } from "react-device-detect";
import { Start } from "./components";
import { Calculator } from "./components";
import { interval } from "rxjs";
import { Helmet } from "react-helmet";
// const InspectorRoutes = React.lazy(() => import("../modules/inspector"));
declare var Module: any;

export default function MyRouter() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [loadComponent, setLoadComponent] = useState(<></>);
  const base = `${process.env.PUBLIC_URL}` || "/thermoprops";
  //   const base = null;
  const coolpropPath = `${base || ""}/js/coolprop.js`;
  function handleClick() {
    console.log("Clicked");
    setLoadComponent(
      <Helmet>
        <script defer src={coolpropPath}></script>
        {/* Module.PropsSI('D', 'T', 298.15, 'P', 101325, 'Nitrogen') */}
      </Helmet>
    );
    setIsClicked(true);
    let myInterval = interval(500).subscribe((x) => {
      if (typeof Module !== "undefined") {
        setIsLoaded(true);
        myInterval.unsubscribe();
      }
    });
  }
  useState(() => {
    if (typeof Module !== "undefined") {
      setIsLoaded(true);
    }
  });
  return (
    <BrowserRouter basename={base || "/"}>
      <p>{base}</p>
      <Routes>
        <Route
          path="/"
          element={
            isLoaded ? (
              <Navigate to="/calculator" />
            ) : (
              <Start onLoad={handleClick} isClicked={isClicked} />
            )
          }
        />
        <Route
          path="/calculator/*"
          element={isLoaded ? <Calculator /> : <Navigate to="/" />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {loadComponent}
    </BrowserRouter>
  );
}
