function writeLog(level, message, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(message, context = {}) {
  writeLog('info', message, context);
}

export function logWarn(message, context = {}) {
  writeLog('warn', message, context);
}

export function logError(message, error, context = {}) {
  writeLog('error', message, {
    ...context,
    errorName: error?.name,
    errorCode: error?.code,
    errorMessage: error?.message,
    stack: error?.stack,
  });
}
