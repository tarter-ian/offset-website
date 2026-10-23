import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    // New in the React hooks rules that came with Next 16. The site's effects were written before them and
    // work as intended; turned off to keep the lint the same as on Next 15 rather than rewrite 26 effects at once.
    rules: { "react-hooks/set-state-in-effect": "off", "react-hooks/purity": "off" },
  },
  {
    ignores: ["node_modules/**", ".next/**", ".open-next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
