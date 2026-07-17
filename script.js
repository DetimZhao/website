(function () {
  var canvasRain = document.getElementById('rain');
  var canvasAscii = document.getElementById('ascii');
  var video = document.getElementById('bg-video');
  var spotlight = document.querySelector('.spotlight');
  var taglineEl = document.getElementById('tagline');
  var bioPanel = document.getElementById('bio-panel');
  var statusText = document.getElementById('status-text');
  var statusLine = document.getElementById('status-line');

  var ctx2d = canvasRain.getContext('2d');
  var gl = null;
  var webglReady = false;
  var videoReady = false;
  var showAscii = false;
  var videoDisabled = false;
  var videoOpacitySlider = document.getElementById('video-opacity');
  var videoOpacity = 50;
  var videoPlaying = true;
  var videoPlayPauseBtn = document.getElementById('video-playpause');
  var boomerang = false;
  var videoDirection = 1;

  // ---- Mouse ----
  var targetX = -500;
  var targetY = -500;
  var mouseX = -500;
  var mouseY = -500;

  // ---- Binary rain ----
  var drops = [];
  var speeds = [];
  var rainCols = 0;
  var fontSize = 14;
  var rainChars = [];
  var rainCharTimers = [];

  // ---- Config ----
  var cellSizePx = 10;
  var cellAspectRatio = 0.6;
  var charAspectRatio = 0.85;
  var charFillRatio = 1;
  var tileOpacity = 0.45;
  var glyphOpacity = 0.8;
  var gamma = 2.0;
  var edgeLo = 0;
  var edgeHi = 1;
  var blendStrength = 0.6;

  var density = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYZXcvunxrj/ft\\|()1{}[]?_-+~<>i!lI;:\",^'.  ";
  var densityLen = density.length;

  // ---- Glow config ----
  var glowRadiusMultiplier = 6;
  var glowDuration = 1;
  var glowIntensity = 2.5;
  var glowOpacity = 1;
  var glowSaturationBoost = 1;
  var glowInnerFrac = 0.99;
  var glowFalloffExp = 0.1;
  var glowShrinkStrength = 0.12;
  var glowLumaGain = 0.6;
  var glowLumaExp = 1.5;
  var stampInterval = 20;
  var MAX_GLOW_SHADER = 8;
  var MAX_GLOW_JS = 64;

  // ---- WebGL resources ----
  var dpr = 1;
  var prog;
  var locs = {};
  var atlasTex;
  var videoTex;
  var webglCols = 80;
  var webglRows = 45;
  var actualCellSize = 12;
  var csW = 0;
  var csH = 0;
  var glowPoints = [];
  var lastStamp = 0;
  var glowCenters = new Float32Array(MAX_GLOW_SHADER * 2);
  var glowRadiiPx = new Float32Array(MAX_GLOW_SHADER);
  var glowStarts = new Float32Array(MAX_GLOW_SHADER);
  var lastPresentedFrames = -1;
  var videoW = 0;
  var videoH = 0;

  // ---- Content ----
  var taglines = [
    "I'm just a guy",
    "...who builds things",
    "...thinks hard about stuff",
    "...somewhere on the internet"
  ];

  var statuses = [
    "Currently: building things",
    "Based in: AZ, USA",
    "Say hi: detimzhao[at]gmail.com"
  ];

  var taglineIdx = 0;
  var statusIdx = 0;
  var bioOpen = false;
  var taglinePaused = false;

  // ---- Video source ----
  var urlParams = new URLSearchParams(window.location.search);
  var customVideo = urlParams.get('video');
  if (customVideo) {
    video.src = customVideo;
  } else {
    video.src = './IMG_0783_720p.mp4';
  }
  video.load();

  // =========================================================================
  // WEBGL INIT
  // =========================================================================

  function initWebGL() {
    try {
      gl = canvasAscii.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
      if (!gl) return false;

      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

      canvasAscii.addEventListener('webglcontextlost', function (e) {
        e.preventDefault();
        webglReady = false;
        showAscii = false;
        canvasAscii.classList.remove('active');
      }, false);
      canvasAscii.addEventListener('webglcontextrestored', function () {
        initWebGLPipeline();
        if (videoReady && videoPlaying && !videoDisabled) activateAscii();
      }, false);

      initWebGLPipeline();
      return true;
    } catch (e) {
      return false;
    }
  }

  function initWebGLPipeline() {
    gl = canvasAscii.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) return;

    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    setupShaders();
    setupGeometry();
    setupVideoTexture();
    setupAtlas();
    updateWebGLGrid();
    setupWebGLUniforms();
    webglReady = true;

    if (videoReady && videoPlaying && !videoDisabled) activateAscii();
  }

  // ---- Shaders ----

  function compileShader(type, src) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function setupShaders() {
    var vsSrc =
      'attribute vec2 aPos;attribute vec2 aUV;varying vec2 vUV;void main(){vUV=aUV;gl_Position=vec4(aPos,0.0,1.0);}';

    var fsSrc =
      'precision mediump float;varying vec2 vUV;' +
      'uniform sampler2D uVideo;uniform sampler2D uAtlas;' +
      'uniform vec2 uCanvasSize;uniform float uCols;uniform float uRows;uniform vec2 uInvGrid;uniform vec2 uCellSizePx;' +
      'uniform float uCharAspectRatio;uniform float uCharFillRatio;' +
      'uniform float uGamma;uniform float uEdgeLo;uniform float uEdgeHi;' +
      'uniform float uTileOpacity;uniform float uGlyphOpacity;uniform float uBlendStrength;' +
      'uniform float uGlyphCount;uniform vec2 uAtlasGrid;uniform vec2 uAtlasPadding;' +
      'const int MAX_GLOW=8;uniform int uGlowCount;uniform vec2 uGlowCenters[MAX_GLOW];uniform float uGlowRadiiPx[MAX_GLOW];uniform float uGlowStart[MAX_GLOW];' +
      'uniform float uNow;uniform float uGlowDuration;uniform float uGlowIntensity;uniform float uGlowOpacity;' +
      'uniform float uGlowSaturationBoost;uniform float uGlowInnerFrac;uniform float uGlowFalloffExp;uniform float uGlowShrinkStrength;' +
      'uniform float uGlowLumaGain;uniform float uGlowLumaExp;' +

      'float luminance(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}' +

      'vec3 rgb2hsv(vec3 c){' +
      'vec4 K=vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);' +
      'vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));' +
      'vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));' +
      'float d=q.x-min(q.w,q.y);float e=1e-10;' +
      'return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);' +
      '}' +
      'vec3 hsv2rgb(vec3 c){' +
      'vec4 K=vec4(1.0,2.0/3.0,1.0/3.0,3.0);' +
      'vec3 p=abs(fract(c.xxx+K.xyz)*6.0-K.www);' +
      'return c.z*mix(K.xxx,clamp(p-K.xxx,0.0,1.0),c.y);' +
      '}' +

      'float glowAmount(vec2 tcUV){' +
      'float combined=0.0;' +
      'for(int i=0;i<MAX_GLOW;i++){' +
      'if(i<uGlowCount){' +
      'float age=uNow-uGlowStart[i];' +
      'float timeF=clamp(1.0-age/max(0.0001,uGlowDuration),0.0,1.0);' +
      'vec2 dpPx=(tcUV-uGlowCenters[i])*uCanvasSize;' +
      'float distPx=length(dpPx);' +
      'float r=max(1.0,uGlowRadiiPx[i]);' +
      'float sepPx=length((uGlowCenters[i]-uGlowCenters[0])*uCanvasSize);' +
      'float shrinkK=max(0.0,uGlowShrinkStrength);' +
      'float sf=(shrinkK>0.0)?max(0.15,exp(-shrinkK*sepPx/r)):1.0;' +
      'float rScaled=r*sf;' +
      'float r0=clamp(uGlowInnerFrac,0.0,0.99)*rScaled;' +
      'float spatial;' +
      'if(distPx<=r0){spatial=1.0;}' +
      'else{float t=clamp((distPx-r0)/max(0.0001,(rScaled-r0)),0.0,1.0);spatial=pow(1.0-t,max(0.0001,uGlowFalloffExp));}' +
      'combined=min(1.0,combined+spatial*timeF);' +
      '}}return combined;}' +

      'void main(){' +
      'vec2 grid=vec2(uCols,uRows);' +
      'vec2 cellCoord=floor(vUV*grid);' +
      'vec2 cellUV=fract(vUV*grid);' +
      'vec2 tileCenterUV=(cellCoord+0.5)*uInvGrid;' +
      'vec3 videoRGB=texture2D(uVideo,tileCenterUV).rgb;' +
      'float lum=pow(luminance(videoRGB),uGamma);' +
      'float gAmt=0.0;if(uGlowCount>0){gAmt=glowAmount(tileCenterUV);}' +
      'float lumAdj=lum;' +
      'if(gAmt>0.0){lumAdj=clamp(lum+pow(gAmt,uGlowLumaExp)*uGlowLumaGain,0.0,1.0);}' +
      'float glyphIdx=floor(lumAdj*(uGlyphCount-1.0)+0.5);' +
      'float charH=uCellSizePx.y*uCharFillRatio;' +
      'float charW=charH*uCharAspectRatio;' +
      'vec2 charSizeInCell=vec2(charW/uCellSizePx.x,charH/uCellSizePx.y);' +
      'vec2 charStart=(1.0-charSizeInCell)*0.5;' +
      'float charMask=1.0;' +
      'if(cellUV.x<charStart.x||cellUV.x>charStart.x+charSizeInCell.x||cellUV.y<charStart.y||cellUV.y>charStart.y+charSizeInCell.y){charMask=0.0;}' +
      'vec2 charUV=(cellUV-charStart)/charSizeInCell;charUV=clamp(charUV,0.0,1.0);' +
      'float aCols=uAtlasGrid.x;' +
      'float ax=mod(glyphIdx,aCols);float ay=floor(glyphIdx/aCols);' +
      'vec2 pUV=uAtlasPadding+charUV*(1.0-2.0*uAtlasPadding);' +
      'vec2 atlasUV=(vec2(ax,ay)+pUV)/uAtlasGrid;' +
      'float glyphAlpha=texture2D(uAtlas,atlasUV).r;' +
      'glyphAlpha=smoothstep(uEdgeLo,uEdgeHi,glyphAlpha);' +
      'glyphAlpha*=charMask*uGlyphOpacity;' +
      'vec3 baseRGB=mix(vec3(0.0),videoRGB,uTileOpacity);' +
      'vec3 additive=baseRGB+videoRGB;' +
      'vec3 blended=mix(baseRGB,additive,uBlendStrength);' +
      'float bl=max(0.0001,luminance(baseRGB));float cl=max(0.0001,luminance(blended));' +
      'blended=baseRGB*(cl/bl);' +
      'vec3 finalRGB=mix(baseRGB,clamp(blended,0.0,1.0),glyphAlpha);' +
      'if(gAmt>0.0){' +
      'vec3 top=clamp(finalRGB*uGlowIntensity,0.0,1.0);' +
      'vec3 glowed=1.0-(1.0-finalRGB)*(1.0-top);' +
      'finalRGB=mix(finalRGB,glowed,clamp(uGlowOpacity*gAmt,0.0,1.0));' +
      'if(uGlowSaturationBoost>0.0){' +
      'vec3 hsv=rgb2hsv(finalRGB);hsv.y=clamp(hsv.y*(1.0+uGlowSaturationBoost*gAmt),0.0,1.0);finalRGB=hsv2rgb(hsv);' +
      '}}' +
      'gl_FragColor=vec4(finalRGB,1.0);' +
      '}';

    var vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    var fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) { webglReady = false; return; }

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      webglReady = false;
      return;
    }

    var uniformNames = [
      'uVideo', 'uAtlas', 'uCanvasSize', 'uCols', 'uRows', 'uInvGrid', 'uCellSizePx',
      'uCharAspectRatio', 'uCharFillRatio', 'uGamma', 'uEdgeLo', 'uEdgeHi',
      'uTileOpacity', 'uGlyphOpacity', 'uBlendStrength', 'uGlyphCount',
      'uAtlasGrid', 'uAtlasPadding',
      'uGlowCount', 'uGlowCenters', 'uGlowRadiiPx', 'uGlowStart', 'uNow',
      'uGlowDuration', 'uGlowIntensity', 'uGlowOpacity', 'uGlowSaturationBoost',
      'uGlowInnerFrac', 'uGlowFalloffExp', 'uGlowShrinkStrength',
      'uGlowLumaGain', 'uGlowLumaExp'
    ];
    for (var i = 0; i < uniformNames.length; i++) {
      locs[uniformNames[i]] = gl.getUniformLocation(prog, uniformNames[i]);
    }
  }

  // ---- Geometry ----

  function setupGeometry() {
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,  1, -1, 1, 0,  -1, 1, 0, 1,
      -1, 1, 0, 1,  1, -1, 1, 0,  1, 1, 1, 1
    ]), gl.STATIC_DRAW);

    var aPos = gl.getAttribLocation(prog, 'aPos');
    var aUV = gl.getAttribLocation(prog, 'aUV');
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);
  }

  // ---- Video Texture ----

  function setupVideoTexture() {
    videoTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, videoTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    var black = new Uint8Array([0, 0, 0, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, black);
  }

  // ---- Glyph Atlas ----

  function setupAtlas() {
    var atlasGlyphSize = 50;
    var gridCols = Math.ceil(Math.sqrt(densityLen));
    var gridRows = Math.ceil(densityLen / gridCols);
    var atlasW = gridCols * atlasGlyphSize;
    var atlasH = gridRows * atlasGlyphSize;

    var atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = atlasW;
    atlasCanvas.height = atlasH;
    var actx = atlasCanvas.getContext('2d');
    actx.fillStyle = '#000';
    actx.fillRect(0, 0, atlasW, atlasH);
    actx.fillStyle = '#fff';
    actx.textAlign = 'center';
    actx.textBaseline = 'middle';
    actx.font = Math.floor(atlasGlyphSize * 0.8) + 'px monospace';

    for (var i = 0; i < densityLen; i++) {
      var gx = i % gridCols;
      var gy = Math.floor(i / gridCols);
      var cx = gx * atlasGlyphSize + atlasGlyphSize * 0.5;
      var cy = gy * atlasGlyphSize + atlasGlyphSize * 0.5;
      actx.fillText(density.charAt(i), cx, cy);
    }

    atlasTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);

    gl.useProgram(prog);
    gl.uniform2f(locs['uAtlasGrid'], gridCols, gridRows);
    var pad = 2 / atlasGlyphSize; // atlasPaddingPx / atlasGlyphSize
    gl.uniform2f(locs['uAtlasPadding'], pad, pad);
  }

  // ---- Grid ----

  function getResponsiveScale() {
    var sw = window.innerWidth || document.documentElement.clientWidth || 0;
    var bps = [
      { maxWidth: 480,  scale: 0.7 },
      { maxWidth: 768,  scale: 0.8 },
      { maxWidth: 1024, scale: 0.9 },
      { maxWidth: 1440, scale: 1.0 },
      { maxWidth: 1920, scale: 1.05 },
      { maxWidth: 2560, scale: 1.1 },
      { maxWidth: 3840, scale: 1.2 },
      { maxWidth: 99999, scale: 1.3 }
    ];
    for (var i = 0; i < bps.length; i++) {
      if (sw <= bps[i].maxWidth) return bps[i].scale;
    }
    return 1;
  }

  function updateWebGLGrid() {
    csW = canvasAscii.width;
    csH = canvasAscii.height;
    if (csW < 2 || csH < 2) return;

    var scale = getResponsiveScale();
    var targetDevPx = Math.max(1, cellSizePx * scale * dpr);
    var maxCols = 256;
    var minCols = 10;
    var colsBySize = Math.max(1, Math.floor(csW / targetDevPx));
    webglCols = Math.max(minCols, Math.min(maxCols, colsBySize));

    var ar = Math.max(0.0001, cellAspectRatio);
    var cellW = csW / webglCols;
    var cellH = cellW / ar;
    var minRows = 5;
    webglRows = Math.max(minRows, Math.floor(csH / cellH));
    actualCellSize = cellW;

    if (prog && locs['uCols']) {
      gl.useProgram(prog);
      gl.uniform1f(locs['uCols'], webglCols);
      gl.uniform1f(locs['uRows'], webglRows);
      gl.uniform2f(locs['uInvGrid'], 1 / webglCols, 1 / webglRows);
      gl.uniform2f(locs['uCellSizePx'], csW / webglCols, csH / webglRows);
      gl.uniform2f(locs['uCanvasSize'], csW, csH);
    }
  }

  function resizeWebGLCanvas() {
    var cssW = window.innerWidth;
    var cssH = window.innerHeight;
    var desiredW = Math.max(2, Math.floor(cssW * dpr));
    var desiredH = Math.max(2, Math.floor(cssH * dpr));
    var maxDim = 5120;
    if (desiredW > maxDim || desiredH > maxDim) {
      var s = maxDim / Math.max(desiredW, desiredH);
      desiredW = Math.max(2, Math.floor(desiredW * s));
      desiredH = Math.max(2, Math.floor(desiredH * s));
    }
    if (canvasAscii.width !== desiredW || canvasAscii.height !== desiredH) {
      canvasAscii.width = desiredW;
      canvasAscii.height = desiredH;
      gl.viewport(0, 0, desiredW, desiredH);
      updateWebGLGrid();
    }
  }

  // ---- Uniforms ----

  function setupWebGLUniforms() {
    gl.useProgram(prog);
    gl.uniform1i(locs['uVideo'], 0);
    gl.uniform1i(locs['uAtlas'], 1);
    gl.uniform1f(locs['uCharAspectRatio'], charAspectRatio);
    gl.uniform1f(locs['uCharFillRatio'], charFillRatio);
    gl.uniform1f(locs['uGamma'], gamma);
    gl.uniform1f(locs['uEdgeLo'], edgeLo);
    gl.uniform1f(locs['uEdgeHi'], edgeHi);
    gl.uniform1f(locs['uTileOpacity'], tileOpacity);
    gl.uniform1f(locs['uGlyphOpacity'], glyphOpacity);
    gl.uniform1f(locs['uBlendStrength'], blendStrength);
    gl.uniform1f(locs['uGlyphCount'], densityLen);
    gl.uniform1f(locs['uGlowDuration'], glowDuration);
    gl.uniform1f(locs['uGlowIntensity'], glowIntensity);
    gl.uniform1f(locs['uGlowOpacity'], glowOpacity);
    gl.uniform1f(locs['uGlowSaturationBoost'], glowSaturationBoost);
    gl.uniform1f(locs['uGlowInnerFrac'], glowInnerFrac);
    gl.uniform1f(locs['uGlowFalloffExp'], glowFalloffExp);
    gl.uniform1f(locs['uGlowShrinkStrength'], glowShrinkStrength);
    gl.uniform1f(locs['uGlowLumaGain'], glowLumaGain);
    gl.uniform1f(locs['uGlowLumaExp'], glowLumaExp);
    gl.uniform2f(locs['uCanvasSize'], canvasAscii.width, canvasAscii.height);
  }

  // ---- Glow ----

  function stampGlow() {
    if (!showAscii) return;
    if (targetX < 0 || targetY < 0) return;
    var now = performance.now();
    if (now - lastStamp < stampInterval) return;
    lastStamp = now;

    var rect = canvasAscii.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    var u = (targetX - rect.left) / rect.width;
    var v = 1 - (targetY - rect.top) / rect.height;
    var rPx = actualCellSize * glowRadiusMultiplier;

    glowPoints.unshift({ x: u, y: v, rPx: rPx, tSec: now / 1000 });
    if (glowPoints.length > MAX_GLOW_JS) glowPoints.length = MAX_GLOW_JS;
  }

  function pushGlowDynamics() {
    if (!locs['uGlowCount']) return;
    var nowSec = performance.now() / 1000;

    glowPoints = glowPoints.filter(function (p) {
      return nowSec - p.tSec <= glowDuration + 0.25;
    });

    var count = Math.min(glowPoints.length, MAX_GLOW_SHADER);
    for (var i = 0; i < count; i++) {
      var p = glowPoints[i];
      glowCenters[i * 2] = p.x;
      glowCenters[i * 2 + 1] = p.y;
      glowRadiiPx[i] = p.rPx;
      glowStarts[i] = p.tSec;
    }

    gl.useProgram(prog);
    gl.uniform1f(locs['uNow'], nowSec);
    gl.uniform1i(locs['uGlowCount'], count);
    if (count > 0) {
      gl.uniform2fv(locs['uGlowCenters'], glowCenters.subarray(0, count * 2));
      gl.uniform1fv(locs['uGlowRadiiPx'], glowRadiiPx.subarray(0, count));
      gl.uniform1fv(locs['uGlowStart'], glowStarts.subarray(0, count));
    }
  }

  // ---- Render ----

  var vfcRequested = false;
  var rafId = null;
  var renderToken = 0;

  function startRenderLoop() {
    renderToken++;
    var token = renderToken;

    if (typeof video.requestVideoFrameCallback === 'function') {
      (function loopVFC() {
        if (token !== renderToken || !showAscii) return;
        video.requestVideoFrameCallback(function (now, metadata) {
          if (token !== renderToken || !showAscii) return;
          var presented = metadata && typeof metadata.presentedFrames === 'number' ? metadata.presentedFrames : -1;
          var isNew = presented !== lastPresentedFrames;
          lastPresentedFrames = presented;
          drawWebGLFrame(isNew);
          loopVFC();
        });
      })();
    } else {
      (function loopRAF() {
        if (token !== renderToken || !showAscii) return;
        drawWebGLFrame(true);
        rafId = requestAnimationFrame(loopRAF);
      })();
    }
  }

  function startReverseLoop() {
    renderToken++;
    var token = renderToken;

    (function tick() {
      if (token !== renderToken || !showAscii) return;
      if (videoDirection !== -1) return;

      if (video.seeking) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      drawWebGLFrame(true);
      var t = Math.max(0, video.currentTime - 1 / 30);

      if (t <= 0.01) {
        videoDirection = 1;
        video.currentTime = 0;
        video.play();
        if (showAscii) startRenderLoop();
        return;
      }

      video.currentTime = t;
      rafId = requestAnimationFrame(tick);
    })();
  }

  function drawWebGLFrame(shouldUpload) {
    if (!webglReady || !gl) return;

    if (shouldUpload) {
      var vw = video.videoWidth || 0;
      var vh = video.videoHeight || 0;
      if (vw > 0 && vh > 0) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        } catch (e) {}
        if (vw !== videoW || vh !== videoH) {
          videoW = vw;
          videoH = vh;
        }
      }
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, atlasTex);
    pushGlowDynamics();
    gl.useProgram(prog);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function activateAscii() {
    if (showAscii) return;
    showAscii = true;
    resizeWebGLCanvas();
    lastPresentedFrames = -1;
    drawWebGLFrame(true);
    canvasAscii.classList.add('active');
    startRenderLoop();
  }

  // =========================================================================
  // BINARY RAIN (Canvas 2D fallback)
  // =========================================================================

  function resizeRain() {
    canvasRain.width = window.innerWidth;
    canvasRain.height = window.innerHeight;
    fontSize = window.innerWidth > 1600 ? 16 : 14;
    rainCols = Math.floor(canvasRain.width / fontSize);

    while (drops.length < rainCols) {
      drops.push(Math.floor(Math.random() * -canvasRain.height / fontSize));
      speeds.push(0.4 + Math.random() * 1.2);
    }
    while (rainChars.length < rainCols) {
      rainChars.push(density.charAt(Math.floor(Math.random() * densityLen)));
      rainCharTimers.push(Math.floor(Math.random() * 60));
    }
  }

  function drawBinaryRain() {
    if (showAscii) return;

    ctx2d.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx2d.fillRect(0, 0, canvasRain.width, canvasRain.height);

    ctx2d.globalCompositeOperation = 'lighter';
    ctx2d.font = fontSize + 'px "Space Grotesk", monospace';
    ctx2d.textBaseline = 'top';
    ctx2d.textAlign = 'left';

    for (var i = 0; i < rainCols; i++) {
      if (drops[i] === undefined) {
        drops[i] = Math.floor(Math.random() * -canvasRain.height / fontSize);
        speeds[i] = 0.4 + Math.random() * 1.2;
      }
      if (rainChars[i] === undefined) {
        rainChars[i] = density.charAt(Math.floor(Math.random() * densityLen));
        rainCharTimers[i] = 30 + Math.floor(Math.random() * 90);
      }

      rainCharTimers[i]--;
      if (rainCharTimers[i] <= 0) {
        rainChars[i] = density.charAt(Math.floor(Math.random() * densityLen));
        rainCharTimers[i] = 30 + Math.floor(Math.random() * 90);
      }

      var ch = rainChars[i];
      var gx = i * fontSize;
      var gy = drops[i] * fontSize;

      if (gy > canvasRain.height && Math.random() > 0.975) {
        drops[i] = 0;
        rainChars[i] = density.charAt(Math.floor(Math.random() * densityLen));
      }

      var dist = Math.hypot(gx - mouseX, gy - mouseY);
      var spotlightRadius = 300;
      var glow = dist < spotlightRadius ? 1 - dist / spotlightRadius : 0;
      glow = glow * glow;
      var alpha = 0.35 + glow * 0.20;

      ctx2d.fillStyle = 'rgba(235, 235, 235, ' + alpha.toFixed(3) + ')';
      ctx2d.fillText(ch, gx, gy);
      drops[i] += speeds[i];
    }

    ctx2d.globalCompositeOperation = 'source-over';
  }

  // =========================================================================
  // MAIN LOOP
  // =========================================================================

  function draw() {
    drawBinaryRain();

    mouseX += (targetX - mouseX) * 0.15;
    mouseY += (targetY - mouseY) * 0.15;
  }

  function updateSpotlight() {
    spotlight.style.background =
      'radial-gradient(circle 300px at ' + mouseX + 'px ' + mouseY + 'px, ' +
      'rgba(235, 235, 235, 0.03) 0%, transparent 70%)';
  }

  // =========================================================================
  // TAGLINE ROTATION
  // =========================================================================

  function rotateTagline() {
    if (bioOpen || taglinePaused) return;
    taglineEl.style.opacity = '0';
    setTimeout(function () {
      taglineIdx = (taglineIdx + 1) % taglines.length;
      taglineEl.textContent = taglines[taglineIdx];
      taglineEl.style.opacity = '1';
    }, 400);
  }

  // =========================================================================
  // BIO TOGGLE
  // =========================================================================

  function openBio() {
    bioOpen = true;
    bioPanel.classList.add('open');
    taglineEl.classList.add('bio-open');
    taglinePaused = true;
    taglineEl.style.opacity = '1';
  }

  function closeBio() {
    bioOpen = false;
    bioPanel.classList.remove('open');
    taglineEl.classList.remove('bio-open');
    taglinePaused = false;
  }

  function toggleBio(e) {
    e.stopPropagation();
    if (bioOpen) { closeBio(); }
    else { openBio(); }
  }

  // =========================================================================
  // STATUS ROTATION
  // =========================================================================

  function rotateStatus() {
    statusText.classList.add('fading');
    setTimeout(function () {
      statusIdx = (statusIdx + 1) % statuses.length;
      statusText.textContent = statuses[statusIdx];
      statusText.classList.remove('fading');
    }, 600);
  }

  // =========================================================================
  // PLAY / PAUSE
  // =========================================================================

  function pauseVideo() {
    videoPlaying = false;
    video.pause();
    showAscii = false;
    canvasAscii.classList.remove('active');
    videoPlayPauseBtn.classList.remove('playing');
    localStorage.setItem('video-playing', '0');
  }

  function playVideoFn() {
    videoPlaying = true;
    videoDirection = 1;
    videoPlayPauseBtn.classList.add('playing');
    localStorage.setItem('video-playing', '1');

    if (!videoReady) {
      video.load();
      return;
    }

    var promise = video.play();
    if (promise !== undefined) {
      promise.then(function () {
        if (!videoPlaying || videoDisabled) return;
        if (webglReady && !showAscii) activateAscii();
      }).catch(function () {
        if (!videoPlaying || videoDisabled) return;
        if (webglReady && !showAscii) activateAscii();
      });
    } else {
      if (webglReady && !showAscii) activateAscii();
    }
  }

  function togglePlayPause() {
    if (videoDisabled) return;
    if (videoPlaying) {
      pauseVideo();
    } else {
      playVideoFn();
    }
  }

  function updatePlayPauseVisibility() {
    if (videoDisabled) {
      videoPlayPauseBtn.classList.remove('visible');
    } else {
      videoPlayPauseBtn.classList.add('visible');
    }
  }

  // =========================================================================
  // VIDEO OPACITY SLIDER
  // =========================================================================

  function applyVideoOpacity(val) {
    videoOpacity = val;
    videoOpacitySlider.value = val;
    localStorage.setItem('video-opacity', val);

    var wasDisabled = videoDisabled;
    videoDisabled = (val === 0);

    if (val === 0) {
      video.pause();
      showAscii = false;
      canvasAscii.classList.remove('active');
      canvasAscii.style.opacity = '';
      videoPlayPauseBtn.classList.remove('visible', 'playing');
    } else {
      canvasAscii.style.opacity = (val / 100).toFixed(2);
      updatePlayPauseVisibility();

      if (wasDisabled) {
        playVideoFn();
      } else if (videoPlaying && videoReady && webglReady && !showAscii) {
        activateAscii();
      }
    }
  }

  function onVideoOpacityChange() {
    applyVideoOpacity(parseInt(videoOpacitySlider.value, 10));
  }

  // =========================================================================
  // EVENTS
  // =========================================================================

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
    var els = document.querySelectorAll('.hero, .socials, footer, .status-line');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.add('visible');
    }
  }

  // ---- Resize ----

  function resize() {
    resizeRain();
    if (webglReady) resizeWebGLCanvas();
  }

  // ---- Video events ----

  video.addEventListener('loadeddata', function () {
    videoW = video.videoWidth;
    videoH = video.videoHeight;
    videoReady = true;
    if (videoPlaying && !videoDisabled) {
      video.play().catch(function () {});
      if (webglReady) activateAscii();
    }
  });

  video.addEventListener('error', function () {
    videoReady = false;
  });

  video.addEventListener('ended', function () {
    if (!boomerang) return;
    videoDirection = -1;
    startReverseLoop();
  });

  // =========================================================================
  // BOOT
  // =========================================================================

  function boot() {
    var savedOpacity = localStorage.getItem('video-opacity');
    var savedPlaying = localStorage.getItem('video-playing');

    if (savedPlaying === '0') {
      videoPlaying = false;
    } else {
      videoPlaying = true;
    }

    if (savedOpacity !== null) {
      var val = parseInt(savedOpacity, 10);
      videoOpacity = val;
      videoOpacitySlider.value = val;
      videoDisabled = (val === 0);
    }

    if (videoDisabled) {
      canvasAscii.style.opacity = '';
      videoPlayPauseBtn.classList.remove('visible', 'playing');
      video.pause();
    } else {
      canvasAscii.style.opacity = (videoOpacity / 100).toFixed(2);
      videoPlayPauseBtn.classList.add('visible');
      if (videoPlaying) {
        videoPlayPauseBtn.classList.add('playing');
      } else {
        videoPlayPauseBtn.classList.remove('playing');
      }
    }

    initWebGL();
    resize();
    setInterval(draw, 42);
    setInterval(updateSpotlight, 50);
    setInterval(rotateTagline, 4500);
    setInterval(rotateStatus, 10000);
    setTimeout(fadeIn, 200);

    if (video.readyState >= 2) {
      videoW = video.videoWidth;
      videoH = video.videoHeight;
      videoReady = true;
      if (webglReady && !videoDisabled && videoPlaying) activateAscii();
    }
  }

  taglineEl.addEventListener('click', toggleBio);
  document.addEventListener('click', function (e) {
    if (bioOpen && !taglineEl.contains(e.target) && !bioPanel.contains(e.target)) {
      closeBio();
    }
  });

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseleave', onMouseLeave);
  videoOpacitySlider.addEventListener('input', onVideoOpacityChange);
  videoPlayPauseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    togglePlayPause();
  });
  canvasAscii.addEventListener('click', function (e) {
    togglePlayPause();
  });

  boot();
})();
