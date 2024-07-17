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
    default:
      return cv.COLORMAP_PLASMA;
  }
}

/**
 * With OpenCV we have to work with the images as cv.Mat (matrices),
 * so you'll have to transform the ImageData to it.
 */
function enhanceDensityMap({ msg, densitymap, paramStr, valueLensStr, regionLensStr }) {
  let mapWidth = densitymap.length, mapHeight = densitymap[0].length;
  let src = cv.matFromArray(mapWidth, mapHeight, cv.CV_32F, densitymap.flat());
  cv.flip(src, src, 0);

  let params = JSON.parse(paramStr);
  let baseLayer = new cv.Mat(), detailLayer = new cv.Mat(), result = new cv.Mat();
  switch (params.filter) {
    case 'gaussian':
      let d = 2*params.filterParams.radius-1, sigma = params.filterParams.sigma;
      cv.GaussianBlur(src, baseLayer, new cv.Size(d,d), sigma, sigma, cv.BORDER_DEFAULT);
      break;
    case 'guided':
      guidedFilter(src, src, baseLayer, params.filterParams.radius, params.filterParams.eps);
      break;
    default:
      throw new Error('Invalid filter type')
  }
  cv.subtract(src, baseLayer, detailLayer);
  let boostingMat = getBoostingMatrix(src, params, valueLensStr, regionLensStr);
  cv.add(baseLayer, detailLayer.mul(boostingMat, 1), result);
  // truncate the values exceeded the value range of input density map
  // the 4th argument (maxval) is unnecessary, so pass undefined to it
  const minmaxLoc = cv.minMaxLoc(src);
  cv.threshold(result, result, minmaxLoc.minVal, undefined, cv.THRESH_TOZERO);
  cv.threshold(result, result, minmaxLoc.maxVal, undefined, cv.THRESH_TRUNC);

  // scale to [0,255], then convert to gray scale
  cv.normalize(result, result, 0, 255, cv.NORM_MINMAX);
  result.convertTo(result, cv.CV_8UC1);

  let dst = new cv.Mat();
  // fit the display size
  cv.resize(result, dst, new cv.Size(params.width, params.height));
  // colorize the density map
  if (params.colormap === 'Greys') {
    cv.cvtColor(dst, dst, cv.COLOR_GRAY2RGBA);
  }
  else {
    cv.applyColorMap(dst, dst, getColormapCode(params.colormap));
    cv.cvtColor(dst, dst, cv.COLOR_BGR2RGBA);
  }

  const clampedArray = new ImageData(
    new Uint8ClampedArray(dst.data),
    dst.cols,
    dst.rows
  )
  postMessage({ msg, imgData: clampedArray })
  src.delete(); dst.delete();
  baseLayer.delete(); detailLayer.delete(); result.delete();
  boostingMat.delete();
}

function getBoostingMatrix(src, params, valueLensStr, regionLensStr) {
  let boostingMat = cv.Mat.ones(src.rows, src.cols, cv.CV_32F);
  cv.multiply(boostingMat, cv.Mat.ones(src.rows, src.cols, cv.CV_32F), boostingMat, params.detailFactor);

  let valueLens = JSON.parse(valueLensStr);
  for (let i = 0; i < src.rows; ++i) 
    for (let j = 0; j < src.cols; ++j)
      if (src.floatAt(i, j) >= valueLens.start && src.floatAt(i, j) <= valueLens.end)
        boostingMat.floatPtr(i, j)[0] = valueLens.factor;

  let regionLens = JSON.parse(regionLensStr);
  for (let i = regionLens.dataMinY; i < regionLens.dataMaxY; ++i) 
    for (let j = regionLens.dataMinX; j < regionLens.dataMaxX; ++j)
      boostingMat.floatPtr(i, j)[0] = regionLens.factor;

  cv.boxFilter(boostingMat, boostingMat, cv.CV_32F, new cv.Size(11,11));
  return boostingMat;
}

/**
 * Implementation of guided filter.
 * He, Kaiming, Jian Sun, and Xiaoou Tang. "Guided image filtering." IEEE transactions on pattern analysis and machine intelligence 35.6 (2012): 1397-1409.
 */
function guidedFilter(source, guided_image, output, radius, epsilon) {
    let guided = guided_image.clone();

    let source_32f = new cv.Mat();
    let guided_32f = new cv.Mat();
    source.convertTo(source_32f, cv.CV_32F);
    guided.convertTo(guided_32f, cv.CV_32F);

    let let_Ip = new cv.Mat();
    let let_I2 = new cv.Mat();
    cv.multiply(guided_32f, source_32f, let_Ip);
    cv.multiply(guided_32f, guided_32f, let_I2);

    let mean_p = new cv.Mat();
    let mean_I = new cv.Mat();
    let mean_Ip = new cv.Mat();
    let mean_I2 = new cv.Mat();
    let win_size = new cv.Size(2 * radius + 1, 2 * radius + 1);
    cv.boxFilter(source_32f, mean_p, cv.CV_32F, win_size);
    cv.boxFilter(guided_32f, mean_I, cv.CV_32F, win_size);
    cv.boxFilter(let_Ip, mean_Ip, cv.CV_32F, win_size);
    cv.boxFilter(let_I2, mean_I2, cv.CV_32F, win_size);

    let cov_Ip = new cv.Mat();
    let var_I = new cv.Mat();
    cv.subtract(mean_Ip,  mean_I.mul(mean_p, 1), cov_Ip);
    cv.subtract(mean_I2,  mean_I.mul(mean_I, 1), var_I);

    for (let i = 0; i < guided_image.rows; ++i) 
        for (let j = 0; j < guided_image.cols; ++j)
          var_I.floatPtr(i, j)[0] += epsilon;

    let a = new cv.Mat();
    let b = new cv.Mat();
    cv.divide(cov_Ip, var_I, a);
    cv.subtract(mean_p, a.mul(mean_I, 1), b); 

    let mean_a = new cv.Mat();
    let mean_b = new cv.Mat();
    cv.boxFilter(a, mean_a, cv.CV_32F, win_size);
    cv.boxFilter(b, mean_b, cv.CV_32F, win_size);
    cv.add(mean_a.mul(guided_32f, 1), mean_b, output)

    guided.delete(); source_32f.delete(); guided_32f.delete(); let_Ip.delete(); let_I2.delete();
    mean_p.delete(); mean_I.delete(); mean_Ip.delete(); mean_I2.delete(); cov_Ip.delete(); 
    var_I.delete(); a.delete(); b.delete(); mean_a.delete(); mean_b.delete();
}

/**
 * This exists to capture all the events that are thrown out of the worker
 * into the worker. Without this, there would be no communication possible
 * with the project.
 */
onmessage = function (e) {
  switch (e.data.msg) {
    case 'load': {
      // Import Webassembly script
      self.importScripts(e.data.openCvPath)
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