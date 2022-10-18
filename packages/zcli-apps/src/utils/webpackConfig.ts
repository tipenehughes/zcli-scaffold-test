import { Manifest } from '../types'
import { validatePath } from './fileUtils'
import * as path from 'path'
import * as fs from 'fs'
import * as chalk from 'chalk'
import { CLIError } from '@oclif/core/lib/errors'

export const getWebpackFile = (appPath: string): Manifest => {
  const webpackFilePath = path.join(appPath, 'manifest.json')
  validatePath(webpackFilePath)

  const webpack = fs.readFileSync(webpackFilePath, 'utf8')
  return JSON.parse(webpack)
}

export const updateWebpackFile = (appPath: string, manifestContent: Manifest): void => {
  const webpackFilePath = path.join(appPath, 'manifest.json')
  validatePath(webpackFilePath)
  try {
    fs.writeFileSync(webpackFilePath, JSON.stringify(manifestContent, null, 2))
  } catch (error) {
    throw new CLIError(chalk.red(`Failed to update webpack file at path: ${webpackFilePath}. ${error}`))
  }
}