export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

export function errorHandler(error, req, res, next) {
  void next;
  const status = Number(error.status || error.statusCode || 500);
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: error.message || 'Internal server error',
    code: error.code || undefined,
  });
}
