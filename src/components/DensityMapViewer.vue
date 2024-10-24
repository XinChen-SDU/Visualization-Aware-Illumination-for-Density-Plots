<script>
import cv from '@/js/cv'
import { colorbarV } from '@/js/colorbar'
import utils from '@/js/utils'

import { select } from 'd3-selection'
import { brush } from 'd3-brush'
import { scaleSequential } from 'd3-scale'
import { ElLoading } from 'element-plus'
import { toRaw } from 'vue';

// store the extents of existing datasets for acceleration
const dataset2extent = 
  {'CreditCardFraud': [[-5.133801197725919, 12.35524091454825],
    [-25.851125881720755, 9.941852762868804]],
  'diabetes': [[-1.62, 134.62], [-0.6000000000000001, 82.6]],
  'diamonds': [[-0.21480000000000002, 10.9548], [-43.94, 19192.94]],
  'Barcelona': [[2.0853191499999997, 2.22910785], [41.315836499999996, 41.4755015]],
  'facial': [[280.46862, 373.51637999999997],
    [195.98394000000002, 271.85506000000004]],
  'HR_diagram': [[-0.7958553039999999, 5.1300181039999995],
    [-16.857254933160235, 3.29692336782746]],
  'PersonActivity': [[-0.39943570017814634, 5.878910900354385],
    [-0.5838782602548599, 4.067547213435174]],
  'satimage': [[-0.1929744, 1.8742544],
    [-0.47720440000000003, 1.7891844000000001]],
  'synthesis1': [[-27.200698, 29.936798], [-30.809722, 48.423822]],
  'synthesis2': [[-44.146742, 24.037842],
    [-25.138493999999998, 28.493993999999997]],
  'synthesis3': [[-50.42919, 43.04549], [-20.766794, 57.945294000000004]],
  'synthesis4': [[-14.942749999999998, 65.64945],
    [-45.77783, 60.839330000000004]],
  'synthesis5': [[-50.358874, 26.755774], [-32.939306, 39.341006]],
  'taxis': [[-74.2392951965332, -73.71803359985351],
    [40.5493692779541, 40.91200691223145]],
  'uk_traffic_accident': [[-7.7017897, 1.9475747], [49.69604894, 60.97443606]]};

