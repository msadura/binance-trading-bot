module.exports = {
  env: {
    node: true,
    commonjs: true,
    es2021: true
  },
  extends: ['prettier', 'eslint:recommended'],
  plugins: ['prettier', '@babel'],
  parser: '@babel/eslint-parser',
  parserOptions: {
    babelOptions: {
      configFile: './.babelrc'
    },
    ecmaVersion: 2018
  },
  rules: {
    'prettier/prettier': 'error'
  }
};
