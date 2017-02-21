const http = require('http')

const pack = require('./package.json')

const server = http.createServer((req, res) => {

})

server.listen(pack.ports[0])
