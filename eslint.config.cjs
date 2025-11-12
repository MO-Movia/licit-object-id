const config = require('@modusoperandi/eslint-config');
const baseConfig = config.getFlatConfig({
  strict: false,
  strict: false,
  header: config.header.mit
});

// Find and modify the config object that has parserOptions
const modifiedConfig = baseConfig.map(cfg => {
  if (cfg.languageOptions?.parserOptions?.project) {
    return {
      ...cfg,
      languageOptions: {
        ...cfg.languageOptions,
        parserOptions: {
          ...cfg.languageOptions.parserOptions,
          project: undefined, // Remove project since projectService is enabled
        },
      },
    };
  }
  return cfg;
});
module.exports = [
  ...modifiedConfig,
  {
    rules: {
      //Include any rule overrides here!
    },
  },
];
