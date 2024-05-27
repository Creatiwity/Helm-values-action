import * as core from '@actions/core'
import { wait } from './wait'
import * as github from '@actions/github'
import fs from 'fs/promises'
import Mustache from 'mustache'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  const context = github.context
  const valueFiles = getValueFiles(getInput('value_files'))
  const secrets = getSecrets(core.getInput('secrets'))
  const values = getValues(getInput('values'))

  await fs.writeFile('./values.yml', values)

  await renderFiles(valueFiles.concat(['./values.yml']), {
    secrets,
    deployment: context.payload.deployment
  })
}

function getInput(name: string) {
  const context = github.context
  const deployment = context.payload.deployment
  let val = core.getInput(name.replace('_', '-'), {
    required: false
  })
  if (deployment) {
    if (deployment[name]) val = deployment[name]
    if (deployment.payload[name]) val = deployment.payload[name]
  }

  return val
}

function getValues(values: string) {
  if (!values) {
    return '{}'
  }
  if (typeof values === 'object') {
    return JSON.stringify(values)
  }
  return values
}

function renderFiles(files: string[], data: Record<string, any>) {
  core.debug(
    `rendering value files [${files.join(',')}] with: ${JSON.stringify(data)}`
  )
  const tags: [string, string] = ['${{', '}}']
  const promises = files.map(async file => {
    const content = await fs.readFile(file, { encoding: 'utf8' })
    const rendered = Mustache.render(content, data, {}, tags)
    await fs.writeFile(file, rendered)
  })
  return Promise.all(promises)
}

function getSecrets(secrets: string) {
  if (typeof secrets === 'string') {
    try {
      return JSON.parse(secrets)
    } catch (err) {
      return secrets
    }
  }
  return secrets
}

function getValueFiles(files: string[] | string) {
  let fileList

  if (typeof files === 'string') {
    try {
      fileList = JSON.parse(files)
    } catch (err) {
      // Assume it's a single string.
      fileList = [files]
    }
  } else {
    fileList = files
  }
  if (!Array.isArray(fileList)) {
    return []
  }
  return fileList.filter(f => !!f)
}
