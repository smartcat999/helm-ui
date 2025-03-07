import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

export interface FileWithPath {
  file: File;
  path: string;
}

export interface ChartValues {
  [key: string]: any;
}

export interface RenderResult {
  manifests: string;
}

export interface ChartInfo {
  name: string;
  version: string;
}

export interface RenderOptions {
  name?: string;
  namespace?: string;
}

// 从文件名解析 Chart 信息
const parseChartFileName = (fileName: string): ChartInfo => {
  // 移除 .tgz 扩展名
  const baseName = fileName.replace(/\.tgz$/, '');
  // 查找最后一个连字符的位置
  const lastHyphen = baseName.lastIndexOf('-');
  if (lastHyphen === -1) {
    return { name: baseName, version: '' };
  }
  return {
    name: baseName.substring(0, lastHyphen),
    version: baseName.substring(lastHyphen + 1)
  };
};

export const api = {
  // 上传 Chart
  uploadChart: async (file: File) => {
    const formData = new FormData();
    formData.append('chart', file);
    const response = await axios.post(`${API_BASE_URL}/charts`, formData);
    return response.data;
  },

  // 获取 Charts 列表
  listCharts: async () => {
    const response = await axios.get(`${API_BASE_URL}/charts`);
    return response.data.charts;
  },

  // 获取 Chart 版本列表
  listChartVersions: async (chartName: string) => {
    const response = await axios.get(`${API_BASE_URL}/charts/${chartName}/versions`);
    return response.data.versions;
  },

  // 获取 Chart Values
  getChartValues: async (chartName: string, version: string) => {
    const response = await axios.get(`${API_BASE_URL}/charts/${chartName}/${version}/values`);
    return response.data.values;
  },

  // 渲染 Chart
  renderChart: async (
    chartName: string, 
    version: string, 
    values: ChartValues,
    options: RenderOptions
  ): Promise<RenderResult> => {
    const response = await axios.post(
      `${API_BASE_URL}/charts/${chartName}/${version}/render`,
      {
        values,
        name: options.name,
        namespace: options.namespace
      }
    );
    return response.data;
  },

  // 上传 Chart 目录
  uploadChartDir: async (files: FileWithPath[]): Promise<void> => {
    const formData = new FormData();
    
    // 添加所有文件，使用 chart 作为字段名
    files.forEach(({ file, path }) => {
      formData.append('chart', file, path);
    });

    const response = await axios.post(`${API_BASE_URL}/charts/dir`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      // 添加超时设置，因为上传可能需要较长时间
      timeout: 30000
    });
    
    if (response.status !== 200) {
      throw new Error('Failed to upload chart directory');
    }
  },
}; 