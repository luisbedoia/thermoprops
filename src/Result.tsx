import { useSearchParams, useNavigate } from "react-router-dom";
import { calculateProperties, Result } from "./lib";
import "./index.css";
import "./Result.css";

export function ResultView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const fluid = searchParams.get("fluid")!;
  const property1 = searchParams.get("property1")!;
  const value1 = parseFloat(searchParams.get("value1")!);
  const property2 = searchParams.get("property2")!;
  const value2 = parseFloat(searchParams.get("value2")!);

  const result = calculateProperties(
    property1,
    value1,
    property2,
    value2,
    fluid
  );

  const goBack = () => {
    navigate(
      `/input?fluid=${fluid}&property1=${property1}&value1=${value1}&property2=${property2}&value2=${value2}`
    );
  };

  return (
    <div className="card">
      <label className="cardLabel">Fluid Properties Result</label>

      <div className="input-summary">
        <p>
          <strong>Fluid:</strong> {fluid}
        </p>
        <p>
          <strong>{property1}:</strong> {value1}
        </p>
        <p>
          <strong>{property2}:</strong> {value2}
        </p>
      </div>

      <ResultTable results={result} />

      <button onClick={goBack}>Go Back</button>
    </div>
  );
}

function ResultTable({ results }: { results: Result[] }) {
  return (
    <table className="result-table">
      <thead>
        <tr>
          <th>Property</th>
          <th>Value</th>
          <th>Unit</th>
        </tr>
      </thead>
      <tbody>
        {results.map((res) => (
          <tr key={res.name}>
            <td>{res.name}</td>
            <td>
              {res.value.toLocaleString(undefined, {
                minimumSignificantDigits: 3,
                maximumSignificantDigits: 10,
              })}
            </td>
            <td>{res.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
