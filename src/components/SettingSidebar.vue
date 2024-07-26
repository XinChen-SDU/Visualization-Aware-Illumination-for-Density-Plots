<script>

import { debounce } from 'lodash-es'
import { genFileId } from 'element-plus'

export default {
  emits: ['init', 'update'],
  data() {
    return {
      settings: {
        dataset: 'facial',
        width: 900,
        height: 600,
        colormap: 'Magma',
        large_bw: 1,
        small_bw: Number((1/450).toFixed(4)),
        eta: 5,
        phi: -25,
        customFile: undefined,
      },
      silverman_bw: 1,
      datasets: ['facial', 'taxis', 'HR_diagram', 'diamonds', 'uk_traffic_accident', 'PersonActivity', 'CreditCardFraud',
      'diabetes', 'satimage', 'synthesis1', 'synthesis2', 'synthesis3', 'synthesis4', 'synthesis5', 'Custom'],
      colormaps: ['Magma', 'Plasma', 'Viridis', 'Inferno', 'Turbo', 'Cividis', ],
    }
  },
  methods: {
    updateSettings: debounce(function(evt) {
      this.$emit('update', { ...evt });
    }, 200),
    useSilvermanBandwidth(bandwidth) {
      this.silverman_bw=bandwidth;
      if(this.settings.dataset === 'taxis') {
        this.settings = {...this.settings,
          large_bw: bandwidth,
          small_bw: 2e-4,
        }
      } else {
        this.settings.large_bw=bandwidth;
      }
    },
    resetSettings() {
      let tmpPhi;
      if(this.settings.colormap==="Plasma" ||
        this.settings.colormap==="Viridis" ||
        this.settings.colormap==="Turbo") { // for a dark background, increase the luminance
        tmpPhi=25;
      } else {
        tmpPhi=-25;
      }
      this.settings = {...this.settings,
        large_bw: this.silverman_bw,
        small_bw: this.settings.dataset === 'taxis' ? 2e-4
        : Number((1/Math.trunc(this.settings.width/2)).toFixed(4)),
        eta: 5,
        phi: tmpPhi,
      }
    },
    handleExceed(files) {
      this.$refs.datasetRef.clearFiles();
      const file = files[0];
      file.uid = genFileId()
      this.$refs.datasetRef.handleStart(file);
    },
    handleDataset(file) {
      this.settings = {...this.settings,
        dataset: 'Custom',
        customFile: file,
      }
      document.getElementById('data_name').innerText=`Custom Dataset: ${file.name}`
      return true
    }
  },
  watch: {
    settings: {
      handler(newSettings) {
        newSettings.width = Math.max(newSettings.width, 10);
        newSettings.height = Math.max(newSettings.height, 10);
        this.updateSettings(newSettings);
      },
      deep: true,
    }
  },
  mounted() {
    this.$emit("update", this.settings);
  },
}
</script>

<template>
  <el-aside>
    <el-form label-position="top" label-width="100px" :model="settings" style="max-width: 350px; padding: 15px;">
      <el-form-item label="Dataset">
        <el-select v-model="settings.dataset" placeholder="Select" class="fulfill-width">
          <el-option v-for="item in datasets" :key="item" :label="item" :value="item" />
        </el-select>
        <el-upload class="fulfill-width" action="#" accept=".csv" :limit="1" :auto-upload="false" :show-file-list="false"
        ref="datasetRef" :on-exceed="handleExceed" :on-change="handleDataset" >
          <el-button class="fulfill-width" type="primary">
            <span id="data_name">Custom Dataset</span>
          </el-button>
          <template #tip>
            <div class="el-upload__tip">
              should be two columns of numbers without a header.
            </div>
          </template>
        </el-upload>
      </el-form-item>
      <el-form-item label="Display size">
        <el-col :span="11">
          <el-input v-model.number="settings.width" type="number" step="100" aria-label="Display width"
            placeholder="Display width" />
        </el-col>
        <el-col class="text-center" :span="2"> × </el-col>
        <el-col :span="11">
          <el-input v-model.number="settings.height" type="number" step="100" aria-label="Display height"
            placeholder="Display height" />
        </el-col>
      </el-form-item>
      <el-form-item label="Colormap">
        <el-select v-model="settings.colormap" placeholder="Select" class="fulfill-width">
          <el-option v-for="item in colormaps" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="Exaggeration factor η">
        <el-slider v-model="settings.eta" :step="0.01" :min="0.01" :max="25" show-input />
      </el-form-item>
      <el-form-item label="Luminance scaling param Φ">
        <el-slider v-model="settings.phi" :step="0.01" :min="-100" :max="100" show-input />
      </el-form-item>
      <el-form-item label="Large KDE Bandwidth">
        <el-slider v-model="settings.large_bw" :step="0.001" :min="0.001" :max="10" show-input />
      </el-form-item>
      <el-form-item label="Small KDE Bandwidth">
        <el-slider v-model="settings.small_bw" :step="0.0001" :min="0.0001" :max="1" show-input />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="resetSettings" class="fulfill-width">
          <el-icon>
            <i-ep-circle-check />
          </el-icon>
          <span>Reset</span>
        </el-button>
      </el-form-item>
    </el-form>
    <div class="warning">
      Note: Processing taxis, uk and synthesis5 datasets may be slow due to their large size!
    </div>
  </el-aside>
</template>

<style>
  .el-upload {
    width: 100%;
  }
</style>
<style scoped>
  .el-aside {
    background-color: #eee;
    border-right: 7px solid #aaa;
    width: 380px;
    height: calc(100vh - 62px);
  }

  .fulfill-width {
    width: 100%;
  }

  .text-center {
    text-align: center;
  }

  .warning {
    color: #e6a23c;
    background-color: #dbdbdb;
    text-align: center;
    margin: 0 10px 0 10px;
    font-size: 17pt;
    padding: 5px 0 5px 0;
  }
</style>