(function () {
  var canvas = document.getElementById('rain');
  var ctx = canvas.getContext('2d');
  var columns = [];
  var fontSize = 18;
  var drops = [];
  var speeds = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.floor(canvas.width / fontSize);
    while (drops.length < columns) {
      drops.push(Math.floor(Math.random() * -canvas.height / fontSize));
      speeds.push(0.4 + Math.random() * 1.2);
    }
  }

  function draw() {
    ctx.fillStyle = 'rgba(10, 10, 10, 0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(235, 235, 235, 0.12)';
    ctx.font = fontSize + 'px "Space Grotesk", monospace';

    for (var i = 0; i < columns; i++) {
      var char = Math.random() > 0.5 ? '1' : '0';
      var x = i * fontSize;
      var y = drops[i] * fontSize;

      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }

      ctx.fillText(char, x, y);
      drops[i] += speeds[i];
    }
  }

  function fadeIn() {
    var els = document.querySelectorAll('.hero, .socials, footer');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.add('visible');
    }
  }

  window.addEventListener('resize', resize);
  resize();
  setInterval(draw, 42);
  setTimeout(fadeIn, 200);
})();
