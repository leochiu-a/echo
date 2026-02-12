import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import readline from 'node:readline'
import { summarizeCLIErrorMessage } from '@shared/domain/error-summary'
import { composePrompt, normalizeOutput } from '@shared/domain/prompt'
import type { AppSettings, CopilotAction, TokenUsage } from '@shared/domain/types'
import { enrichedPathEnv } from '@shared/utils/environment'

export interface RuntimeRunRequest {
  command: string
  action: CopilotAction
  selectedText: string | null
}

export interface RuntimeRunResult {
  stdout: string
  stderr: string
  exitCode: number
  tokenUsage: TokenUsage | null
}

export type RuntimeStreamEvent =
  | { type: 'started' }
  | { type: 'delta'; delta: string }
  | { type: 'completed'; result: RuntimeRunResult }
  | { type: 'failed'; message: string }
  | { type: 'cancelled' }

interface AppServerTurnOutcome {
  output: string
  tokenUsage: TokenUsage | null
  status: string
  errorMessage: string | null
}

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void
  reject: (error: Error) => void
}

interface TurnState {
  threadId: string
  turnId: string | null
  output: string
  tokenUsage: TokenUsage | null
  errorMessage: string | null
  resolve: (value: AppServerTurnOutcome) => void
  reject: (error: Error) => void
}

const APP_SERVER_COMMAND = 'codex app-server'
const REQUEST_TIMEOUT_MS = 60_000

export class CodexRuntimeService {
  private process: ChildProcessWithoutNullStreams | null = null
  private stdinWritable: NodeJS.WritableStream | null = null
  private stdoutReader: readline.Interface | null = null
  private stderrPath: string | null = null
  private stderrWriter: ReturnType<typeof createWriteStream> | null = null
  private threadId: string | null = null
  private pendingRequests = new Map<number, PendingRequest>()
  private nextRequestId = 100
  private currentTurn: TurnState | null = null
  private readonly lifecycleEvents = new EventEmitter()
  private running = false

  async prewarm(settings: AppSettings): Promise<void> {
    try {
      await this.ensureSession(settings.codexModel)
    } catch {
      // Prewarm intentionally swallows errors. Runtime execution surfaces full details.
    }
  }

  isRunning(): boolean {
    return this.running
  }

