module.exports = {
  name: 'LOLBAS',
  acronym: 'LOLBAS',
  description:
    'Lookup information on binaries, scripts, and libraries documented as part of the Living Off the Land Binaries (LOLBAS) project.',
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
  options: [
    {
      key: 'autoUpdate',
      name: 'Enable Auto Update',
      description:
        'If checked, the integration will automatically update the LOLBAS data via the LOLBAs github page. This setting must be set to "Only admins can view and edit". The integration must have connectivity to `https://lolbas-project.github.io/api/lolbas.json` if this option is enabled.',
      default: true,
      type: 'boolean',
      userCanEdit: false,
      adminOnly: true
    }
  ]
};
