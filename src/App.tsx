import { Navbar, MyCard, Start } from "./components";
import {
  BrowserView,
  MobileView,
  isBrowser,
  isMobile,
} from "react-device-detect";
import MyRouter from "./Router";

function App() {
  return (
    <div className="App">
      <MyRouter />
      <BrowserView>
        <h1>This is rendered only in browser</h1>
      </BrowserView>
      <MobileView>
        <h1>This is rendered only on mobile</h1>
      </MobileView>
    </div>
  );
}

export default App;
