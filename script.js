(function () {
  var canvas = document.getElementById('rain');
  var ctx = canvas.getContext('2d');
  var video = document.getElementById('bg-video');
  var spotlight = document.querySelector('.spotlight');
  var offscreen = document.createElement('canvas');
  var offCtx = offscreen.getContext('2d');

  var mouseX = -500;
  var mouseY = -500;
  var targetX = -500;
  var targetY = -500;
  var fontSize = 14;
  var cols, rows;
  var asciiChars = ' .,:;+*?%S#@'.split('');
  var charCount = asciiChars.length;
  var videoReady = false;
  var drops = [];
  var speeds = [];

  function setVideoSource(url) {
    if (!url) return;
    var source = document.createElement('source');
    source.src = url;
    source.type = 'video/mp4';
    video.appendChild(source);
    video.load();
  }

  video.addEventListener('loadeddata', function () {
    videoReady = true;
    video.play().catch(function () {});
  });

  video.addEventListener('error', function () {
    videoReady = false;
  });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    cols = Math.floor(canvas.width / fontSize);
    rows = Math.floor(canvas.height / fontSize);

    while (drops.length < cols) {
      drops.push(Math.floor(Math.random() * -canvas.height / fontSize));
      speeds.push(0.4 + Math.random() * 1.2);
    }
  }

  function brightnessToChar(brightness) {
    var idx = Math.floor((brightness / 255) * (charCount - 1));
    return asciiChars[Math.max(0, Math.min(charCount - 1, idx))];
  }

  function drawVideoAscii() {
    if (!videoReady || video.readyState < 2) return;

    offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
    var imageData = offCtx.getImageData(0, 0, cols, rows);
    var pixels = imageData.data;

    ctx.fillStyle = 'rgba(10, 10, 10, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = fontSize + 'px "Space Grotesk", monospace';

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var idx = (y * cols + x) * 4;
        var r = pixels[idx];
        var g = pixels[idx + 1];
        var b = pixels[idx + 2];
        var brightness = 0.299 * r + 0.587 * g + 0.114 * b;

        var dx = x * fontSize - mouseX;
        var dy = y * fontSize - mouseY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var spotlightRadius = 300;
        var glow = dist < spotlightRadius ? 1 - dist / spotlightRadius : 0;
        glow = glow * glow * 0.6;

        var alpha = 0.08 + glow * 0.2 + (brightness / 255) * 0.08;
        ctx.fillStyle = 'rgba(235, 235, 235, ' + alpha.toFixed(3) + ')';
        ctx.fillText(brightnessToChar(brightness), x * fontSize, (y + 1) * fontSize);
      }
    }
  }

  function drawBinaryRain() {
    ctx.fillStyle = 'rgba(10, 10, 10, 0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = fontSize + 'px "Space Grotesk", monospace';

    for (var i = 0; i < cols; i++) {
      var char = Math.random() > 0.5 ? '1' : '0';
      var x = i * fontSize;
      var y = drops[i] * fontSize;

      var dx = x - mouseX;
      var dy = y - mouseY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var spotlightRadius = 300;
      var glow = dist < spotlightRadius ? 1 - dist / spotlightRadius : 0;
      glow = glow * glow;

      var alpha = 0.08 + glow * 0.18;

      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }

      ctx.fillStyle = 'rgba(235, 235, 235, ' + alpha.toFixed(3) + ')';
      ctx.fillText(char, x, y);
      drops[i] += speeds[i];
    }
  }

  function draw() {
    if (videoReady) {
      drawVideoAscii();
    } else {
      drawBinaryRain();
    }

    mouseX += (targetX - mouseX) * 0.1;
    mouseY += (targetY - mouseY) * 0.1;
  }

  function updateSpotlight() {
    spotlight.style.background =
      'radial-gradient(circle 300px at ' + mouseX + 'px ' + mouseY + 'px, ' +
      'rgba(235, 235, 235, 0.03) 0%, transparent 70%)';
  }

  function onMouseMove(e) {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!spotlight.classList.contains('active')) {
      spotlight.classList.add('active');
    }
  }

  function onMouseLeave() {
    targetX = -500;
    targetY = -500;
    spotlight.classList.remove('active');
  }

  function fadeIn() {
    var els = document.querySelectorAll('.hero, .socials, footer');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.add('visible');
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseleave', onMouseLeave);

  resize();
  setInterval(draw, 42);
  setInterval(updateSpotlight, 50);
  setTimeout(fadeIn, 200);

  window.setAsciiVideo = setVideoSource;
})();
