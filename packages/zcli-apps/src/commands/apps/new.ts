import { FsExtraError, ManifestPath } from './../../types'
import { Command, Flags, CliUx } from '@oclif/core'
import { cleanDirectory } from '../../utils/fileUtils'
import { getManifestFile, updateManifestFile } from '../../utils/manifest'
import { getWebpackFile, updateWebpackFile } from '../../utils/webpackConfig'
import { locationArr } from '../../utils/locationArr'
import * as fs from 'fs'
import * as fsExtra from 'fs-extra'
import * as https from 'https'
import * as path from 'path'
import * as AdmZip from 'adm-zip'
import * as chalk from 'chalk'
import { CLIError } from '@oclif/core/lib/errors'

export default class New extends Command {
  static description = 'generates a bare bones app locally for development'

  static flags = {
    scaffold: Flags.string({ default: 'basic', description: 'Choose from open-source Zendesk app scaffold structures' }),
    path: Flags.string({ description: 'Path of your new app' }),
    location: Flags.string({ description: 'Location(s) the app will appear' }),
    authorName: Flags.string({ description: 'Name of app author' }),
    authorEmail: Flags.string({ description: 'Email of app author' }),
    appName: Flags.string({ description: 'Name of the app' }),
    authorURL: Flags.string({ description: 'URL of the app author' })
  }

  static examples = [
    '$ zcli apps:new',
    '$ zcli apps:new --scaffold=basic',
    '$ zcli apps:new --scaffold=react'
  ]

