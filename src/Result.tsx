import { useSearchParams } from "react-router-dom";
import { calculateProperties, Result } from "./lib";
import "./index.css";
import "./Result.css";

export function ResultView() {
  const [searchParams] = useSearchParams();
//   const _navigate = useNavigate();

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

  return (
    <div className="card">
      <ResultList results={result} />
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

function ResultComponent({ result }: { result: Result }) {
  return (
    <div className="result">
      <p>
        {result.name}:{" "}
        {result.value.toLocaleString(undefined, {
          minimumSignificantDigits: 3,
          maximumSignificantDigits: 10,
        })}{" "}
        {result.unit}
      </p>
    </div>
  );
}
