export function enrichedPathEnv(currentEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...currentEnv }
  const existing = env.PATH ?? ''
  const required = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']

  const merged: string[] = []
  for (const segment of existing.split(':').filter(Boolean)) {
    if (!merged.includes(segment)) {
      merged.push(segment)
    }
  }

  for (const segment of required) {
    if (!merged.includes(segment)) {
      merged.push(segment)
    }
  }

  env.PATH = merged.join(':')
  return env
}
