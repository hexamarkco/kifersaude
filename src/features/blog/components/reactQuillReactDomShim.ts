import ReactDOM from "react-dom";

// Mesmo contrato do shim do React: o ReactQuill espera o objeto ReactDOM
// diretamente, incluindo `findDOMNode`, e não um namespace aninhado. O
// marcador CommonJS evita que o bundle crie `ReactDOM.default` por engano.
export const __esModule = true;

export default ReactDOM;
