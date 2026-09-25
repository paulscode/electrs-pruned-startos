import { sdk } from '../sdk'
import { seedFiles } from './seedFiles'
import { chooseBackend } from './chooseBackend'
import { setDependencies } from '../dependencies'
import { setInterfaces } from '../interfaces'
import { versionGraph } from '../versions'
import { actions } from '../actions'
import { restoreInit } from '../backups'

export const init = sdk.setupInit(
  restoreInit,
  versionGraph,
  seedFiles,
  setInterfaces,
  setDependencies,
  actions,
  // After `actions`, because the task it may raise points at one of them.
  chooseBackend,
)

export const uninit = sdk.setupUninit(versionGraph)
