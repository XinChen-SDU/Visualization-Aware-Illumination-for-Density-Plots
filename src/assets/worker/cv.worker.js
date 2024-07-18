/* eslint-disable no-undef */

/**
 *  Here we will check from time to time if we can access the OpenCV
 *  functions. We will return in a callback if it's been resolved
 *  well (true) or if there has been a timeout (false).
 */
function waitForOpencv(callbackFn, waitTimeMs = 30000, stepTimeMs = 100) {
  if (cv.Mat) callbackFn(true)

  let timeSpentMs = 0
  const interval = setInterval(() => {
    const limitReached = timeSpentMs > waitTimeMs
    if (cv.Mat || limitReached) {
      clearInterval(interval)
      return callbackFn(!limitReached)
    } else {
      timeSpentMs += stepTimeMs
    }
  }, stepTimeMs)
}
  
function getColormapCode(colormap) {
  switch (colormap) {
    case 'Plasma':
      return cv.COLORMAP_PLASMA;
    case 'Viridis':
      return cv.COLORMAP_VIRIDIS;
    case 'Inferno':
      return cv.COLORMAP_INFERNO;
    case 'Turbo':
      return cv.COLORMAP_TURBO;
    case 'Cividis':
      return cv.COLORMAP_CIVIDIS;
    case 'Magma':
      return cv.COLORMAP_MAGMA;
    default:
      return cv.COLORMAP_PLASMA;
  }
}

function setupLightDirection(normal_xy) {
  let normal_a = math.mean(normal_xy, 0);
  let dk = math.subtract(normal_xy, normal_a);

  const pca = new PCA(dk);
  const Vt = math.transpose(pca.getEigenvectors().data.map(arr => Array.from(arr))); // for consistence with sklearn.decomposition.PCA
  let lambda_eigen_v = math.multiply(pca.getStandardDeviations()[0], Vt[0]);
  let light_direction = math.add(normal_a, lambda_eigen_v);
  if(light_direction[0] > 0)
      light_direction = math.subtract(normal_a, lambda_eigen_v);

  let z_component = math.sin(1.0471975511965976); // 60*Math.PI/180 -> 1.0471975511965976
  light_direction = math.multiply(light_direction, math.sqrt(1-z_component**2)/math.norm(light_direction));
  light_direction.push(z_component);
  return light_direction
}

// compute the normal vectors from the partial derivatives
function calNormal(elevation, vert_exag) {
  cv.multiply(elevation, cv.Mat.ones(elevation.rows, elevation.cols, cv.CV_32F), elevation, vert_exag);
  let grad_x = new cv.Mat(), grad_y = new cv.Mat();
  cv.Sobel(elevation, grad_x, ddepth=cv.CV_32F, dx=1, dy=0, ksize=1);
  cv.Sobel(elevation, grad_y, ddepth=cv.CV_32F, dx=0, dy=1, ksize=1);

  const dx_ = math.multiply(Array.from(grad_x.data32F), -0.5);
  const dy_ = math.multiply(Array.from(grad_y.data32F), -0.5);
  const dz_ = math.ones(math.size(dx_));
  let normal = math.transpose([dx_, dy_, dz_]);
  for(let i=0; i<normal.length; ++i) {
    normal[i] = math.divide(normal[i], math.norm(normal[i]));
  }

  grad_x.delete(); grad_y.delete();
  return normal;
}

/**
 * With OpenCV we have to work with the images as cv.Mat (matrices),
 * so you'll have to transform the ImageData to it.
 */
function enhanceDensityMap({ msg, densitymap, small_bw_data, paramStr }) {
  let params = JSON.parse(paramStr);
  let mapWidth = Math.trunc(params.width/2), mapHeight = Math.trunc(params.height/2);
  let src = cv.matFromArray(mapHeight, mapWidth, cv.CV_32F, densitymap),
  small_src = cv.matFromArray(mapHeight, mapWidth, cv.CV_32F, small_bw_data);

  let diff = new cv.Mat();
  cv.subtract(src, small_src, diff);
  const normal = calNormal(diff, params.eta);

  // filter out empty regions and select the x- and y- dimension
  const filtered_normal = normal.filter((_, i) => small_bw_data[i] > 1e-6);
  const light = setupLightDirection(filtered_normal.map(row => row.slice(0, 2)));
  let intensity = math.multiply(normal, light);
  src = cv.matFromArray(mapHeight, mapWidth, cv.CV_32F, intensity);

  // scale to [0,255], then convert to gray scale
  cv.normalize(src, src, 0, 255, cv.NORM_MINMAX);
  src.convertTo(src, cv.CV_8UC1);
  if(params.colormap==="Magma" || params.colormap==="Inferno" || params.colormap==="Cividis") { // for a light background, reverse the order
    cv.bitwise_not(src, src);
  }

  let dst = new cv.Mat();
  // fit the display size
  cv.resize(src, dst, new cv.Size(params.width, params.height));
  // colorize the density map
  cv.applyColorMap(dst, dst, getColormapCode(params.colormap));
  cv.cvtColor(dst, dst, cv.COLOR_BGR2RGBA);

  cv.flip(dst, dst, 0);
  const clampedArray = new ImageData(
    new Uint8ClampedArray(dst.data),
    dst.cols,
    dst.rows
  )
  postMessage({ msg, imgData: clampedArray })
  src.delete(); dst.delete();
  small_src.delete(); diff.delete();
}

/**
 * This exists to capture all the events that are thrown out of the worker
 * into the worker. Without this, there would be no communication possible
 * with the project.
 */
onmessage = async function (e) {
  switch (e.data.msg) {
    case 'load': {
      // Import Webassembly script
      self.importScripts(e.data.openCvPath)
      math = await import('mathjs');
      PCA = (await import('ml-pca')).PCA;
      if (cv instanceof Promise) {
          cv.then((target) => {
              cv = target;
              // console.log(cv.getBuildInformation());
          })
      }
      waitForOpencv(function (success) {
        if (success) postMessage({ msg: e.data.msg })
        else throw new Error('Error on loading OpenCV')
      })
      break
    }
    case 'enhancing':
      enhanceDensityMap(e.data)
      break
    default:
      break
  }
}