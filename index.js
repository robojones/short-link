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

const reg = /^(?:https?:\/\/)?[^\/]+\.\w+\/?.*$/m
const DAY = 1000 * 60 * 60 * 24
const MONTH = DAY * 30

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

    const key = req.cookies['key'] || crypto.randomBytes(128).toString('hex')

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
            expire: Date.now() + DAY
          }
        }).then(r => {
          if(!r || !r.result.nModified) { // not modified
            return
          }
          console.log('got old link:', result._id)
          return result._id
        })
      }).catch(err => {
        if(err.code !== 11000) { // ignore timeout or duplicate
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
          expire: Date.now() + DAY
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

      res.cookie('key', key, {
        maxAge: DAY
      })

      let link = '2short.io/' + idString

      if(process.env.NODE_ENV === 'development') {
        link = `huhn:${process.env.PORT}/${idString}`
      }

      res.render('index', {
        link: link
      })
    }).catch(err => {
      next(err)
    })
  })

  app.post('/:id/set', (req, res, next) => {
    const id = req.params.id
    if(id.length > 8) {
      return next()
    }

    try {
      req.idNumber = short.decode(id)
    } catch(err) {
      res.status(404).send('Not Found')
      return next()
    }

    let link = req.body.link

    if(!link || !reg.exec(link.split('\n').shift())) {
      return res.status(400).send('Bad Request')
    }

    if(!/https?:\/\/.*/.exec(link)) {
      link = 'http://' + link
    }

    const key = req.cookies['key']

    if(!key) {
      console.log('no key')
      return res.status(403).send('Forbidden')
    }

    db.collection('links').update({
      _id: req.idNumber,
      key: key,
      expire: {
        $gt: Date.now()
      }
    }, {
      $set: {
        link: link,
        expire: Date.now() + MONTH
      }
    }).then(stats => {
      console.log('done')
      res.status(200).send('ok')
    }).catch(err => {
      console.log(err)
      next(err)
    })
    console.log(`set _id=${req.idNumber} to ${req.body.link}`)
  })

  app.get('/:id/', (req, res, next) => {
    const id = req.params.id
    if(id.length > 8) {
      return next()
    }

    try {
      req.idNumber = short.decode(id)
    } catch(err) {
      return next()
    }

    db.collection('links').find({
      _id: req.idNumber,
      expire: {
        $gt: Date.now()
      }
    }).limit(1).next().then(data => {

      if(!data || !data.link) {
        return next()
      }

      res.redirect(data.link)
    }).catch(err => {
      next(err)
    })
  })

  app.listen(+process.env.PORT)
})
