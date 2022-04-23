import { Navbar, MyCard } from "./components";
import { Helmet } from "react-helmet";
function App() {
  return (
    <>
      <div className="App">
        {<Navbar />}
        <div>
          <MyCard />
        </div>
      </div>
      <Helmet>
        <script defer src="js/coolprop.js"></script>
        {/* Module.PropsSI('D', 'T', 298.15, 'P', 101325, 'Nitrogen') */}
      </Helmet>
    </>
  );
}

export default App;
