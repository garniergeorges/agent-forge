// Action = anything the builder asks the system to do (write a file,
// launch an agent, …). Lives in MissionControl, NEVER in the chat
// transcript. The chat transcript only has prose.

export type ActionStatus =
  | 'proposed' // builder emitted it ; awaiting user approval
  | 'approved' // user approved ; about to run
  | 'running' // currently executing (e.g. agent streaming)
  | 'done' // finished successfully
  | 'failed' // finished with error
  | 'declined' // user declined

export type WriteAction = {
  id: string
  kind: 'write'
  status: ActionStatus
  path: string
  content: string
  createdAt: string
  finishedAt?: string
  result?: { absolutePath: string } | { error: string }
}

export type RunAction = {
  id: string
  kind: 'run'
  status: ActionStatus
  agent: string
  prompt: string
  createdAt: string
  finishedAt?: string
  output: string // streamed agent stdout, accumulated
  exitCode?: number
  error?: string
}

export type Action = WriteAction | RunAction

let counter = 0
export function nextActionId(): string {
  counter += 1
  return `a${counter.toString()}`
}
