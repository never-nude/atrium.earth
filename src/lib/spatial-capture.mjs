// Raw camera textures are only valid inside the XR animation callback. Copy the
// camera and render the sculpture from the SAME view before yielding the frame.
// A transparent XR framebuffer by itself does not contain the camera background.
function readCameraPixels(gl, texture, width, height) {
  let vertex, fragment, program, target, framebuffer, vao;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader); throw new Error('Camera copy shader unavailable');
    }
    return shader;
  };
  try {
    vertex = compile(gl.VERTEX_SHADER, `#version 300 es
      out vec2 uv;
      void main() {
        vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
        uv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
      }`);
    fragment = compile(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      uniform sampler2D cameraImage;
      in vec2 uv; out vec4 color;
      void main() { color = texture(cameraImage, uv); }`);
    program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Camera copy unavailable');
    target = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Camera capture framebuffer unavailable');
    // Sample the opaque camera texture. Never attach it to a framebuffer or mutate it.
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.useProgram(program); gl.uniform1i(gl.getUniformLocation(program, 'cameraImage'), 0);
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.colorMask(true, true, true, true);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  } finally {
    if (vao) gl.deleteVertexArray(vao);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    if (target) gl.deleteTexture(target);
    if (program) gl.deleteProgram(program);
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
  }
}

export function canvasFromPixels(pixels, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  const data = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    data.data.set(pixels.subarray((height - y - 1) * width * 4, (height - y) * width * 4), y * width * 4);
  }
  context.putImageData(data, 0, 0);
  return canvas;
}

export function captureSpatialFrame(context, view, mode, binding, excluded = []) {
  const { THREE, renderer, scene } = context;
  const isAR = mode === 'immersive-ar';
  const nativeCamera = isAR ? view?.camera : null;
  if (isAR && (!nativeCamera || !binding?.getCameraImage)) throw new Error('Camera photo access is unavailable');
  const eye = renderer.xr.getCamera().cameras[0];
  if (!eye) throw new Error('The immersive camera is not ready');
  const sourceWidth = nativeCamera?.width || eye.viewport.z;
  const sourceHeight = nativeCamera?.height || eye.viewport.w;
  if (!(sourceWidth > 0 && sourceHeight > 0)) throw new Error('Camera dimensions are unavailable');
  const ratio = Math.min(1, 2048 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));
  const target = new THREE.WebGLRenderTarget(width, height);
  // Three r182 applies the live renderer's tone mapping and output transform to
  // XR targets. A regular offscreen target would skip it and wash out the photo.
  target.isXRRenderTarget = true;
  target.texture.colorSpace = THREE.SRGBColorSpace;
  // The XR output shader already encodes sRGB; avoid a second hardware encoding.
  target.texture.internalFormat = 'RGBA8';
  const saved = {
    enabled: renderer.xr.enabled,
    target: renderer.getRenderTarget(),
    viewport: renderer.getViewport(new THREE.Vector4()),
    scissor: renderer.getScissor(new THREE.Vector4()),
    scissorTest: renderer.getScissorTest(),
    autoClear: renderer.autoClear,
    visible: excluded.map(object => object?.visible),
  };
  try {
    let photo;
    if (isAR) {
      const texture = binding.getCameraImage(nativeCamera);
      if (!texture) throw new Error('Camera image is unavailable');
      const cameraPixels = readCameraPixels(renderer.getContext(), texture, width, height);
      renderer.resetState();
      photo = canvasFromPixels(cameraPixels, width, height);
    }
    renderer.xr.enabled = false;
    renderer.autoClear = true;
    excluded.forEach(object => { if (object) object.visible = false; });
    // Copy the current eye pose and projection; do not use the screen-view camera.
    const camera = new THREE.PerspectiveCamera();
    camera.matrixAutoUpdate = false;
    camera.matrix.copy(eye.matrixWorld);
    camera.matrixWorld.copy(eye.matrixWorld);
    camera.matrixWorldInverse.copy(eye.matrixWorldInverse);
    camera.projectionMatrix.copy(eye.projectionMatrix);
    camera.projectionMatrixInverse.copy(eye.projectionMatrixInverse);
    renderer.setRenderTarget(target);
    renderer.setViewport(0, 0, width, height);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);
    const pixels = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
    // Three's transparent framebuffer uses premultiplied alpha, ImageData does not.
    if (isAR) for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3] / 255;
      if (alpha > 0 && alpha < 1) for (let channel = 0; channel < 3; channel++) pixels[i + channel] = Math.min(255, Math.round(pixels[i + channel] / alpha));
    }
    const artwork = canvasFromPixels(pixels, width, height);
    if (!photo) return artwork;
    photo.getContext('2d').drawImage(artwork, 0, 0);
    return photo;
  } finally {
    excluded.forEach((object, index) => { if (object) object.visible = saved.visible[index]; });
    renderer.resetState();
    renderer.xr.enabled = saved.enabled;
    renderer.autoClear = saved.autoClear;
    renderer.setRenderTarget(saved.target);
    renderer.setViewport(saved.viewport);
    renderer.setScissor(saved.scissor);
    renderer.setScissorTest(saved.scissorTest);
    target.dispose();
  }
}
