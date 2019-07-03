const exec = require('await-exec')
const chalk = require('chalk')
const replace = require('replace-in-file')
const path = require('path')
const fs = require('fs')

module.exports = async (dir, args) => {
  const config = require(`${dir}/config.js`)
  console.log(chalk.bold(`\n\n////////////////// DEPLOYING //////////////////`))
  console.log(chalk.bold.cyan(config.site)+' to '+chalk.bold.cyan(config.meta.domain))
  console.log(chalk.white(args.files ? '-- with static files' : '')+'\n')

  // create temp directory
  const temp = `${process.env.HOME}/bhdeploy-${config.site}`
  await exec(`rm -rf ${temp} && mkdir ${temp}`)

  // clone core repo
  console.log(chalk.bold.yellow('Cloning core repo:'))
  console.log(chalk.white(`${chalk.bold('FROM ')}${config.repositories.core}\n${chalk.bold('TO ')}${temp}\n`))
  const core = config.repositories.core.split('#')
  if (core.length > 1) {
    await exec(`git clone --single-branch --branch ${core[1]} https://${core[0]} ${temp}`)
  } else {
    await exec(`git clone https://${core[0]} ${temp}`)
  }
  await exec(`cd ${temp} && git remote set-url origin git@${config.repositories.site.ssh}`)

  // migrate site code
  const site = `${temp}/site`

  console.log(chalk.bold.yellow('Migrating site code:'))
  console.log(chalk.white(`${chalk.bold('FROM ')}${dir}/*\n${chalk.bold('TO ')}${site}\n`))
  await exec(`mkdir ${site}`)
  await exec(`rsync -av --exclude=".*" ${dir}/* ${site}`)

  // merge static files
  if (args.files) {
    const coreStatic = `${temp}/static`
    const siteStatic = `${site}/static`

    console.log(chalk.bold.yellow('Merging static files:'))
    console.log(chalk.white(`${chalk.bold('FROM ')}${siteStatic}\n${chalk.bold('TO ')}${coreStatic}\n`))
    await exec(`cp -rf ${siteStatic}/* ${coreStatic}`)
    await exec(`rm -rf ${siteStatic}`)
  }

  // copy readme
  const readme = `README.md`

  console.log(chalk.bold.yellow('Copying readme:'))
  console.log(chalk.white(`${chalk.bold('FROM ')}${site}/${readme}\n${chalk.bold('TO ')}${temp}/${readme}\n`))
  await exec(`mv -f ${site}/${readme} ${temp}/${readme}`)

  // replace strings
  const strings = [
    ['core.burbhouse.com', config.meta.domain],
    ['github.com/burbhouse/core.git', config.repositories.site.https],
    ['github.com:burbhouse/core.git', config.repositories.site.ssh],
    ['burbhouse-core', config.site],
    ['Burbhouse Core', config.meta.title]
  ]
  console.log(chalk.bold.yellow('Replacing these strings:'))
  console.log(chalk.dim(`${strings.map( string => `-- ${string[0]} -> ${string[1]}`).join('\n')}\n`))

  const files = [
    `${temp}/package.json`,
    `${temp}/app.json`,
    `${temp}/static/manifest.json`
  ]
  console.log(chalk.bold.yellow('In these files:'))
  console.log(chalk.dim(`-- ${files.join('\n-- ')}\n`))

  strings.forEach( async string => {
    let results = await replace.sync({
      files: files,
      from: new RegExp(string[0],"g"),
      to: string[1]
    })
  })

  // install dependencies
  console.log(chalk.bold.yellow('Installing dependencies...\n'))
  await exec(`cd ${temp} && yarn install`)

  // deploy
  console.log(chalk.bold.yellow(`Deploying ${config.site}...\n`))
  try {
    await exec(`cd ${temp} && yarn run deploy`)
  } catch (e) {
    console.error(e)
  } finally {
    console.log(chalk.bold(`/////////////////// DONE ///////////////////`))
  }
}
