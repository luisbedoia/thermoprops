import { useEffect, useState } from "react";
import {
  calculateProperties,
  getFluidsList,
  properties,
  Property,
  Result,
} from "./lib";
import "./App.css";

export default function App() {
  // const fluidsList = await getFluidsList();
  const [fluidsList, setFluidsList] = useState<string[]>([]);
  const [property1, setProperty1] = useState(
    properties.find((p) => p.input)?.name || ""
  );
  const [property2, setProperty2] = useState(
    properties.find((p) => p.input && p.name !== property1)?.name || ""
  );
  const [result, setResult] = useState<any | null>(null);

  const propertiesList1 = properties.filter(
    (p) => p.input && p.name !== property2
  );
  const propertiesList2 = properties.filter(
    (p) => p.input && p.name !== property1
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fluid = formData.get("fluid") as string;
    const value1 = parseFloat(formData.get("value1") as string);
    const value2 = parseFloat(formData.get("value2") as string);

    if (!property1 || !property2 || isNaN(value1) || isNaN(value2)) return;

    setResult(await calculateProperties(property1, value1, property2, value2, fluid));
  };

  useEffect(() => {
    async function fetchFluidsList() {
      try {
        const fluids = await getFluidsList();
        setFluidsList(fluids);
      } catch (error) {
        console.error("Error fetching fluids list:", error);
      }
    }
    fetchFluidsList();
  }, []);

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <h1>Propiedades de los Fluidos</h1>

        <div>
          <label htmlFor="fluid">Fluido:</label>
          <select name="fluid" id="fluid">
            {fluidsList.map((fluido) => (
              <option key={fluido} value={fluido}>
                {fluido}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="property1">Propiedad 1:</label>
          <select
            name="property1"
            id="property1"
            value={property1}
            onChange={(e) => setProperty1(e.target.value)}
          >
            {propertiesList1.map((property) => (
              <PropertySelect key={property.name} property={property} />
            ))}
          </select>
          <input type="number" name="value1" id="value1" step="any" />
        </div>

        <div>
          <label htmlFor="property2">Propiedad 2:</label>
          <select
            name="property2"
            id="property2"
            value={property2}
            onChange={(e) => setProperty2(e.target.value)}
          >
            {propertiesList2.map((property) => (
              <PropertySelect key={property.name} property={property} />
            ))}
          </select>
          <input type="number" name="value2" id="value2" step="any" />
        </div>

        <button type="submit">Calcular</button>

        {result && <ResultList results={result} />}
      </form>
    </div>
  );
}

function PropertySelect({ property }: { property: Property }) {
  return (
    <option value={property.name}>
      {property.name} ({property.unit})
    </option>
  );
}

function ResultComponent({ result }: { result: Result }) {
  return (
    <div className="result">
      <p>
        {result.name}= {result.value} {result.unit}
      </p>
      {/* description is showed on hover */}
      <p className="description">{result.description}</p>
    </div>
  );
}

function ResultList({ results }: { results: Result[] }) {
  return (
    <div className="result-list">
      {results.map((result) => (
        <ResultComponent key={result.name} result={result} />
      ))}
    </div>
  );
}
