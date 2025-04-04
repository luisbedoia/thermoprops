import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getFluidsList, properties, Property } from "./lib";
import "./index.css";
import "./Input.css";

export function Input() {
  const navigate = useNavigate();
  const [fluidsList, setFluidsList] = useState<string[]>([]);
  const [value1, setValue1] = useState("");
  const [value2, setValue2] = useState("");
  const [fluid, setFluid] = useState<string>(
    fluidsList.length > 0 ? fluidsList[0] : ""
  );
  const [property1, setProperty1] = useState(
    properties.find((p) => p.input)?.name || ""
  );
  const [property2, setProperty2] = useState(
    properties.find((p) => p.input && p.name !== property1)?.name || ""
  );

  const propertiesList1 = properties.filter(
    (p) => p.input && p.name !== property2
  );
  const propertiesList2 = properties.filter(
    (p) => p.input && p.name !== property1
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams({
      fluid,
      property1,
      value1: value1?.toString() || "",
      property2,
      value2: value2?.toString() || "",
    });

    navigate(`/result?${params.toString()}`);
  };

  useEffect(() => {
    async function fetchFluidsList() {
      try {
        const fluids = await getFluidsList();
        setFluidsList(fluids);
        setFluid(fluids[0]);
      } catch (error) {
        console.error("Error fetching fluids list:", error);
      }
    }
    fetchFluidsList();
  }, []);

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <h1>Fluid Properties</h1>

        <div>
          <select
            name="fluid"
            id="fluid"
            value={fluid}
            onChange={(e) => setFluid(e.target.value)}
          >
            {fluidsList.map((fluid) => (
              <option key={fluid} value={fluid}>
                {fluid}
              </option>
            ))}
          </select>
        </div>

        <div className="input-pair">
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
          <input
            type="number"
            name="value1"
            id="value1"
            step="any"
            value={value1}
            onChange={(e) => {
              setValue1(e.target.value);
            }}
          />
        </div>

        <div className="input-pair">
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
          <input
            type="number"
            name="value2"
            id="value2"
            step="any"
            value={value2}
            onChange={(e) => {
              setValue2(e.target.value);
            }}
          />
        </div>

        <button type="submit">Submit</button>
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

// function ResultComponent({ result }: { result: Result }) {
//   return (
//     <div className="result">
//       <p>
//         {result.name}:{" "}
//         {result.value.toLocaleString(undefined, {
//           minimumSignificantDigits: 3,
//           maximumSignificantDigits: 10,
//         })}{" "}
//         {result.unit}
//       </p>
//     </div>
//   );
// }

// function ResultList({ results }: { results: Result[] }) {
//   return (
//     <div className="result-list">
//       {results.map((result) => (
//         <ResultComponent key={result.name} result={result} />
//       ))}
//     </div>
//   );
// }
