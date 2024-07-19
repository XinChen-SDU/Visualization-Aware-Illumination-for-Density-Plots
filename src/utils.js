function parseData(text) {
    return text.trim().split('\r\n').map(line => 
        line.split(',').map(x=>parseFloat(x))
    );
}

function fetchData(src) {
    return fetch(src)
            .then(response => response.text())
            .then(text => parseData(text))
            .catch(err => console.log(err.message))
}

function drawImageData(canvas, imgData) {
    let ctx = canvas.getContext("2d");
    if(ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = imgData.width;
        canvas.height = imgData.height;
        ctx.putImageData(imgData, 0, 0);
    }
}

function extent(data) {
    let minVal = Infinity, maxVal = -Infinity;
    data.map(val => {
        if (val < minVal) { minVal = val; }
        if (val > maxVal) { maxVal = val; }
    });
    return [minVal, maxVal];
}

import { transpose, std, sort, quantileSeq, min } from 'mathjs'

// using the same logic of KDEpy 
// see also: https://github.com/tommyod/KDEpy/blob/master/KDEpy/bw_selection.py
function silvermansRuleOfThumb(data) {
    const n = data.length;
    if(n === 1) return 1;
    if(n < 1) 
        throw new Error("Data must be of length > 0.")

    let transposeData = transpose(data);
    let bw_list = [];
    for(let arr of transposeData) {
        arr = sort(arr);
        let sigma = std(arr);
        // scipy.stats.norm.ppf(.75) - scipy.stats.norm.ppf(.25) -> 1.3489795003921634
        let IQR = (quantileSeq(arr, .75, true) - quantileSeq(arr, .25, true))/1.3489795003921634;

        sigma = min(sigma, IQR);
        let h;
        if(sigma>0) {
            h = sigma * Math.pow(n*3/4, -0.2);
        } else {
            // stats.norm.ppf(.99) - stats.norm.ppf(.01) = 4.6526957480816815
            IQR = (quantileSeq(arr, .99, true) - quantileSeq(arr, .01, true)) / 4.6526957480816815
            if(IQR>0)
                h = IQR * Math.pow(n*3/4, -0.2);
            else
                h=1.0;
        }

        bw_list.push(h);
    }
  
    return min(bw_list);
  }
  
import { interpolatePlasma, interpolateInferno, interpolateCividis, interpolateViridis, interpolateTurbo, interpolateMagma } from 'd3-scale-chromatic'

function getInterpolateFunc(colormap) {
    switch (colormap) {
        case 'Plamsa':
            return interpolatePlasma;
        case 'Viridis':
            return interpolateViridis;
        case 'Inferno':
            return t => interpolateInferno(1-t);
        case 'Turbo':
            return interpolateTurbo;
        case 'Cividis':
            return t => interpolateCividis(1-t);
        case 'Magma':
            return t => interpolateMagma(1-t);
        default:
            return interpolatePlasma;
    }
}

export default {
    fetchData,
    drawImageData,
    getInterpolateFunc,
    extent,
    silvermansRuleOfThumb,
};