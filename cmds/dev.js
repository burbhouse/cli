const exec = require('await-exec')
const process_exec = require('child_process').exec
const watch = require('node-watch')
const chalk = require('chalk')
const replace = require('replace-in-file')
const path = require('path')
const fs = require('fs')

module.exports = async (dir, args) => {
  const config = require(`${dir}/config.js`)

  console.log(chalk.bold(`\n\n/////////////////// DEV ///////////////////`))
  console.log(chalk.white('Running dev on ')+chalk.bold.cyan(config.site))
  console.log(chalk.white(args.core ? `-- using local core ${args.core}` : ''))
  console.log(chalk.white(args.files ? '-- with static files' : ''))

  // create temp directory
  const temp = `${process.env.HOME}/.bh/dev/${config.site}`
  await exec(`rm -rf ${temp} && mkdir -p ${temp}`)

  if (args.core) {
    // migrate local core
    console.log(chalk.bold.yellow('\nCloning local core:'))
    console.log(chalk.white(chalk.bold('FROM ')+args.core))
    console.log(chalk.white(chalk.bold('TO ')+temp))

    await exec(`rsync -av --exclude=".*" --exclude="node_modules" ${args.core}/* ${temp}`)
  } else {
    // clone core repo
    console.log(chalk.bold.yellow('\nCloning core repo:'))
    console.log(chalk.white(chalk.bold('FROM ')+config.repositories.core))
    console.log(chalk.white(chalk.bold('TO ')+temp))

    const core = config.repositories.core.split('#')
    if (core.length > 1) {
      await exec(`git clone --single-branch --branch ${core[1]} https://${core[0]} ${temp}`)
    } else {
      await exec(`git clone https://${core[0]} ${temp}`)
    }
    await exec(`cd ${temp} && git remote set-url origin git@${config.repositories.site.ssh}`)
  }

  // migrate site code
  const site = `${temp}/site`

  console.log(chalk.bold.yellow('\nMigrating site code:'))
  console.log(chalk.white(chalk.bold('FROM ')+dir))
  console.log(chalk.white(chalk.bold('TO ')+site))

  await exec(`mkdir ${site}`)
  await exec(`rsync -av --exclude=".*" ${dir}/* ${site}`)

  // merge and symlink static files
  if (args.files) {
    const coreStatic = `${temp}/static`
    const siteStatic = `${site}/static`
    const tempStatic = `${temp}/tempStatic`

    console.log(chalk.bold.yellow('\nMerging static files:'))
    console.log(chalk.white(chalk.bold('FROM ')+coreStatic))
    console.log(chalk.white(chalk.bold('TO ')+tempStatic))
    console.log(chalk.white(chalk.bold('FROM ')+siteStatic))
    console.log(chalk.white(chalk.bold('TO ')+tempStatic))

    await exec(`mkdir ${tempStatic}`)
    await exec(`cp -rf ${coreStatic}/* ${tempStatic}/`)
    await exec(`rm -rf ${coreStatic}`)
    await exec(`cp -rf ${siteStatic}/* ${tempStatic}/`)

    console.log(chalk.bold.yellow('\nSymlinking static files:'))
    console.log(chalk.white(chalk.bold('FROM ')+tempStatic))
    console.log(chalk.white(chalk.bold('TO ')+coreStatic))

    await exec(`ln -s ${tempStatic} ${coreStatic}`)
  }

  // replace strings
  const strings = [
    ['core.burbhouse.com', config.meta.domain],
    ['github.com/burbhouse/core.git', config.repositories.site.https],
    ['github.com:burbhouse/core.git', config.repositories.site.ssh],
    ['burbhouse-core', config.site],
    ['Burbhouse Core', config.meta.title]
  ]
  console.log(chalk.bold.yellow('\nReplacing these strings:'))
  console.log(chalk.dim( strings.map( string => `-- ${string[0]} -> ${string[1]}`).join('\n') ))

  const files = [
    `${temp}/package.json`,
    `${temp}/app.json`,
    `${temp}/static/manifest.json`
  ]
  console.log(chalk.bold.yellow('\nIn these files:'))
  console.log(chalk.dim(`-- ${files.join('\n-- ')}`))

  strings.forEach( async string => {
    let results = await replace.sync({
      files: files,
      from: new RegExp(string[0],"g"),
      to: string[1]
    })
  })

  // install dependencies
  console.log(chalk.bold.yellow('\nInstalling dependencies...'))
  await exec(`cd ${temp} && yarn install`)

  // watching file changes
  console.log(chalk.bold.yellow('\nWatching file changes...'))

  watch(dir, { recursive: true }, async (e, name) => {
    const file = name.split(dir)[1]
    const modifiedFile = dir+file
    const targetFile = site+file
    await exec(`cp -f ${modifiedFile} ${targetFile}`)
  })

  if (args.core) {
    watch(args.core, { recursive: true }, async (e, name) => {
      const file = name.split(args.core)[1]
      const modifiedFile = args.core+file
      const targetFile = temp+file
      await exec(`cp -f ${modifiedFile} ${targetFile}`)
    })
  }

  // dev
  console.log(chalk.bold.yellow(`\nStarting dev for ${config.site}...\n`))
  try {
    process_exec(`cd ${temp} && yarn run dev`).stdout.pipe(process.stdout)
  } catch (e) {
    console.error(e)
  }
}
