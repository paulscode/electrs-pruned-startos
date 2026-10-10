import { sdk } from '../sdk'
import { config } from './config'
import { reindex } from './reindex'
import { selectBackend } from './selectBackend'

export const actions = sdk.Actions.of()
  .addAction(config)
  .addAction(selectBackend)
  .addAction(reindex)
