module.exports = function flash() {
  return (req, res, next) => {
    if (!req.session) return next(new Error("Session is required for flash messages"));

    req.flash = (type, msg) => {
      // GET: req.flash("success")
      if (msg === undefined) {
        const msgs = (req.session._flash && req.session._flash[type]) || [];
        if (req.session._flash) delete req.session._flash[type];
        if (req.session._flash && Object.keys(req.session._flash).length === 0) {
          delete req.session._flash;
        }
        return msgs;
      }

      // SET: req.flash("success", "Hello")
      req.session._flash = req.session._flash || {};
      req.session._flash[type] = req.session._flash[type] || [];
      req.session._flash[type].push(msg);
      return req.session._flash[type];
    };

    next();
  };
};