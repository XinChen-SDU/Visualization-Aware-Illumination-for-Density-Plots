import utils from '@/utils'

class CV {
  /**
   * We will use this method privately to communicate with the worker and
   * return a promise with the result of the event. This way we can call
   * the worker asynchronously.
   */
  _dispatch(event) {
    // if the _status property exists, there is an incomplete task
    // wait until that task finishes
    if (this._status) {
      return new Promise((res, rej) => {
        setTimeout(ev => this._dispatch(ev).then(res).catch(rej), 100, event);
      });
    }

    this._status = ['loading']
    this.worker.postMessage(event)
    return new Promise((res, rej) => {
      let interval = setInterval(() => {
        const status = this._status
        if (!status) {
          rej(new Error('tasks conflict'))
          clearInterval(interval)
          return;
        }
        if (status[0] === 'done') res(status[1])
        if (status[0] === 'error') rej(status[1])
        if (status[0] !== 'loading') {
          delete this._status
          clearInterval(interval)
        }
      }, 50)
    })
  }

  /**
   * First, we will load the worker and capture the onmessage
   * and onerror events to always know the status of the event
   * we have triggered.
   *
   * Then, we are going to call the 'load' event, as we've just
   * implemented it so that the worker can capture it.
   */
  load() {
    // avoid duplication of workers
    if(this.worker) { return new Promise(res => res()); }
    const prefix = import.meta.url.includes('src') ? '/src' : '';
    this.worker = new Worker(`${prefix}/assets/worker/cv.worker.js`) // load worker

    // Capture events and save [status, event] inside the _status object
    this.worker.onmessage = e => this._status = ['done', e]
    this.worker.onerror = e => this._status = ['error', e]
    return this._dispatch({ msg: 'load', openCvPath: `${prefix}/assets/worker/opencv.js` })
  }

  /**
   * apply the user-specified filter to the given density map
   */
  enhanceDensityMap(array_2d, params, valueLens, regionLens) {
    let paramStr = JSON.stringify(params);
    let valueLensStr = JSON.stringify(valueLens);
    let regionLensStr = JSON.stringify(regionLens);
    let tmpData = array_2d.map(row => {
      return row.map(utils.getTransformFunction(params.type))
    });
    return this._dispatch({msg: 'enhancing', densitymap: tmpData, paramStr, valueLensStr, regionLensStr })
  }
}

// Export the same instant everywhere
export default new CV()