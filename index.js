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

program
  .command('dev <dir>')
  .option('-f, --files', 'Include static files')
  .option('-c, --core <core>', 'Use local core dir')
  .action( (dir, args) => {
    if (!path.isAbsolute(dir)) {
      dir = `${__dirname}/${dir}`
    }
    if (args.core && !path.isAbsolute(args.core)) {
      args.core = `${__dirname}/${args.core}`
    }
    require('./cmds/dev')(dir, args)
  })

program.parse(process.argv)
