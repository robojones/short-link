const express = require('express')
const path = require('path')
const app = express()
const marko = require('express-marko')

app.set('views', 'views')

app.use(marko)

app.use('/static', express.static('public'))

app.get('/', (req, res, next) => {
  res.render('index', {
    name: 'jonés',
    link: 'http://asdf.de/huhn'
  })
})

app.use((req, res, next) => {
  console.log(req.url)
})

app.get('/*', (req, res, next) => {
  next()
})

app.use((req, res, next) => {
  res.status(404)
  res.send('404 NOT FOUND')
})

app.listen(+process.env.PORT)
