module.exports = (req, res, next) => {
    if ((req.get('X-Forwarded-Proto') !== 'https')) {
        return res.redirect('https://' + req.get('hostname') + req.url);
    }

    return next();
};