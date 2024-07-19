<script>

import { debounce } from 'lodash-es'

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
      },
      silverman_bw: 1,
      datasets: ['diabetes', 'facial', 'PersonActivity', 'CreditCardFraud', 'satimage', 'synthesis1', 'synthesis2', 'synthesis3', 'synthesis4', 'synthesis5'],
      colormaps: ['Magma', 'Plasma', 'Viridis', 'Inferno', 'Turbo', 'Cividis', ],
    }
  },
  methods: {
    updateSettings: debounce(function(evt) {
      this.$emit('update', { ...evt });
    }, 200),
    useSilvermanBandwidth(bandwidth) {
      this.silverman_bw=bandwidth;
      this.settings.large_bw=bandwidth;
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
        small_bw: Number((1/Math.trunc(this.settings.width/2)).toFixed(4)),
        eta: 5,
        phi: tmpPhi,
      }
    }
  },
  watch: {
    settings: {
      handler(newSettings) {
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
    <el-form
      label-position="top"
      label-width="100px"
      :model="settings"
      style="max-width: 350px; padding: 15px;"
    >
      <el-form-item label="Dataset">
        <el-select v-model="settings.dataset" placeholder="Select" class="fulfill-width">
          <el-option
            v-for="item in datasets"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Display size">
        <el-col :span="11">
          <el-input
            v-model.number="settings.width"
            type="number"
            step="100"
            aria-label="Display width"
            placeholder="Display width"
            />
        </el-col>
        <el-col class="text-center" :span="2"> × </el-col>
        <el-col :span="11">
          <el-input
            v-model.number="settings.height"
            type="number"
            step="100"
            aria-label="Display height"
            placeholder="Display height"
            />
        </el-col>
      </el-form-item>
      <el-form-item label="Colormap">
        <el-select v-model="settings.colormap" placeholder="Select" class="fulfill-width">
          <el-option
            v-for="item in colormaps"
            :key="item"
            :label="item"
            :value="item"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="Exaggeration factor η">
        <el-slider
          v-model="settings.eta"
          :step="0.01"
          :min="0.01"
          :max="25"
          show-input />
      </el-form-item>
      <el-form-item label="Luminance scaling param Φ">
        <el-slider
          v-model="settings.phi"
          :step="0.01"
          :min="-100"
          :max="100"
          show-input />
      </el-form-item>
      <el-form-item label="Large KDE Bandwidth">
        <el-slider
          v-model="settings.large_bw"
          :step="0.01"
          :min="0.01"
          :max="10"
          show-input />
      </el-form-item>
      <el-form-item label="Small KDE Bandwidth">
        <el-slider
          v-model="settings.small_bw"
          :step="0.0001"
          :min="0.0001"
          :max="1"
          show-input />
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
  </el-aside>
</template>

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
</style>