  async run(
    request: RuntimeRunRequest,
    settings: AppSettings,
    onEvent: (event: RuntimeStreamEvent) => void
  ): Promise<void> {
    if (this.running) {
      throw new Error('Another prompt execution is still running.')
    }

    this.running = true
    onEvent({ type: 'started' })

    try {
      const prompt = composePrompt(request.command, request.selectedText, request.action)
      const outcome = await this.executeTurnWithTimeout(prompt, settings)
      const stdout = normalizeOutput(outcome.output)

      const result: RuntimeRunResult =
        outcome.status === 'completed'
          ? {
              stdout,
              stderr: '',
              exitCode: 0,
              tokenUsage: outcome.tokenUsage
            }
          : {
              stdout,
              stderr: outcome.errorMessage?.trim() || `App server turn ${outcome.status}.`,
              exitCode: 1,
              tokenUsage: outcome.tokenUsage
            }

      onEvent({ type: 'completed', result })
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        onEvent({ type: 'cancelled' })
        return
      }

      const stderr = this.stderrSnapshot()
      const message = stderr ? summarizeCLIErrorMessage(stderr) : (error as Error).message
      onEvent({ type: 'failed', message })
    } finally {
      this.running = false
    }
  }

  async cancel(): Promise<void> {
    await this.resetSession(new Error('Cancelled by user.'))
  }

  async dispose(): Promise<void> {
    await this.resetSession(new Error('Runtime disposed.'))
  }

  private async executeTurnWithTimeout(prompt: string, settings: AppSettings): Promise<AppServerTurnOutcome> {
    const timeoutHandle = setTimeout(() => {
      this.lifecycleEvents.emit('timeout')
    }, REQUEST_TIMEOUT_MS)

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        const handler = () => {
          this.lifecycleEvents.off('timeout', handler)
          reject(new Error('Codex execution timed out.'))
        }
        this.lifecycleEvents.on('timeout', handler)
      })

      return await Promise.race([
        this.executeTurn(prompt, settings.codexModel, settings.codexReasoningEffort),
        timeoutPromise
      ])
    } catch (error) {
      await this.resetSession(error as Error)
      throw error
    } finally {
      clearTimeout(timeoutHandle)
    }
  }

  private async executeTurn(
    prompt: string,
    model: string,
    reasoningEffort: string
  ): Promise<AppServerTurnOutcome> {
    await this.ensureSession(model)

    if (!this.threadId) {
      throw new Error('Missing app-server thread id.')
    }
    if (this.currentTurn) {
      throw new Error('Another app-server turn is in progress.')
    }

    return await new Promise<AppServerTurnOutcome>((resolve, reject) => {
      this.currentTurn = {
        threadId: this.threadId as string,
        turnId: null,
        output: '',
        tokenUsage: null,
        errorMessage: null,
        resolve,
        reject
      }

      void this
        .sendRequest('turn/start', turnStartParams(this.threadId as string, prompt, model, reasoningEffort))
        .then((response) => {
          const turnId = extractTurnIdFromTurnStartResponse(response)
          if (!this.currentTurn) {
            return
          }
          this.currentTurn.turnId = turnId
        })
        .catch((error) => {
          this.finishCurrentTurnWithFailure(error as Error)
        })
    })
  }

  private async ensureSession(model: string): Promise<void> {
    if (this.process && !this.process.killed && this.threadId) {
      return
    }

    await this.resetSession(new Error('App-server session restarted.'))

    const child = spawn('/bin/zsh', ['-lc', APP_SERVER_COMMAND], {
      env: enrichedPathEnv(process.env),
      stdio: 'pipe'
    })

    this.process = child
    this.stdinWritable = child.stdin
    this.stderrPath = this.makeStderrPath()
    this.stderrWriter = createWriteStream(this.stderrPath, { flags: 'w' })

    child.stderr.on('data', (chunk: Buffer) => {
      this.stderrWriter?.write(chunk)
    })

    this.stdoutReader = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity
    })

    this.stdoutReader.on('line', (rawLine) => {
      this.handleIncomingLine(rawLine)
    })

    child.on('exit', () => {
      void this.resetSession(new Error('App-server stream ended unexpectedly.'))
    })

    await this.sendRequest('initialize', initializeParams())
    this.sendNotification('initialized', undefined)

    const threadResponse = await this.sendRequest('thread/start', threadStartParams(model))
    const threadId = extractThreadIdFromThreadStartResponse(threadResponse)

    if (!threadId) {
      throw new Error('Missing thread id from thread/start response.')
    }

    this.threadId = threadId
  }

  private async sendRequest(method: string, params?: unknown): Promise<Record<string, unknown>> {
    if (!this.process || this.process.killed || !this.stdinWritable) {
      throw new Error('App-server process is not running.')
    }

    const requestId = this.nextRequestId
    this.nextRequestId += 1

    const payload: Record<string, unknown> = {
      jsonrpc: '2.0',
      id: requestId,
      method
    }

    if (typeof params !== 'undefined') {
      payload.params = params
    }

    const encoded = JSON.stringify(payload)

    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject })
      this.stdinWritable?.write(`${encoded}\n`, (error) => {
        if (!error) {
          return
        }

        this.pendingRequests.delete(requestId)
        reject(error)
      })
    })
  }

  private sendNotification(method: string, params?: unknown): void {
    if (!this.stdinWritable) {
      throw new Error('App-server stdin is unavailable.')
    }

    const payload: Record<string, unknown> = {
      jsonrpc: '2.0',
      method
    }

    if (typeof params !== 'undefined') {
      payload.params = params
    }

    this.stdinWritable.write(`${JSON.stringify(payload)}\n`)
  }

  private handleIncomingLine(rawLine: string): void {
    const line = rawLine.trim()
    if (!line) {
      return
    }

    let message: Record<string, unknown>
    try {
      message = JSON.parse(line) as Record<string, unknown>
    } catch {
      return
    }

    const responseId = extractRequestId(message)
    if (typeof responseId === 'number' && this.pendingRequests.has(responseId)) {
      const pending = this.pendingRequests.get(responseId) as PendingRequest
      this.pendingRequests.delete(responseId)
      pending.resolve(message)
      return
    }

    const method = message.method
    const params = message.params
    if (typeof method !== 'string' || !isRecord(params)) {
      return
    }

    if (method === 'turn/started') {
      const turnId = extractTurnIdFromTurnStartedNotification(params)
      if (this.currentTurn && turnId) {
        this.currentTurn.turnId = turnId
      }
      return
    }

    if (method === 'item/agentMessage/delta') {
      if (!this.matchesCurrentTurn(params)) {
        return
      }

      const delta = typeof params.delta === 'string' ? params.delta : ''
      if (!delta) {
        return
      }

      if (this.currentTurn) {
        this.currentTurn.output += delta
      }
      return
    }

    if (method === 'item/completed') {
      if (!this.matchesCurrentTurn(params) || !this.currentTurn) {
        return
      }

      const item = params.item
      if (!isRecord(item)) {
        return
      }

      const itemType = item.type
      const text = item.text
      if (itemType === 'agentMessage' && typeof text === 'string' && text && !this.currentTurn.output) {
        this.currentTurn.output = text
      }
      return
    }

    if (method === 'thread/tokenUsage/updated') {
      if (!this.matchesCurrentTurn(params) || !this.currentTurn) {
        return
      }
      this.currentTurn.tokenUsage = extractTokenUsage(params) ?? this.currentTurn.tokenUsage
      return
    }

    if (method === 'turn/completed') {
      if (!this.matchesCurrentThread(params) || !this.currentTurn) {
        return
      }

      const status = extractTurnStatus(params) ?? 'failed'
      const errorMessage = extractTurnErrorMessage(params) ?? this.currentTurn.errorMessage

      const outcome: AppServerTurnOutcome = {
        output: this.currentTurn.output,
        tokenUsage: this.currentTurn.tokenUsage,
        status,
        errorMessage
      }

      this.finishCurrentTurnWithSuccess(outcome)
      return
    }

    if (method === 'error' && this.currentTurn) {
      this.currentTurn.errorMessage = typeof params.message === 'string' ? params.message : this.currentTurn.errorMessage
    }
  }

  private matchesCurrentThread(params: Record<string, unknown>): boolean {
    const expectedThreadId = this.currentTurn?.threadId ?? this.threadId
    const receivedThreadId = params.threadId

    if (!expectedThreadId || typeof receivedThreadId !== 'string') {
      return true
    }

    return receivedThreadId === expectedThreadId
  }

  private matchesCurrentTurn(params: Record<string, unknown>): boolean {
    if (!this.matchesCurrentThread(params)) {
      return false
    }

    if (!this.currentTurn?.turnId) {
      return true
    }

    const receivedTurnId = params.turnId
    if (typeof receivedTurnId !== 'string') {
      return true
    }

    return receivedTurnId === this.currentTurn.turnId
  }

  private finishCurrentTurnWithSuccess(outcome: AppServerTurnOutcome): void {
    if (!this.currentTurn) {
      return
    }

    const turn = this.currentTurn
    this.currentTurn = null
    turn.resolve(outcome)
  }

  private finishCurrentTurnWithFailure(error: Error): void {
    if (!this.currentTurn) {
      return
    }

    const turn = this.currentTurn
    this.currentTurn = null
    turn.reject(error)
  }

  private stderrSnapshot(): string {
    if (!this.stderrPath || !existsSync(this.stderrPath)) {
      return ''
    }

    try {
      return readFileSync(this.stderrPath, 'utf8')
    } catch {
      return ''
    }
  }

  private async resetSession(error: Error): Promise<void> {
    this.threadId = null

    if (this.stdoutReader) {
      this.stdoutReader.removeAllListeners()
      this.stdoutReader.close()
      this.stdoutReader = null
    }

    if (this.process && !this.process.killed) {
      this.process.removeAllListeners()
      this.process.kill('SIGTERM')
    }
    this.process = null

    if (this.stdinWritable) {
      this.stdinWritable.end()
      this.stdinWritable = null
    }

    if (this.stderrWriter) {
      this.stderrWriter.end()
      this.stderrWriter = null
    }

    if (this.stderrPath && existsSync(this.stderrPath)) {
      try {
        unlinkSync(this.stderrPath)
      } catch {
        // Ignore cleanup failures.
      }
    }
    this.stderrPath = null

    for (const [id, pending] of this.pendingRequests) {
      pending.reject(error)
      this.pendingRequests.delete(id)
    }

    this.finishCurrentTurnWithFailure(error)
  }

  private makeStderrPath(): string {
    const dir = join(tmpdir(), 'echo-electron-runtime')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return join(dir, `stderr-${randomUUID()}.log`)
  }
}

