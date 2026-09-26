import ReactDOM from "react-dom";

// Mesmo contrato do shim do React: o ReactQuill espera o objeto ReactDOM
// diretamente, incluindo `findDOMNode`, e não um namespace aninhado.
export default ReactDOM;
