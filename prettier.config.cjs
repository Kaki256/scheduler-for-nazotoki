module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  jsxSingleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'always',
  quoteProps: 'consistent',
  proseWrap: 'preserve',
  endOfLine: 'lf',
  plugins: [],
  overrides: [
    {
      files: ['data/*.json', 'data/**/*.json', 'scripts/**/*.json', 'public/**/*.json'],
      options: {
        parser: 'json-stringify'
      }
    }
  ]
};
