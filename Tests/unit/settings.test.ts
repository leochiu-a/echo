import { describe, expect, it } from 'vitest'
import {
  availableSlashCommands,
  canonicalModel,
  canonicalReasoningEffort,
  normalizedSlashCommandName
} from '@shared/domain/settings'

describe('settings domain rules', () => {
  it('canonical model normalizes case', () => {
    expect(canonicalModel(' GPT-5.3-Codex ')).toBe('gpt-5.3-codex')
    expect(canonicalModel('gPt-5.2')).toBe('gpt-5.2')
  })

  it('canonical model rejects unsupported values', () => {
    expect(canonicalModel('gpt-4')).toBeNull()
    expect(canonicalModel('   ')).toBeNull()
  })

  it('canonical reasoning effort normalizes case', () => {
    expect(canonicalReasoningEffort(' HIGH ')).toBe('high')
    expect(canonicalReasoningEffort('xHiGh')).toBe('xhigh')
  })

  it('slash command names are normalized with strict format', () => {
    expect(normalizedSlashCommandName(' /Reply-Now ')).toBe('reply-now')
    expect(normalizedSlashCommandName('__draft123')).toBe('__draft123')
    expect(normalizedSlashCommandName('my cmd')).toBeNull()
  })

  it('available commands filters invalid and duplicated entries', () => {
    const commands = availableSlashCommands([
      { id: crypto.randomUUID(), command: 'Reply', prompt: 'first prompt' },
      { id: crypto.randomUUID(), command: '/reply', prompt: 'duplicate should drop' },
      { id: crypto.randomUUID(), command: 'bad command', prompt: 'invalid name' },
      { id: crypto.randomUUID(), command: 'empty-prompt', prompt: '  ' },
      { id: crypto.randomUUID(), command: 'summarize', prompt: ' summarize this ' }
    ])

    expect(commands.map((item) => item.command)).toEqual(['reply', 'summarize'])
    expect(commands[0]?.prompt).toBe('first prompt')
    expect(commands[1]?.prompt).toBe('summarize this')
  })
})
