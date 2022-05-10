export interface InputInterface {
  label?: string;
  value?: number;
  meta?: {
    touched?: boolean;
    error?: string;
  };
}

export function Input(props: InputInterface) {
  const { value, meta, label } = props;

  return (
    <div className="input-group mb-3">
      <input className="form-control" type="number" value={value} />
      <input type="range" className="form-range" id="customRange1" />
      <label className="form-control">{label}</label>
    </div>
  );
}
