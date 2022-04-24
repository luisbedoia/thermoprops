export function Start({ onLoad, isClicked}: any) {
  if (!isClicked) {
    return (
      <div className="start">
        <h1>Start</h1>
        <button onClick={onLoad}>Start</button>
      </div>
    );
  } else {
    return (
      <div className="start">
        <h1>Importando librerías</h1>
      </div>
    );
  }
}
