// modified from https://github.com/ttdtrang/d3-colorbar
import { scaleLinear } from 'd3-scale'
import { axisBottom, axisRight } from 'd3-axis'

let vertical = 1,
    horizontal = 2;

function colorbar(orient, scale, width, height) {

    let tickValues = scale.domain();
    let tickFormat = x => x;
    let linearScale = scaleLinear()
        .domain(scale.domain())
        .range(orient === horizontal ? [0, width] : [height, 0]);
    let barThickness = orient === horizontal ? height : width;
    let barRange = orient === horizontal ? width : height;

    function colorbar(context) {
        // The finer, the more continuous it looks
        let dL = 2;
        let nBars = Math.floor(barRange / dL);
        let barData = [];
        let trueDL = barRange * 1. / nBars;
        for (let i = 0; i < nBars; i++) {
            barData.push(i * (trueDL));
        }

        let interScale = scaleLinear()
            .domain(orient === horizontal ? [0,barRange] : [barRange,0])
            .range(scale.domain());

        context.selectAll("rect")
            .data(barData)
            .enter()
            .append("rect")
            .attr("x", translateX)
            .attr("y", translateY)
            .attr("width", orient === horizontal ? trueDL : barThickness)
            .attr("height", orient === horizontal ? barThickness : trueDL)
            .style("stroke-width", "0px")
            .style("fill", function (d) {
                return scale(interScale(d))
            });

        let myAxis = (orient === horizontal) ? axisBottom(linearScale) : axisRight(linearScale);
        if (tickValues == null) tickValues = myAxis.tickValues();
        else myAxis.tickValues(tickValues);
        myAxis.tickFormat(tickFormat);
        context.append("g")
            .attr("class", "colorbar axis")
            .attr("transform", "translate(" + translateAxis(orient, width, height) + ")").call(myAxis);
    }

    // set and return for chaining, or get
    colorbar.tickValues = function (_) {
        return arguments.length ? (tickValues = _, colorbar) : tickValues;
    };

    colorbar.tickFormat = function (_) {
        return arguments.length ? (tickFormat = _, colorbar) : tickFormat;
    };

    function translateX(d, i) {
        if (orient === horizontal) return d;
        else return 0;
    }

    function translateY(d, i) {
        if (orient === horizontal) return 0;
        else return d;
    }

    return colorbar;
}

function translateAxis(orient, width, height) {
    let tX = orient === horizontal ? 0 : width;
    let tY = orient === horizontal ? height : 0;
    return tX + "," + tY;
}


export function colorbarV(scale, width, height) {
    return colorbar(vertical, scale, width, height);
}

export function colorbarH(scale, width, height) {
    return colorbar(horizontal, scale, width, height);
}
