export function requireIntegerParam(name) {
  return (req, res, next) => {
    const raw = req.params[name];
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      return res.status(400).json({ error: `${name} must be a positive integer` });
    }
    next();
  };
}
