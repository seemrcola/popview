function rawMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (typeof error === 'string' && error.trim()) return error.trim()
  return ''
}

const USER_MESSAGES: Array<[RegExp, string]> = [
  [/permission denied|access denied|拒绝访问|没有权限/i, '没有权限读取此位置'],
  [/not found|no such file|不存在/i, '文件夹或图片已不存在'],
  [/not a directory|不是文件夹/i, '请选择一个文件夹'],
  [/session.*invalid|会话已失效/i, '目录会话已失效，请重新选择文件夹'],
]

export function errorMessage(error: unknown, fallback = '操作失败') {
  return rawMessage(error) || fallback
}

export function userFacingError(error: unknown, fallback = '操作失败') {
  const message = rawMessage(error)
  return USER_MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? (message || fallback)
}
