const express = require('express')
const path = require('path')
const app = express()
const marko = require('express-marko')

app.set('views', 'views')

app.use(marko)

// app.use((req, res, next) => {
//   const views = path.resolve(app.get('views'))
//
//   res.render = (view, locals = {}, callback = res) => {
//     const template = path.join(views, view)
//     if(process.env.NODE_ENV === 'development') {
//       delete require.cache[require.resolve(template)]
//     }
//     require(template).render(locals, callback)
//   }
//
//   next()
// })

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
