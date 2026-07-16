(function () {
  var canvas = document.getElementById('rain');
  var ctx = canvas.getContext('2d');
  var video = document.getElementById('bg-video');
  var spotlight = document.querySelector('.spotlight');
  var offscreen = document.createElement('canvas');
  var offCtx = offscreen.getContext('2d', { willReadFrequently: true });

  var mouseX = -500;
  var mouseY = -500;
  var targetX = -500;
  var targetY = -500;
  var fontSize = 14;
  var cols, rows;
  var density = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYZXcvunxrj/ft\\|()1{}[]?_-+~<>i!lI;:\",^'.  ";
  var densityLen = density.length;
  var videoReady = false;
  var videoW, videoH;
  var drops = [];
  var speeds = [];
  var tileOpacity = 0.5;
  var glyphOpacity = 1.0;
  var gamma = 1.6;

  var glowPoints = [];
  var MAX_GLOW_POINTS = 64;
  var glowRadiusMultiplier = 6;
  var glowDuration = 1;
  var glowInnerFrac = 0.99;
  var glowFalloffExp = 0.1;
  var glowShrinkStrength = 0.2;
  var glowLumaGain = 0.6;
  var glowLumaExp = 1.5;
  var stampInterval = 25;
  var lastStamp = 0;

  function setVideoSource(url) {
    if (!url) return;
    var source = document.createElement('source');
    source.src = url;
    source.type = 'video/mp4';
    video.appendChild(source);
    video.load();
  }

  video.addEventListener('loadeddata', function () {
    videoW = video.videoWidth;
    videoH = video.videoHeight;
    videoReady = true;
    video.play().catch(function () {});
  });

  video.addEventListener('error', function () {
    videoReady = false;
  });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    fontSize = window.innerWidth > 1600 ? 16 : 14;
    cols = Math.floor(canvas.width / fontSize);
    rows = Math.floor(canvas.height / fontSize);
    offscreen.width = cols;
    offscreen.height = rows;

    while (drops.length < cols) {
      drops.push(Math.floor(Math.random() * -canvas.height / fontSize));
      speeds.push(0.4 + Math.random() * 1.2);
    }
  }

  function stampGlow() {
    if (targetX < 0 || targetY < 0) return;
    var now = performance.now();
    if (now - lastStamp < stampInterval) return;
    lastStamp = now;
    glowPoints.push({ x: targetX, y: targetY, t: now / 1000 });
    while (glowPoints.length > MAX_GLOW_POINTS) glowPoints.shift();
  }

  function getGlowAmount(cx, cy, nowSec) {
    if (glowPoints.length === 0) return 0;
    var r = glowRadiusMultiplier * fontSize;
    var total = 0;
    var first = glowPoints[0];
    for (var i = 0; i < glowPoints.length; i++) {
      var gp = glowPoints[i];
      var age = nowSec - gp.t;
      if (age > glowDuration) continue;
      var timeF = 1 - age / glowDuration;

      var dx = cx - gp.x;
      var dy = cy - gp.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      var sepX = gp.x - first.x;
      var sepY = gp.y - first.y;
      var sep = Math.sqrt(sepX * sepX + sepY * sepY);
      var sf = glowShrinkStrength > 0 ? Math.max(0.15, Math.exp(-glowShrinkStrength * sep / r)) : 1;
      var rScaled = r * sf;

      if (dist >= rScaled) continue;

      var r0 = glowInnerFrac * rScaled;
      var spatial;
      if (dist <= r0) {
        spatial = 1;
      } else {
        var t = (dist - r0) / (rScaled - r0);
        spatial = Math.pow(1 - t, glowFalloffExp);
      }
      total = Math.min(1, total + spatial * timeF);
    }
    return total;
  }

  function drawVideoAscii() {
    if (!videoReady || video.readyState < 2) return;

    var nowSec = performance.now() / 1000;

    offCtx.drawImage(video, 0, 0, cols, rows);
    var imageData = offCtx.getImageData(0, 0, cols, rows);
    var pixels = imageData.data;

    var cellW = canvas.width / cols;
    var cellH = canvas.height / rows;

    var hasGlow = false;
    var cellGlow = new Float32Array(cols * rows);
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var cellCx = x * cellW + cellW / 2;
        var cellCy = y * cellH + cellH / 2;
        var g = getGlowAmount(cellCx, cellCy, nowSec);
        cellGlow[y * cols + x] = g;
        if (g > 0.01) hasGlow = true;
      }
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = tileOpacity;
    ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;

    if (hasGlow) {
      ctx.globalCompositeOperation = 'lighter';
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var glow = cellGlow[y * cols + x];
          if (glow <= 0.01) continue;
          var pIdx = (y * cols + x) * 4;
          var r = pixels[pIdx];
          var gl = pixels[pIdx + 1];
          var b = pixels[pIdx + 2];
          var glowAlpha = Math.min(1, glow * 0.5);
          ctx.fillStyle = 'rgba(' + r + ',' + gl + ',' + b + ',' + glowAlpha.toFixed(3) + ')';
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.globalCompositeOperation = 'lighter';
    ctx.font = fontSize + 'px "Space Grotesk", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var pIdx = (y * cols + x) * 4;
        var r = pixels[pIdx];
        var gl = pixels[pIdx + 1];
        var b = pixels[pIdx + 2];
        var lum = (0.299 * r + 0.587 * gl + 0.114 * b) / 255;
        var gammaLum = Math.pow(lum, gamma);

        var glow = cellGlow[y * cols + x];
        var lumAdj = gammaLum;
        if (glow > 0) {
          lumAdj = Math.min(1, gammaLum + Math.pow(glow, glowLumaExp) * glowLumaGain);
        }

        var alpha = lumAdj * glyphOpacity;
        if (alpha < 0.01) continue;

        var idx = Math.floor(lumAdj * (densityLen - 1) + 0.5);
        var ch = density.charAt(Math.max(0, Math.min(densityLen - 1, idx)));

        var colorBoost = Math.pow(glow, 0.5) * 0.55;
        var glyphR = Math.min(255, Math.round(r + (255 - r) * colorBoost));
        var glyphG = Math.min(255, Math.round(gl + (255 - gl) * colorBoost));
        var glyphB = Math.min(255, Math.round(b + (255 - b) * colorBoost));
        ctx.fillStyle = 'rgba(' + glyphR + ',' + glyphG + ',' + glyphB + ',' + alpha.toFixed(3) + ')';
        ctx.fillText(ch, x * cellW + cellW / 2, y * cellH + cellH / 2);
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBinaryRain() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalCompositeOperation = 'lighter';
    ctx.font = fontSize + 'px "Space Grotesk", monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    var nowSec = performance.now() / 1000;

    for (var i = 0; i < cols; i++) {
      var ch = Math.random() > 0.5 ? '1' : '0';
      var gx = i * fontSize;
      var gy = drops[i] * fontSize;
      var glow = getGlowAmount(gx, gy, nowSec);
      var alpha = 0.12 + glow * 0.12;

      if (gy > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }

      ctx.fillStyle = 'rgba(235, 235, 235, ' + alpha.toFixed(3) + ')';
      ctx.fillText(ch, gx, gy);
      drops[i] += speeds[i];
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  function draw() {
    if (videoReady) {
      drawVideoAscii();
    } else {
      drawBinaryRain();
    }

    var nowSec = performance.now() / 1000;
    for (var i = glowPoints.length - 1; i >= 0; i--) {
      if (nowSec - glowPoints[i].t > glowDuration + 0.25) {
        glowPoints.splice(i, 1);
      }
    }

    mouseX += (targetX - mouseX) * 0.15;
    mouseY += (targetY - mouseY) * 0.15;
  }

  function updateSpotlight() {
    spotlight.style.background =
      'radial-gradient(circle 300px at ' + mouseX + 'px ' + mouseY + 'px, ' +
      'rgba(235, 235, 235, 0.03) 0%, transparent 70%)';
  }

  function onMouseMove(e) {
    targetX = e.clientX;
    targetY = e.clientY;
    stampGlow();
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

  setVideoSource('https://general-intuition.pages.dev/media/video_racing.mp4');
})();
