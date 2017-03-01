(function () {
  var header = document.getElementsByTagName('header')[0]
  var result = document.getElementById('result')
  var link = document.getElementById('link')
  var submit = document.getElementById('send')
  var short = document.getElementById('short')
  var message = document.getElementById('message')
  var reg = /^(?:https?:\/\/)?[^\/]+\.\w+\/?.*$/m

  link.disabled = false
  submit.disabled = false

  submit.addEventListener('click', function (ev) {
    ev.preventDefault()
    if(!reg.exec(link.value)) {
      error('Input is not a link!')
      return
    }
    header.classList.add('back')
    result.classList.remove('hidden')
    link.disabled = true
    submit.disabled = true
    short.select()
    send(link.value)
  })

  var timeout = null

  function error(err) {
    clearTimeout(timeout)
    message.innerHTML = err;
    message.classList.remove('hidden')
    timeout = setTimeout(function () {
      message.classList.add('hidden')
    }, 3000)
  }

  function send(link) {
    xhr = new XMLHttpRequest()
    var url = 'http://' + short.value + '/set'
    xhr.open('POST', url, true)
    xhr.setRequestHeader('Content-type', 'application/json')
    xhr.onreadystatechange = function () {
      if(xhr.readyState === 4 && xhr.status !== 200) {
        error('Link not created. Try again!')
      }
    }
    var data = JSON.stringify({
      link: link
    })
    xhr.send(data)
  }
})()