function initializeParams(): Record<string, unknown> {
  return {
    clientInfo: {
      name: 'echo',
      version: '0.1.0'
    },
    capabilities: {
      experimentalApi: false
    }
  }
}

function threadStartParams(model: string): Record<string, unknown> {
  const params: Record<string, unknown> = {
    approvalPolicy: 'never',
    sandbox: 'danger-full-access',
    experimentalRawEvents: false
  }

  const trimmedModel = model.trim()
  if (trimmedModel) {
    params.model = trimmedModel
  }

  return params
}

function turnStartParams(
  threadId: string,
  prompt: string,
  model: string,
  reasoningEffort: string
): Record<string, unknown> {
  const params: Record<string, unknown> = {
    threadId,
    input: [
      {
        type: 'text',
        text: prompt,
        text_elements: []
      }
    ],
    approvalPolicy: 'never',
    sandboxPolicy: {
      type: 'dangerFullAccess'
    },
    summary: 'none'
  }

  const trimmedModel = model.trim()
  if (trimmedModel) {
    params.model = trimmedModel
  }

  const trimmedEffort = reasoningEffort.trim()
  if (trimmedEffort) {
    params.effort = trimmedEffort
  }

  return params
}

function extractRequestId(message: Record<string, unknown>): number | null {
  const id = message.id
  if (typeof id === 'number') {
    return id
  }

  if (typeof id === 'string') {
    const parsed = Number.parseInt(id, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function extractThreadIdFromThreadStartResponse(message: Record<string, unknown>): string | null {
  const result = message.result
  if (!isRecord(result)) {
    return null
  }

  const thread = result.thread
  if (!isRecord(thread)) {
    return null
  }

  return typeof thread.id === 'string' ? thread.id : null
}

function extractTurnIdFromTurnStartResponse(message: Record<string, unknown>): string | null {
  const result = message.result
  if (!isRecord(result)) {
    return null
  }

  const turn = result.turn
  if (!isRecord(turn)) {
    return null
  }

  return typeof turn.id === 'string' ? turn.id : null
}

function extractTurnIdFromTurnStartedNotification(params: Record<string, unknown>): string | null {
  const turn = params.turn
  if (!isRecord(turn)) {
    return null
  }

  return typeof turn.id === 'string' ? turn.id : null
}

function extractTurnStatus(params: Record<string, unknown>): string | null {
  const turn = params.turn
  if (!isRecord(turn)) {
    return null
  }

  return typeof turn.status === 'string' ? turn.status : null
}

function extractTurnErrorMessage(params: Record<string, unknown>): string | null {
  const turn = params.turn
  if (!isRecord(turn)) {
    return null
  }

  const error = turn.error
  if (!isRecord(error)) {
    return null
  }

  return typeof error.message === 'string' ? error.message : null
}

function extractTokenUsage(params: Record<string, unknown>): TokenUsage | null {
  const tokenUsage = params.tokenUsage
  if (!isRecord(tokenUsage)) {
    return null
  }

  const last = tokenUsage.last
  if (!isRecord(last)) {
    return null
  }

  return {
    inputTokens: numberFromUnknown(last.inputTokens),
    outputTokens: numberFromUnknown(last.outputTokens),
    totalTokens: numberFromUnknown(last.totalTokens)
  }
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value)
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
