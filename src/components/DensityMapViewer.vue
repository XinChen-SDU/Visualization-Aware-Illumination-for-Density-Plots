<script>
import cv from '@/cv'
import { colorbarV } from '@/colorbar'
import utils from '@/utils'

import { select } from 'd3-selection'
import { scaleSequential } from 'd3-scale'
import { ElLoading } from 'element-plus'
import { sum, multiply } from 'mathjs'
import { density2d } from 'fast-kde'

export default {
  emits: ["updateBW"],
  data() {
    return {
      datasetName: '',
      dataBeingDisplayed: undefined,
      regionBrush: undefined,
      regionLensFactor: 0,
      params: undefined,
    }
  },
  methods: {
    createDensityPlot(settings) {
      if(settings) { this.params = settings; }

      if(this.params.dataset === undefined) {
        console.log('is empty');
        return;
      } else if (this.params.dataset !== this.datasetName) {
        this.datasetName = this.params.dataset;
        let dataSrc = '/datasets/' + this.datasetName;
        utils.fetchData(dataSrc + '.csv')
          .then(data => {
            if(!data) {throw new Error('undefined data');}
            this.dataBeingDisplayed = data;

            let silverman_bw = Number(utils.silvermansRuleOfThumb(data).toFixed(2));
            this.$emit("updateBW", silverman_bw); // triggle setting update
          });
      } else { // data has been loaded
        this.renderDensityMapAndColorbar(this.dataBeingDisplayed);
      }
    },
    // createRegionLensBrush() {
    //   let mapBrushLayer = select('.el-main').append('svg')
    //                     .attr('class', 'brush')
    //                     .attr('id', 'mapBrushLayer')
    //                     .attr('width', this.params.width)
    //                     .attr('height', this.params.height)
    //                     .style('position', 'absolute').lower();
    //   this.regionBrush = brush()
    //     .extent([[0,0],[this.params.width,this.params.height]])
    //     .on('end', ({selection}) => {
    //       let index = this.tableData.findIndex(i=>i.type=='Region lens');
    //       if (selection) { // top left and bottom right corners
    //         let regionLensInfo = {
    //           type: 'Region lens',
    //           range: JSON.stringify(selection.map(row=>row.map(Math.round))),
    //           factor: index !== -1 ? this.tableData[index].factor : this.regionLensFactor,
    //         };
    //         if (index === -1) { this.tableData.push(regionLensInfo); }
    //         else { this.tableData[index] = regionLensInfo; }
    //         this.regionLensFactor = regionLensInfo.factor;
    //       }
    //       else {
    //         if (index !== -1) { this.tableData.splice(index, 1); }
    //       }
    //       this.renderDensityMap(this.dataBeingDisplayed, this.params);
    //     });
    //   mapBrushLayer.append('g')
    //     .call(this.regionBrush);
    // },
    renderDensityMap(data, small_bw_data, params) {
      // let regionLensInfo = this.tableData.find(i=>i.type=='Region lens'), regionLens;
      // if (regionLensInfo) {
      //   let range = JSON.parse(regionLensInfo.range);
      //   regionLens = {
      //     dataMinX: Math.round(range[0][0]/this.params.width*this.level0_Width),
      //     dataMinY: Math.round(range[0][1]/this.params.height*this.level0_Height),
      //     dataMaxX: Math.round(range[1][0]/this.params.width*this.level0_Width),
      //     dataMaxY: Math.round(range[1][1]/this.params.height*this.level0_Height),
      //     factor: Number(regionLensInfo.factor)
      //   };
      // }
      // else { regionLens = { dataMinX:-1,dataMinY:-1,dataMaxX:-1,dataMaxY:-1,factor:0 } }

      let canvas = document.getElementById('densitymap');
      cv.enhanceDensityMap(data, small_bw_data, params)
        .then(e => {
          utils.drawImageData(canvas, e.data.imgData);
        })
        .catch(e => { console.log(e.message); })
    },
    renderDensityMapAndColorbar(data, params) {
      let tmpParams = params === undefined ? this.params : params;
      let mapWidth = Math.trunc(tmpParams.width/2), mapHeight = Math.trunc(tmpParams.height/2); // make the display size of outlier larger
      let d2 = density2d(data, { bandwidth: tmpParams.large_bw, bins: [mapWidth, mapHeight] });
      let points = Array.from(d2.grid());
      points = multiply(points, data.length/sum(points));
      let small_bw_d2 = density2d(data, { bandwidth: tmpParams.small_bw, bins: [mapWidth, mapHeight] });
      let small_bw_points = Array.from(small_bw_d2.grid());
      small_bw_points = multiply(small_bw_points, data.length/sum(small_bw_points));

      this.renderDensityMap(points, small_bw_points, tmpParams);
      this.generateColorbar(points, tmpParams);
    },
    generateColorbar(data, params) {
      if(params.colormap === undefined) { return; }

      select('#colorbar').selectAll('g').remove();
      let svg = select("#colorbar")
                .attr('height', params.height);
      let grV = svg.append("g")
                    .attr("class", "vertical")
                    .attr("transform", "translate(20,20)");

      const [minVal, maxVal] = utils.extent(data);
      let colorScale = scaleSequential(utils.getInterpolateFunc(params.colormap))
                        .domain([minVal, maxVal]);
      let tickValues = utils.getTickValues(minVal, maxVal);

      const colorbarWidth = 20, colorbarHeight = params.height-40;
      let cbV = colorbarV(colorScale, colorbarWidth, colorbarHeight)
                .tickValues(tickValues)
                .tickFormat(x=>x.toFixed(0));
      grV.call(cbV);
    },
    takeScreenshot() {
      if (!this.datasetName) { return; }

      let downloadLink = document.createElement('a');
      downloadLink.setAttribute('download', this.datasetName+'.png');
      let canvas = document.getElementById('densitymap');
      canvas.toBlob(blob => {
        let url = URL.createObjectURL(blob);
        downloadLink.setAttribute('href', url);
        downloadLink.click();
      });
    },
  },
  mounted() {
    cv.load()
      .then(() => {
        ElLoading.service().close();
        console.log('OpenCV.js is ready.');
      })
      .catch(err => { console.log(err.message); })
  }
}
</script>

<template>
  <el-container>
    <el-header>
      <el-button @click.prevent="takeScreenshot">Screenshot</el-button>
    </el-header>
    <el-main>
      <canvas id="densitymap"></canvas>
      <svg id="colorbar" width="100" height="400"></svg>
    </el-main>
  </el-container>
</template>

<style scoped>
.el-header {
  background-color: #eee;
  display: flex;
  align-items: center;
}
</style>