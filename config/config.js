module.exports = {
  name: 'LOLBAS',
  acronym: 'LOLBAS',
  description:
    'The goal of the LOLBAS project is to document every binary, script, and library that can be used for Living Off The Land techniques.',
  customTypes: [
    {
      key: 'executables',
      regex: /\b[a-zA-Z_\-\.0-9]{2,50}\.\S{3}\b/
    }
  ],
  defaultColor: 'light-gray',
  onDemandOnly: true,
  styles: ['./styles/int.less'],
  block: {
    component: {
      file: './components/block.js'
    },
    template: {
      file: './templates/block.hbs'
    }
  },
  logging: {
    level: 'info'
  },
  request: {
    cert: '',
    key: '',
    passphrase: '',
    ca: '',
    proxy: ''
  },
  options: []
};
