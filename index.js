const mongodb = require('mongodb')
const MongoClient = mongodb.MongoClient
const express = require('express')
const path = require('path')
const app = express()
const marko = require('express-marko')
const Charcoder = require('charcoder')
const short = new Charcoder(Charcoder.B62)
const crypto = require('crypto')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')

const MONTH = 1000 * 60 * 60 * 24 * 30

MongoClient.connect('mongodb://localhost:27017/short-link', (err, db) => {
  if(err) {
    throw err
  }

  db.collection('links').insert({
    _id: 0,
    index: 1
  }).catch(err => {
    if(err.code !== 11000) {
      console.error(err)
      process.exit(1)
    }
  })

  // app

  app.set('views', 'views')

  app.use(marko)

  app.use('/static', express.static('public'))

  app.use(cookieParser())

  app.use(bodyParser.json())

  app.get('/', (req, res, next) => {
    // 1. find
    // 2. try to insert (error -> 1.)
    // 3. increment

    // important: when overwriting old use $lt{expire: Date.now()}

    const key = crypto.randomBytes(128).toString('hex')

    function getOldNumber() {
      return db.collection('links').find({
        expire: {
          $lt: Date.now()
        }
      }).limit(1).maxTimeMS(100).next().then(result => {
        if(!result) {
          return
        }
        return db.collection('links').update(result, {
          $set: {
            key: key,
            link: null,
            expire: Date.now() + MONTH
          }
        })
      }).then(r => {
        console.log(r)
        if(!r || !r.result.nModified) { // not modified
          return
        }
        return r._id
      }).catch(err => {
        if(err.code !== 50 && err.code !== 11000) { // ignore timeout or duplicate
          throw err
        }
      })
    }

    function getNumber() {
      return db.collection('links').find({ // get index
        _id: 0
      }).limit(1).next().then(config => {
        const idNumber = config.index

        return db.collection('links').insert({ // try to insert
          _id: idNumber,
          key: key,
          link: null,
          expire: Date.now() + MONTH
        }).then(stats => {

          return db.collection('links').update({ // increment
            _id: 0
          }, {
            $inc: {
              index: 1
            }
          }).then(() => {

            return idNumber
          })
        })
      }).catch(err => {
        console.error(err)
        return getNumber()
      })
    }

    getOldNumber().then(number => {
      if(number) {
        return number
      } else {
        return getNumber()
      }
    }).then(idNumber => {
      console.log(idNumber)

      const idString = short.encode(idNumber)

      res.cookie('short:' + idString, key, {
        maxAge: MONTH
      })

      res.render('index', {
        link: 'http://localhost:8080/' + idString
      })
    }).catch(err => {
      next(err)
    })
  })

  app.post('/:id/set', (req, res, next) => {
    const id = req.params.id
    if(id.length > 16) {
      next()
    }

    try {
      req.idNumber = short.decode(id)
    } catch(err) {
      res.status(404).send('Not Found')
      return
    }

    if(!req.body.link) {
      res.status(400).send('Bad Request')
      return
    }

    if(!/https?:\/\/.*/.exec(req.body.link)) {
      req.body.link = 'http://' + req.body.link
    }

    const key = req.cookies['short:' + req.params.id]

    if(!key) {
      console.log('no key', key)
      res.status(403).send('Forbidden')
      return
    }
    db.collection('links').update({
      _id: req.idNumber,
      key: key,
      expire: {
        $gt: Date.now()
      }
    }, {
      $set: {
        link: req.body.link
      }
    }).then(stats => {
      res.status(200).send('')
    }).catch(err => {
      next(err)
    })
    console.log('req.body', req.body)
  })

  app.get('/:id/', (req, res, next) => {
    const id = req.params.id
    if(id.length > 16) {
      next()
    }

    try {
      req.idNumber = short.decode(id)
    } catch(err) {
      res.status(404).send('Not Found')
      return
    }

    console.log('idNumber:', req.idNumber)
    console.log('query:', {
      id: req.idNumber,
      expire: {
        $gt: Date.now()
      }
    })
    db.collection('links').find({
      _id: req.idNumber,
      expire: {
        $gt: Date.now()
      }
    }).limit(1).next().then(data => {
      console.log(data)
      if(!data || !data.link) {
        next()
        return
      }

      res.redirect(data.link)
    }).catch(err => {
      next(err)
    })
  })

  app.listen(+process.env.PORT)
})
