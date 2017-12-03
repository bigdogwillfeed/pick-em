module.exports = function(app, db) {
  
  app.get("/", function (req, res) {
    if (req.user) {
      // if we want to support multiple seasons, then this needs to be some sort of dashboard
      db.season.find(req.user).then(ixSeason => res.redirect(`/season/${ixSeason}/`))
    } else {
      // tell people what this thing is and how to get started
      // res.render('index.html', { title: "Pick 'em!" })
      res.redirect('/login')
    }
  });

  app.use(require('connect-ensure-login').ensureLoggedIn())

  app.get('/users', (req, res) => {
    db.user.fetch().then(users => res.send(users))
  })

  app.post('/season', (req, res, next) => {
    db.season.create(req.user, req.body.name)
    .then(id => res.send(id))
    .catch(next)
  })

  // content-type negotiation here... because I like the route for both UI and API
  app.get("/season/:id(\\d+)", (req, res, next) => {
    if (req.headers.accept && req.headers.accept.indexOf('json') > -1) {
      seasonAsJSON(req, res, next)
    } else {
      res.render('season.html', { user: req.user, precompiled: !process.env.DEBUG })
    }
  })

  function seasonAsJSON(req, res, next) {
    Promise.all([
      // we include user id when searching for the season, to limit viewing seasons to season members
      db.season.fetch(req.params.id, req.user.id),
      db.week.fetchAll(req.params.id, req.user.id).then(weeks => ({ weeks: weeks }))
    ])
    .then(sources => Object.assign({}, ...sources)) // combine the weeks and season together
    .then(season => season.id ? res.send(season) : res.status(404).send({error: 'no such season found'}))
    .catch(next)
  }

  app.post('/season/:id(\\d+)/week', (req, res, next) => {
    db.week.create(req.params.id, req.body.name, req.body.schedule)
    .then(id => res.send({ id: id }))
    .catch(next)
  })

  app.post('/week/:ixWeek(\\d+)/picks', (req, res, next) => {
    const message = 'Thanks for making your picks! You can update or change them until the first game starts, at which point you can see what everyone else picked.'
    db.week.pick(req.params.ixWeek, req.user.id, req.body.picks)
    .then(ok => ok ? res.send(message) : res.status(404).send("I can't seem to find the week you're looking for"))
    .catch(next)
  })

  app.post('/week/:ixWeek(\\d+)/close', (req, res, next) => {
    db.week.find(req.params.ixWeek, req.user)
      .then(db.week.close)
      .then(() => res.sendStatus(200))
      .catch(next)
  })

  app.post('/week/:ixWeek(\\d+)/winners', (req, res, next) => {
    db.week.find(req.params.ixWeek, req.user)
      .then(ixWeek => db.week.winners(ixWeek, req.body.picks))
      .then(() => res.sendStatus(200))
      .catch(next)
  })

  app.get('/join/:code', (req, res, next) => {
    db.season.join(req.params.code, req.user)
    .then(id => id ? res.redirect(`/season/${id}/`) : res.sendStatus(404))
    .catch(next)
  })

  if (process.env.DEBUG) {
    app.post('/debug/join/:code/:ixUser(\\d+)', (req, res) => {
      db.season.join(req.params.code, {id: req.params.ixUser})
      .then(id => id ? res.redirect(`/season/${id}/`) : res.sendStatus(404))
    })

    // debugging only... normally, make users submit their own picks :)
    app.post('/debug/week/:id(\\d+)/picks', (req, res) => {
      db.week.pick(req.params.id, req.body.user, req.body.picks)
      .then(() => res.sendStatus(200))
    })
  }
  
}