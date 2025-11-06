const config = require('@modusoperandi/eslint-config');
module.exports = [
  ...config.getFlatConfig({
    strict: false,
    header: {
      copyright: 'Copyright (c) 2024 Modus Operandi, Inc. All rights reserved.',
    }
  }),
  {
    rules: {
      //Include any rule overrides here!
    },
  },
];
