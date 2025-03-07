import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Layout, 
  Menu, 
  Upload, 
  Button, 
  List, 
  Card, 
  message, 
  Select,
  Space,
  Spin,
  Input,
  Form,
  Tooltip
} from 'antd';
import { 
  UploadOutlined, 
  FileOutlined,
  CodeOutlined,
  FolderOutlined
} from '@ant-design/icons';
import { api, ChartValues, RenderResult, ChartInfo, FileWithPath } from '../services/api';
import Editor from '@monaco-editor/react';
import yaml from 'yaml';

const { Header, Content, Sider } = Layout;
const { Option } = Select;

interface ChartOption {
  name: string;
  version: string;
  fileName: string;
}

interface RenderOptions {
  name?: string;
  namespace?: string;
}

// 扩展 HTMLInputElement 接口以支持 webkitdirectory 属性
declare global {
  interface HTMLInputElement extends HTMLElement {
    webkitdirectory: boolean;
  }
}

const Home: React.FC = () => {
  const [charts, setCharts] = useState<ChartOption[]>([]);
  const [selectedChart, setSelectedChart] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [values, setValues] = useState<string>(yaml.stringify({}, { indent: 2 }));
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderOptions, setRenderOptions] = useState<RenderOptions>({
    name: '',
    namespace: 'default'
  });
  const valuesEditorContainerRef = useRef<HTMLDivElement>(null);
  const renderedEditorContainerRef = useRef<HTMLDivElement>(null);
  const editorsRef = useRef<Map<string, any>>(new Map());
  const resizeTimeoutRef = useRef<NodeJS.Timeout>();
  const resizeObserversRef = useRef<Map<string, ResizeObserver>>(new Map());

  const editorOptions = {
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    fixedOverflowWidgets: true,
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible'
    },
    lineNumbers: 'off' as const,
    renderLineHighlight: 'all',
    fontSize: 14,
    automaticLayout: false,
    readOnly: false
  } as const;

  const readOnlyEditorOptions = {
    ...editorOptions,
    readOnly: true
  } as const;

  // 处理编辑器大小调整
  const handleResize = useCallback((editorId: string) => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      const editor = editorsRef.current.get(editorId);
      if (editor) {
        editor.layout();
      }
    }, 16);
  }, []);

  // 设置编辑器引用和初始化配置
  const handleEditorDidMount = useCallback((editor: any, monaco: any, containerRef: React.RefObject<HTMLDivElement>, editorId: string) => {
    editorsRef.current.set(editorId, editor);

    // 设置 ResizeObserver 来监听容器大小变化
    if (containerRef.current && !resizeObserversRef.current.has(editorId)) {
      const observer = new ResizeObserver((entries) => {
        if (!entries.length) return;
        handleResize(editorId);
      });
      observer.observe(containerRef.current);
      resizeObserversRef.current.set(editorId, observer);
    }

    // 初始化布局
    requestAnimationFrame(() => {
      editor.layout();
    });
  }, [handleResize]);

  // 清理 resize 监听
  useEffect(() => {
    return () => {
      resizeObserversRef.current.forEach(observer => observer.disconnect());
      resizeObserversRef.current.clear();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  // 加载 Charts 列表
  const loadCharts = async () => {
    try {
      const chartList = await api.listCharts();
      const chartOptions = (chartList || []).map((fileName: string) => {
        const { name, version } = parseChartInfo(fileName);
        return { name, version, fileName };
      });
      setCharts(chartOptions);
    } catch (error) {
      message.error('Failed to load charts');
      setCharts([]);
    }
  };

  // 从文件名解析 Chart 信息
  const parseChartInfo = (fileName: string): ChartInfo => {
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

  // 获取当前选中的 Chart 的版本列表
  const getVersionsForChart = (chartName: string): string[] => {
    return charts
      .filter(chart => chart.name === chartName)
      .map(chart => chart.version);
  };

  // 加载 Values
  const loadValues = async (chartName: string, version: string) => {
    try {
      const values = await api.getChartValues(chartName, version);
      setValues(yaml.stringify(values || {}));
    } catch (error) {
      message.error('Failed to load values');
      setValues('');
    }
  };

  // 渲染 Chart
  const handleRender = async () => {
    if (!selectedChart || !selectedVersion) {
      message.error('Please select a chart and version');
      return;
    }

    try {
      setLoading(true);
      const parsedValues = yaml.parse(values || '{}');
      const result = await api.renderChart(selectedChart, selectedVersion, parsedValues, renderOptions);
      setRenderResult(result);
    } catch (error) {
      message.error('Failed to render chart');
      setRenderResult(null);
    } finally {
      setLoading(false);
    }
  };

  // 处理文件上传
  const handleUpload = async (file: File) => {
    try {
      await api.uploadChart(file);
      message.success('Chart uploaded successfully');
      loadCharts();
    } catch (error) {
      message.error('Failed to upload chart');
    }
    return false;
  };

  // 处理目录上传
  const handleDirUpload = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    setLoading(true);

    // 获取根目录名称（第一个文件的路径中的第一个目录）
    const firstPath = files[0].webkitRelativePath;
    const rootDir = firstPath.split('/')[0];

    // 创建一个包含文件和相对路径信息的数组
    const fileList: FileWithPath[] = Array.from(files).map(file => {
      const fullPath = file.webkitRelativePath;
      // 移除根目录名，保持其他目录结构
      const relativePath = fullPath.startsWith(rootDir + '/') 
        ? fullPath.substring(rootDir.length + 1)
        : fullPath;

      return {
        file,
        path: relativePath
      };
    });

    // 检查是否包含 Chart.yaml 文件
    const hasChartYaml = fileList.some(({ path }) => path === 'Chart.yaml');

    if (!hasChartYaml) {
      message.error('Invalid chart directory: Chart.yaml not found in the root directory');
      setLoading(false);
      return;
    }

    // 检查必需的文件
    const requiredFiles = ['Chart.yaml', 'values.yaml'];
    const missingFiles = requiredFiles.filter(file => 
      !fileList.some(({ path }) => path === file)
    );

    if (missingFiles.length > 0) {
      message.error(`Missing required files: ${missingFiles.join(', ')}`);
      setLoading(false);
      return;
    }

    api.uploadChartDir(fileList)
      .then(() => {
        message.success('Chart directory uploaded successfully');
        loadCharts();
      })
      .catch((error) => {
        console.error('Upload error:', error);
        message.error('Failed to upload chart directory');
      })
      .finally(() => {
        setLoading(false);
        input.value = '';
      });
  };

  // 处理 Chart 选择
  const handleChartChange = (chartName: string) => {
    setSelectedChart(chartName);
    setSelectedVersion('');
  };

  // 处理渲染选项变更
  const handleRenderOptionsChange = (field: keyof RenderOptions, value: string) => {
    setRenderOptions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 初始加载
  useEffect(() => {
    loadCharts();
  }, []);

  // 当选择的版本改变时
  useEffect(() => {
    if (selectedChart && selectedVersion) {
      loadValues(selectedChart, selectedVersion);
    } else {
      setValues('');
    }
  }, [selectedChart, selectedVersion]);

  // 获取唯一的 Chart 名称列表
  const uniqueChartNames = Array.from(new Set(charts.map(chart => chart.name)));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ padding: 0, background: '#fff' }}>
        <div style={{ padding: '0 24px' }}>
          <h1>Helm UI</h1>
        </div>
      </Header>
      <Layout>
        <Sider width={300} style={{ background: '#fff' }}>
          <div style={{ padding: '24px' }}>
            <Space direction="vertical" style={{ width: '100%', rowGap: 16 }}>
              <Button.Group style={{ width: '100%', display: 'flex', columnGap: 8 }}>
                <Upload
                  accept=".tgz"
                  beforeUpload={handleUpload}
                  showUploadList={false}
                >
                  <Button 
                    style={{ flex: 1 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', columnGap: 8 }}>
                      <UploadOutlined />
                      <span>Package</span>
                    </div>
                  </Button>
                </Upload>
                <Button
                  style={{ flex: 1 }}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.webkitdirectory = true;
                    input.multiple = true;
                    input.onchange = handleDirUpload;
                    input.click();
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', columnGap: 8 }}>
                    <FolderOutlined />
                    <span>Directory</span>
                  </div>
                </Button>
              </Button.Group>
              <Select
                style={{ width: '100%' }}
                placeholder="Select Chart"
                value={selectedChart}
                onChange={handleChartChange}
              >
                {uniqueChartNames.map(name => (
                  <Option key={name} value={name}>{name}</Option>
                ))}
              </Select>
              <Select
                style={{ width: '100%' }}
                placeholder="Select Version"
                value={selectedVersion}
                onChange={setSelectedVersion}
                disabled={!selectedChart}
              >
                {getVersionsForChart(selectedChart).map(version => (
                  <Option key={version} value={version}>{version}</Option>
                ))}
              </Select>
              <Form layout="vertical" style={{ width: '100%' }}>
                <Form.Item label="Release Name" required>
                  <Input
                    placeholder="Enter release name"
                    value={renderOptions.name}
                    onChange={(e) => handleRenderOptionsChange('name', e.target.value)}
                  />
                </Form.Item>
                <Form.Item label="Namespace">
                  <Input
                    placeholder="Enter namespace"
                    value={renderOptions.namespace}
                    onChange={(e) => handleRenderOptionsChange('namespace', e.target.value)}
                  />
                </Form.Item>
              </Form>
              <Button 
                type="primary" 
                onClick={handleRender}
                disabled={!selectedChart || !selectedVersion || !renderOptions.name}
                block
              >
                Render
              </Button>
            </Space>
          </div>
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content style={{ maxWidth: '100%', overflow: 'auto' }}>
            <Spin spinning={loading}>
              <Card 
                title="Values" 
                style={{ 
                  marginBottom: 24,
                  height: 'auto',
                  minHeight: '400px',
                  width: '100%'
                }}
                bodyStyle={{
                  padding: '12px',
                  height: 'calc(100% - 57px)',  // 57px is the height of card header
                  width: '100%'
                }}
              >
                <div 
                  ref={valuesEditorContainerRef}
                  style={{ 
                    height: '400px',
                    width: '100%',
                    border: '1px solid #d9d9d9',
                    borderRadius: '2px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Editor
                    language="yaml"
                    theme="light"
                    value={values}
                    onChange={(value) => setValues(value || yaml.stringify({}, { indent: 2 }))}
                    onMount={(editor, monaco) => handleEditorDidMount(editor, monaco, valuesEditorContainerRef, 'values')}
                    options={editorOptions}
                    height="100%"
                  />
                </div>
              </Card>
              {renderResult && (
                <Card 
                  title="Rendered Resources" 
                  style={{ 
                    marginTop: '24px',
                    height: 'auto',
                    minHeight: '400px',
                    width: '100%'
                  }}
                  bodyStyle={{
                    padding: '12px',
                    width: '100%'
                  }}
                >
                  <List
                    style={{ width: '100%' }}
                    dataSource={Object.entries(renderResult.files || {})}
                    renderItem={([kind, content]) => (
                      <List.Item style={{ width: '100%' }}>
                        <Card 
                          title={kind} 
                          style={{ 
                            width: '100%',
                            marginBottom: 16
                          }}
                          bodyStyle={{
                            padding: '12px',
                            width: '100%'
                          }}
                        >
                          <div 
                            ref={renderedEditorContainerRef}
                            style={{ 
                              height: '400px',
                              width: '100%',
                              border: '1px solid #d9d9d9',
                              borderRadius: '2px',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                          >
                            <Editor
                              language="yaml"
                              theme="light"
                              value={content}
                              onMount={(editor, monaco) => handleEditorDidMount(editor, monaco, renderedEditorContainerRef, 'rendered')}
                              options={readOnlyEditorOptions}
                              height="100%"
                            />
                          </div>
                        </Card>
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </Spin>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default Home; 