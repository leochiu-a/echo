import { describe, expect, it } from 'vitest'
import { composePrompt, normalizeOutput } from '@shared/domain/prompt'

describe('prompt compose and output normalization', () => {
  it('returns trimmed command when there is no selection', () => {
    const prompt = composePrompt('  improve text  ', null, 'edit')
    expect(prompt).toBe('improve text')
  })

  it('includes instruction and selected text for edit action', () => {
    const prompt = composePrompt('shorten', 'Line one.\nLine two.', 'edit')

    expect(prompt).toContain('User instruction:')
    expect(prompt).toContain('Selected text:')
    expect(prompt).toContain('Return only the final result text.')
  })

  it('includes question and context for askQuestion action', () => {
    const prompt = composePrompt('What is this about?', 'A short paragraph', 'askQuestion')

    expect(prompt).toContain('Question:')
    expect(prompt).toContain('Context:')
    expect(prompt).toContain('If context is insufficient, say so briefly.')
  })

  it('strips ANSI and trims output', () => {
    const normalized = normalizeOutput('  \u001B[31mError\u001B[0m  \n')
    expect(normalized).toBe('Error')
  })
})
