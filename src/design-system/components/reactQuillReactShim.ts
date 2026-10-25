import React from "react";

// O ReactQuill 2 usa `__importDefault(require("react"))`. Exportar o
// namespace inteiro criava `React.default` dentro desse helper e deixava
// `React.Component` indefinido no chunk de produção. O marcador abaixo faz
// o helper reconhecer o namespace como o módulo CommonJS original, mantendo
// `react_1.default` apontando para o objeto React real.
export const __esModule = true;

export default React;