  zipScaffoldPath = path.join(process.cwd(), 'scaffold.zip')
  unzippedScaffoldPath = path.join(process.cwd(), 'original-apps-scaffold-v1-main')
  EMAIL_REGEX = /^.+@.+\..+$/
  URL_REGEX = /^http(s)?:\/\/?[\w.-]+(?:\.[\w-]+)+[\w\-_~:/?#[\]@!&',;=.]+$/

  async downloadScaffoldsRepo (url: string) {
    return new Promise<void>((resolve, reject) => {
      const destination = fs.createWriteStream(this.zipScaffoldPath)

      https.get(url, (response) => {
        response.pipe(destination)
      })

      destination.on('finish', () => {
        const zip = new AdmZip(this.zipScaffoldPath)
        const overwrite = false
        zip.extractAllToAsync(path.join(process.cwd()), overwrite, true, async (err) => {
          await cleanDirectory(this.zipScaffoldPath)
          if (err) {
            reject(err)
          }
          resolve()
        })
      })
    })
  }

  async extractScaffoldIfExists (flagScaffold: string, directoryName: string) {
    return new Promise<void>((resolve, reject) => {
      fsExtra.copy(
        path.join(process.cwd(), '/', 'original-apps-scaffold-v1-main', flagScaffold),
        path.join(process.cwd(), directoryName),
        { overwrite: true, errorOnExist: true }, async (err: Error) => {
          await cleanDirectory(this.unzippedScaffoldPath)
          if (err) {
            const fsExtraError = err as FsExtraError
            if (fsExtraError.code === 'ENOENT') {
              reject(new Error(`Scaffold ${flagScaffold} does not exist: ${err}`))
            }
            reject(err)
          }
          resolve()
        }
      )
    })
  }

  modifyManifest (directoryName: string, appName: string, authorName: string, authorEmail: string, flagScaffold: string, location: string, authorURL?: string ) {
    const manifestPath: ManifestPath = {
      basic: path.join(process.cwd(), directoryName),
      react: path.join(process.cwd(), directoryName, 'src')
    }
    const manifest = getManifestFile(manifestPath[flagScaffold])

    manifest.name = appName
    manifest.author.name = authorName
    manifest.author.email = authorEmail


    // Create array of locations and add location objects to manifest
    if(flagScaffold === 'react') {
      locationArr(location).forEach((locationItem) => {
        const locationObject = {
          "url": `assets/${locationItem}.html`,
          "flexible": true
        }
        manifest.location.support[locationItem] = locationObject
      })
    }

    if (authorURL?.trim()) {
      manifest.author.url = authorURL
    } else {
      delete manifest.author.url
    }

    updateManifestFile(manifestPath[flagScaffold], manifest)
  }

  modifyWebpack (directoryName: string, location: string) {

    const webpackPath = path.join(process.cwd(), directoryName)

    const webpackFile = getWebpackFile(webpackPath)

    let htmlWebpackPluginArr: string[] = [];
    let entryPathArr: string[] = [];

    // Create array of locations, populate templates based on location,
    // push templates to htmlWebpackPluginArr and entryPathArr
    locationArr(location).forEach((locationItem) => {
      const htmlWebpackPluginTemplate =
        `new HtmlWebpackPlugin({
          warning:
            "AUTOMATICALLY GENERATED FROM ./src/templates/${locationItem}.html - DO NOT MODIFY THIS FILE DIRECTLY",
          vendorJs: externalAssets.js,
          chunks: ["${locationItem}"],
          template: "./src/locations/${locationItem}/iframe.html",
          filename: "${locationItem}.html",
        })
      `
      const entryPathTemplate = `${locationItem}: ["./src/locations/${locationItem}/${locationItem}.js", "./src/index.css"]
      `

      entryPathArr.push(entryPathTemplate)
      htmlWebpackPluginArr.push(htmlWebpackPluginTemplate);
    });

    // Format entryPathArr into correct shape for webpack
    const entryPath = `entry: {
      ${entryPathArr.toString()}
    }`

    // Searches webpack config for keywords and replaces with new values
    // provided in htmlWebpackPluginArr and entryPath
    const mapObj = {
      "new HtmlWebpackPlugin": htmlWebpackPluginArr.toString(),
      entry: entryPath,
    };
    const webpackUpdated = webpackFile.replace(/new HtmlWebpackPlugin|entry/gi, function(matched){
      return mapObj[matched as keyof typeof mapObj];
    });

    updateWebpackFile(webpackPath, webpackUpdated);
  }

  // Copy location files to new app locations directory depending on user selection
  // Removes package directory after copying
  async copyLocationDirectories (directoryName: string, location: string) {
    locationArr(location).forEach((locationItem) => {
      fsExtra.copySync(path.join(process.cwd(), directoryName, `/packages/${locationItem}`), path.join(process.cwd(), directoryName, `/src/locations/${locationItem}`), { overwrite: true })
    })

    cleanDirectory(path.join(process.cwd(), directoryName, '/packages'));
  }

  // Check location flag for valid locations
  checkLocations (locations: string) {
    const locationsArray = locationArr(locations);

    const validLocations = ['top_bar', 'nav_bar', 'ticket_sidebar', 'new_ticket_sidebar', 'user_sidebar', 'organization_sidebar', 'modal', 'ticket_editor', 'background']
    const invalidLocations = locationsArray.filter((location) => !validLocations.includes(location))

    return invalidLocations.length > 0 ? false : true;
  }


  async run () {
    const { flags } = await this.parse(New)
    const flagScaffold = flags.scaffold

    let location = "";

    if(flagScaffold === 'react') {
      location = flags.location || await CliUx.ux.prompt('Enter the location(s) the app will appear (e.g. ticket_sidebar, top_bar, etc.)')

      while (!this.checkLocations(location)) {
        console.log(chalk.red('Invalid location(s) entered. Please enter a valid location(s).'))
        location = await CliUx.ux.prompt('Enter the location(s) this app will appear (e.g. ticket_sidebar, top_bar, etc.)')
      }
    }

    const directoryName = flags.path || await CliUx.ux.prompt('Enter a directory name to save the new app (will create the dir if it does not exist)')
    const authorName = flags.authorName || await CliUx.ux.prompt('Enter this app authors name')
    let authorEmail = flags.authorEmail || await CliUx.ux.prompt('Enter this app authors email')

    while (!this.EMAIL_REGEX.test(authorEmail)) {
      console.log(chalk.red('Invalid email, please try again'))
      authorEmail = flags.authorEmail || await CliUx.ux.prompt('Enter this app authors email')
    }

    let authorURL = flags.authorURL || await CliUx.ux.prompt('Enter this app authors website (optional)', { required: false })

    while (authorURL.trim() && !this.URL_REGEX.test(authorURL)) {
      console.log(chalk.red('Invalid URL. Please make sure your website begins with "http://" or "https://" and try again (Enter to skip)'))
      authorURL = await CliUx.ux.prompt('Enter this apps URL', { required: false })
    }



    const appName = flags.appName || await CliUx.ux.prompt('Enter a name for this new app')
    const scaffoldUrl = 'https://codeload.github.com/tipenehughes/original-apps-scaffold-v1/zip/main'

    try {
      await this.downloadScaffoldsRepo(scaffoldUrl)
      await this.extractScaffoldIfExists(flagScaffold, directoryName)
    } catch (err) {
      throw new CLIError(chalk.red(`Download of scaffold structure failed with error: ${err}`))
    }

    this.modifyManifest(directoryName, appName, authorName, authorEmail, flagScaffold, location, authorURL )
    flagScaffold === 'react' && this.modifyWebpack(directoryName, location)
    flagScaffold === 'react' && this.copyLocationDirectories(directoryName, location)
    console.log(chalk.green(`Successfully created new project ${directoryName}`))
  }
}
