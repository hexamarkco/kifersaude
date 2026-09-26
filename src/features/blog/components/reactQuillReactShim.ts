import React from "react";

// O ReactQuill 2 usa `__importDefault(require("react"))`. Exportar o
// namespace inteiro criava `React.default` dentro desse helper e deixava
// `React.Component` indefinido no chunk de produção.
export default React;
