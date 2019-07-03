let program = require('commander')
const path = require('path')

program
  .command('deploy <dir>')
  .option('-f, --files', 'Include static files')
  .action( (dir, args) => {
    if (!path.isAbsolute(dir)) {
      dir = `${__dirname}/${dir}`
    }
    require('./cmds/deploy')(dir, args)
  })

program.parse(process.argv)
