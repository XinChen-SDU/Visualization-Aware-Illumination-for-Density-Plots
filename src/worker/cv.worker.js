/* eslint-disable no-undef */

const THRESHOLD_0 = 1e-4;

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

function PCA(data) {
  const vars = math.variance(data, 0);
  const data_t = math.transpose(data);
  const covarianceXY = math.divide(math.multiply(data_t[0], data_t[1]), data.length - 1);

  let ans = math.eigs([[vars[0], covarianceXY], [covarianceXY, vars[1]]]);
  let maxIdx = ans.eigenvectors.reduce((maxIdx, curVal, idx) => curVal.value > ans.values[maxIdx] ? idx : maxIdx, 0);

  return ans.eigenvectors[maxIdx];
}

function setupLightDirection(normal_xy) {
  let normal_a = math.mean(normal_xy, 0);
  let i = normal_xy.length;
  while (i--) {
    normal_xy[i][0] = normal_xy[i][0]-normal_a[0];
    normal_xy[i][1] = normal_xy[i][1]-normal_a[1];
  }

  const ans = PCA(normal_xy);
  // const Vt = math.transpose(pca.getEigenvectors().data.map(arr => Array.from(arr))); // for consistence with sklearn.decomposition.PCA
  let lambda_eigen_v = math.multiply(math.sqrt(ans.value), ans.vector);
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
  normal = normal.map(val => 
    Math.abs(val[0]) < THRESHOLD_0 && Math.abs(val[1]) < THRESHOLD_0 ? val : math.divide(val, math.norm(val)));

  grad_x.delete(); grad_y.delete();
  return normal;
}

function linear_mapping(x1, x2, y1, y2) {
  const k = (y1 - y2) / (x1 - x2);
  const b = y1 - k * x1;
  return x => math.add(math.multiply(k, x), b);
}

function blendInL(src, dst, intensity) {
  // Adjusting lightness according to shading (implemented by OpenCV)
  cv.cvtColor(src, dst, cv.COLOR_BGR2Lab);

  // L channel + intensity
  let I_prime = cv.matFromArray(src.rows, src.cols, cv.CV_16S, intensity);
  let LAB_planes = new cv.MatVector();
  cv.split(dst, LAB_planes);
  let L = LAB_planes.get(0);
  L.convertTo(L, cv.CV_16S);
  cv.add(L, I_prime, L);
  L.convertTo(L, cv.CV_8UC1);
  LAB_planes.set(0, L);
  cv.merge(LAB_planes, dst);

  cv.cvtColor(dst, dst, cv.COLOR_Lab2BGR);
  I_prime.delete(); LAB_planes.delete(); L.delete();
}

/**
 * With OpenCV we have to work with the images as cv.Mat (matrices),
 * so you'll have to transform the ImageData to it.
 */
function enhanceDensityMap({ msg, densitymap, small_bw_data, paramStr }) {
  let params = JSON.parse(paramStr);
  let mapWidth = Math.trunc(params.width/2), mapHeight = Math.trunc(params.height/2);
  let src = cv.matFromArray(mapHeight, mapWidth, cv.CV_32F, densitymap),
  small_bw_src = cv.matFromArray(mapHeight, mapWidth, cv.CV_32F, small_bw_data);

  let diff = new cv.Mat();
  cv.subtract(src, small_bw_src, diff);
  const normal = calNormal(diff, params.eta);

  // filter out empty regions and select the x- and y- dimension
  const filtered_normal = normal.filter((_, i) => small_bw_data[i] > THRESHOLD_0);
  const light = setupLightDirection(filtered_normal.map(row => row.slice(0, 2)));
  let intensity = math.multiply(normal, light);
  // src = cv.matFromArray(mapHeight, mapWidth, cv.CV_32F, intensity);

  // color conversion for 8-bit images: L <- L*255/100
  // https://docs.opencv.org/3.4/de/d25/imgproc_color_conversions.html#color_convert_rgb_lab
  intensity = linear_mapping(math.min(intensity), light[2], params.phi*2.55, 0)(intensity);

  // scale to [0,255], then convert to gray scale
  cv.normalize(src, src, 0, 255, cv.NORM_MINMAX);
  src.convertTo(src, cv.CV_8UC1);
  if(params.colormap==="Magma" || params.colormap==="Inferno" || params.colormap==="Cividis") { // for a light background, reverse the order
    cv.bitwise_not(src, src);
    // src.convertTo(src, cv.CV_8UC1, -1, 255); // add and multiply scalar by convertTo: https://docs.opencv.org/4.x/de/d06/tutorial_js_basic_ops.html
  }
  // colorize the density map
  cv.applyColorMap(src, src, getColormapCode(params.colormap));
  let dst = new cv.Mat();
  blendInL(src, dst, intensity);
  cv.cvtColor(dst, dst, cv.COLOR_BGR2RGBA);

  // fit the display size
  cv.resize(dst, dst, new cv.Size(params.width, params.height));

  cv.flip(dst, dst, 0);
  const clampedArray = new ImageData(
    new Uint8ClampedArray(dst.data),
    dst.cols,
    dst.rows
  )
  postMessage({ msg, imgData: clampedArray })
  src.delete(); dst.delete();
  small_bw_src.delete(); diff.delete();
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
      self.importScripts(...e.data.importPaths)
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