export default {
  emits: ["updateBW"],
  data() {
    return {
      datasetName: '',
      customFileUID: undefined,
      dataBeingDisplayed: undefined,
      params: undefined,
      extent: [],
      isFirstLoading: true,
      previousParams: undefined,
      dataChanged: false,
      large_density_field: undefined,
      small_density_field: undefined,
      tableData: [{ dataMinX:-1,dataMinY:-1,dataMaxX:-1,dataMaxY:-1,factor:5 }],
      onBrushing: false,
      regionBrush: undefined,
    }
  },
  methods: {
    async createDensityPlot(settings) {
      if(settings) { this.params = settings; }
      if (!window.math) {
        try {
          const prefix = import.meta.url.includes('src') ? 'src' : '';
          await utils.loadScript(`${import.meta.env.BASE_URL}${prefix}/worker/math.min.js`);
          console.log('mathjs version:', window.math.version);
        } catch (error) {
          console.error('Failed to load mathjs:', error);
        }
      }

      if(this.params.dataset === undefined) {
        console.log('is empty');
        return;
      } else if (this.params.dataset === 'Custom' && this.params.customFile.uid !== this.customFileUID) {
        this.datasetName = this.params.dataset;
        this.customFileUID = this.params.customFile.uid;
        utils.loadLocalData(this.params.customFile)
          .then((data) => {
            if (!data) { throw new Error('undefined data'); }
            this.dataBeingDisplayed = data;
            const minVals = window.math.min(data, 0), maxVals = window.math.max(data, 0);
            const offsets = window.math.multiply([maxVals[0] - minVals[0], maxVals[1] - minVals[1]], 0.02);
            this.extent = [[minVals[0] - offsets[0], maxVals[0] + offsets[0]],
                          [minVals[1] - offsets[1], maxVals[1] + offsets[1]]];

            let silverman_bw = Number(utils.silvermansRuleOfThumb(data).toFixed(2));
            this.$emit("updateBW", silverman_bw); // triggle setting update
            console.log(`Custom Dataset ${this.params.customFile.name} loaded.`);
            this.dataChanged = true;
          });
      } else if (this.params.dataset !== 'Custom' && this.params.dataset !== this.datasetName) {
        this.datasetName = this.params.dataset;
        let dataSrc = `${import.meta.env.BASE_URL}datasets/` + this.datasetName;
        if(!this.isFirstLoading)
          ElLoading.service({
            lock: true,
            text: 'Loading Dataset: '+this.datasetName,
            background: 'rgba(0, 0, 0, 0.7)',
          })
        utils.fetchData(dataSrc + '.csv')
          .then((data) => {
            if (!data) { throw new Error('undefined data'); }
            this.dataBeingDisplayed = data;
            this.extent = dataset2extent[this.datasetName];

            let silverman_bw = Number(utils.silvermansRuleOfThumb(data).toFixed(2));
            this.$emit("updateBW", silverman_bw); // triggle setting update

            if(!this.isFirstLoading)
              ElLoading.service().close();
            console.log(`Dataset ${this.datasetName} loaded.`);
            this.isFirstLoading = false;
            this.dataChanged = true;
          });
      } else { // data has been loaded
        this.renderDensityMapAndColorbar(this.dataBeingDisplayed);
        this.dataChanged = false;
      }
      select('#mapBrushLayer').attr('width', this.params.width).attr('height', this.params.height); 
      this.regionBrush.extent([[0,0],[this.params.width,this.params.height]]);
      select('#mapBrushLayer > g').call(this.regionBrush);
      this.previousParams = {...this.params};
    },
    renderDensityMap(data, small_bw_data, params) {
      let canvas = document.getElementById('densitymap');
      cv.enhanceDensityMap(data, small_bw_data, params, this.tableData[0])
        .then(e => {
          utils.drawImageData(canvas, e.data.imgData);
        })
        .catch(e => { console.log(e.message); })
    },
    renderDensityMapAndColorbar(data, params) {
      const startTime = performance.now();
      let tmpParams = params === undefined ? this.params : params;
      let mapWidth = Math.trunc(tmpParams.width/2), mapHeight = Math.trunc(tmpParams.height/2); // make the display size of outlier larger
      if(tmpParams.colormap !== this.previousParams.colormap
      || tmpParams.eta !== this.previousParams.eta
      || tmpParams.phi !== this.previousParams.phi) {
        console.log("The changes don't affect the density maps, thus avoiding the need to recompute the KDE.");
      }
      else if(tmpParams.large_bw !== this.previousParams.large_bw && !this.dataChanged) {
        this.large_density_field = utils.computeKDEfield(data, tmpParams.large_bw, this.extent, mapWidth, mapHeight);
      }
      else if(tmpParams.small_bw !== this.previousParams.small_bw && !this.dataChanged) {
        this.small_density_field = utils.computeKDEfield(data, tmpParams.small_bw, this.extent, mapWidth, mapHeight);
      }
      else {
        this.large_density_field = utils.computeKDEfield(data, tmpParams.large_bw, this.extent, mapWidth, mapHeight);
        this.small_density_field = utils.computeKDEfield(data, tmpParams.small_bw, this.extent, mapWidth, mapHeight);
      }

      this.renderDensityMap(toRaw(this.large_density_field), toRaw(this.small_density_field), tmpParams);
      this.generateColorbar(this.large_density_field, tmpParams);
      const endTime = performance.now();
      console.log(`${this.datasetName} execution time elapsed: ${(endTime-startTime).toFixed(2)}ms`);
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

      const colorbarWidth = 20, colorbarHeight = params.height-40;
      let cbV = colorbarV(colorScale, colorbarWidth, colorbarHeight)
                .tickNumber(7)
                .tickFormat(x=>x.toFixed(3));
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
      .catch(err => { console.log(err.message); });

    this.regionBrush = brush()
      .on('end', ({selection}) => {
        if (selection) { // top left and bottom right corners
          select(".selection").attr("stroke-width", 2).style("fill-opacity", 0);
          this.tableData[0] = {
            dataMinX: Math.round(selection[0][0]),
            dataMinY: Math.round(this.params.height-selection[1][1]),
            dataMaxX: Math.round(selection[1][0]),
            dataMaxY: Math.round(this.params.height-selection[0][1]),
            factor: this.tableData[0].factor
          };
          this.onBrushing = true;
        } else {
          this.tableData[0] = { dataMinX:-1,dataMinY:-1,dataMaxX:-1,dataMaxY:-1,factor:this.tableData[0].factor };
          this.onBrushing = false;
        }
        this.renderDensityMap(toRaw(this.large_density_field), toRaw(this.small_density_field), this.params);
      });
    select('#mapBrushLayer').append('g')
      .call(this.regionBrush);
  }
}
</script>

<template>
  <el-container>
    <el-header>
      <el-button @click.prevent="takeScreenshot">Capture the visualization</el-button>
      <el-table id="lensSetting" v-show="onBrushing" :data="tableData" :show-header="false">
        <el-table-column>
          <template #default="scope">
            <tr>
              <th>Range</th>
              <td>{{ JSON.stringify([[scope.row.dataMinX, scope.row.dataMaxX], [scope.row.dataMinY, scope.row.dataMaxY]]) }}</td>
              <th>Local η</th>
              <td>
                <el-input-number
                  v-model="scope.row.factor"
                  :min="0.01"
                  :max="50"
                  :step="0.01"
                  size="small"
                  style="width:90px;"/>
              </td>
            </tr>
          </template>
        </el-table-column>
      </el-table>
    </el-header>
    <el-main>
      <svg class="brush" id="mapBrushLayer" width="900" height="600" style="position: absolute;"></svg>
      <canvas id="densitymap"></canvas>
      <svg id="colorbar" width="100" height="400"></svg>
    </el-main>
    <el-footer>
      <p id="acknowledgement"><span>Acknowledgement</span>: The datasets used on the website and their sources are listed below.</p>
      <ul>
        <li><a href="https://archive.ics.uci.edu/dataset/317/grammatical+facial+expressions">facial</a></li>
        <li><a href="https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page">taxis</a></li>
        <li><a href="https://www.aanda.org/articles/aa/full_html/2018/08/aa33051-18/aa33051-18.html">HR_diagram</a></li>
        <li><a href="https://archive.ics.uci.edu/dataset/196/localization+data+for+person+activity">PersonActivity</a></li>
        <li><a href="https://www.kaggle.com/datasets/xvivancos/barcelona-data-sets">Barcelona</a></li>
        <li><a href="https://www.kaggle.com/datasets/shivam2503/diamonds">diamonds</a></li>
        <li><a href="https://www.data.gov.uk/dataset/cb7ae6f0-4be6-4935-9277-47e5ce24a11f/road-safety-data">uk_traffic_accident</a></li>
        <li><a href="https://ieeexplore.ieee.org/document/8038008">CreditCardFraud</a></li>
        <li><a href="https://archive.ics.uci.edu/dataset/296/diabetes+130-us+hospitals+for+years+1999-2008">diabetes</a></li>
        <li><a href="https://archive.ics.uci.edu/dataset/146/statlog+landsat+satellite">satimage</a></li>
      </ul>
    </el-footer>
  </el-container>
</template>

<style scoped>
.el-header {
  background-color: #eee;
  display: flex;
  align-items: center;
}

.el-footer {
  background-color: #eee;
}

.el-footer > * {
  margin-top: 4px;
  margin-bottom: 4px;
}

#acknowledgement > span {
  font-weight: bold;
}

ul {
  list-style-type: none; /* 移除默认的项目符号 */
  padding: 0; /* 清除默认的内边距 */
  overflow: hidden; /* 如果列表项超出容器范围，隐藏溢出部分 */
}
li {
  float: left; /* 让列表项水平排列 */
  margin-right: 10px; /* 在列表项之间添加一些间距 */
}
.el-table {
  --el-table-tr-bg-color: #eee;
  --el-table-row-hover-bg-color: #eee;
  --el-scrollbar-hover-opacity: 1.0;
}
.el-table__row {
  display: contents; /* 使 tr 元素的行为像普通的 tr 元素 */
}
th, td {
  border: 1px solid #dfe6ec;
  padding: 8px;
  text-align: left;
  background-color: #fff;
  line-height: 16px;
}
</style>