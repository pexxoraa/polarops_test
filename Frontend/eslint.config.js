import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {ignores:['dist','node_modules']},
  js.configs.recommended,
  {
    files:['**/*.{js,jsx,mjs}'],
    languageOptions:{ecmaVersion:2022,sourceType:'module',parserOptions:{ecmaFeatures:{jsx:true}},globals:{...globals.browser,...globals.node}},
    plugins:{react,'react-hooks':reactHooks,'react-refresh':reactRefresh},
    rules:{
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-vars':'error',
      'react-refresh/only-export-components':['warn',{allowConstantExport:true}],
      'no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],
    },
  },
  { files:['src/context/*.jsx'], rules:{'react-refresh/only-export-components':'off'} },
];
