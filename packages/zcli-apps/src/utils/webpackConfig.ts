import { validatePath } from './fileUtils'
import * as path from 'path'
import * as fs from 'fs'
import * as chalk from 'chalk'
import { CLIError } from '@oclif/core/lib/errors'

export const getWebpackFile = (appPath: string) => {
  const webpackFilePath = path.join(appPath, 'webpack.config.js')
  validatePath(webpackFilePath)

  const webpack = fs.readFileSync(webpackFilePath, 'utf8')
  return webpack;
}

export const updateWebpackFile = (appPath: string, webpackContent: any): void => {
  const webpackFilePath = path.join(appPath, 'webpack.config.js')
  validatePath(webpackFilePath)
  try {
    fs.writeFileSync(webpackFilePath, webpackContent);
  } catch (error) {
    throw new CLIError(chalk.red(`Failed to update webpack file at path: ${webpackFilePath}. ${error}`))
  }
}