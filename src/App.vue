<script>
import DensityMapViewer from './components/DensityMapViewer.vue'
import SettingSidebar from './components/SettingSidebar.vue'

import 'element-plus/es/components/loading/style/css'
import { ElLoading } from 'element-plus'

export default {
  components: {
    SettingSidebar,
    DensityMapViewer
  },
  methods: {
    updateDensityPlot(defaultSettings) {
      this.$refs.viewer.createDensityPlot(defaultSettings);
    },
    updateBandwidth(bandwidth) {
      this.$refs.sidebar.useSilvermanBandwidth(bandwidth);
    }
  },
  mounted() {
    ElLoading.service({
      lock: true,
      text: 'Loading OpenCV.js',
      background: 'rgba(0, 0, 0, 0.7)',
    })
  }
}
</script>

<template>
  <el-container>
    <el-header>
      <img alt="Density logo" class="logo" src="./assets/density-plot-logo.svg" width="65" height="65" />
      <span class="title">Visualization-aware Illuminated Density Plots</span>
    </el-header>
    <el-container>
      <SettingSidebar @update="updateDensityPlot" ref="sidebar"/>
      <DensityMapViewer @updateBW="updateBandwidth" ref="viewer"/>
    </el-container>
  </el-container>
</template>

<style scoped>
  .el-header {
    background-color: #000;
    color: var(--el-text-color-primary);
    line-height: 63px;
    padding-left: 5px;
  }

  .title {
    position: absolute;
    margin-left: 5px;
    font-size: 20pt;
    color: #dedede;
    user-select: none;
  }
</style>
