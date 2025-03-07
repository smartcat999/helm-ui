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
  Spin
} from 'antd';
import { 
  UploadOutlined, 
  FileOutlined,
  CodeOutlined
} from '@ant-design/icons';
import { api, ChartValues, RenderResult, ChartInfo } from '../services/api';
import Editor from '@monaco-editor/react';
import yaml from 'yaml';

const { Header, Content, Sider } = Layout;
const { Option } = Select;

interface ChartOption {
  name: string;
  version: string;
  fileName: string;
}

const Home: React.FC = () => {
  const [charts, setCharts] = useState<ChartOption[]>([]);
  const [selectedChart, setSelectedChart] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [values, setValues] = useState<string>(yaml.stringify({}, { indent: 2 }));
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<any>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout>();

  // 处理编辑器大小调整
  const handleResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    }, 100);
  }, []);

  // 设置编辑器引用
  const handleEditorDidMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  // 添加和移除 resize 事件监听
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [handleResize]);

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
      const result = await api.renderChart(selectedChart, selectedVersion, parsedValues);
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

  // 处理 Chart 选择
  const handleChartChange = (chartName: string) => {
    setSelectedChart(chartName);
    setSelectedVersion('');
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
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                accept=".tgz"
                beforeUpload={handleUpload}
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />} block>
                  Upload Chart
                </Button>
              </Upload>
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
              <Button 
                type="primary" 
                onClick={handleRender}
                disabled={!selectedChart || !selectedVersion}
                block
              >
                Render
              </Button>
            </Space>
          </div>
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content>
            <Spin spinning={loading}>
              <Card 
                title="Values" 
                style={{ 
                  marginBottom: 24,
                  height: 'auto',
                  minHeight: '400px'
                }}
                bodyStyle={{
                  padding: '12px',
                  height: 'calc(100% - 57px)'  // 57px is the height of card header
                }}
              >
                <div style={{ 
                  height: '400px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '2px'
                }}>
                  <Editor
                    language="yaml"
                    theme="light"
                    value={values}
                    onChange={(value) => setValues(value || yaml.stringify({}, { indent: 2 }))}
                    onMount={handleEditorDidMount}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fixedOverflowWidgets: true,
                      scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible'
                      },
                      lineNumbers: 'on',
                      renderLineHighlight: 'all',
                      fontSize: 14
                    }}
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
                    minHeight: '400px'
                  }}
                  bodyStyle={{
                    padding: '12px'
                  }}
                >
                  <List
                    dataSource={Object.entries(renderResult.files || {})}
                    renderItem={([kind, content]) => (
                      <List.Item>
                        <Card 
                          title={kind} 
                          style={{ 
                            width: '100%',
                            marginBottom: 16
                          }}
                          bodyStyle={{
                            padding: '12px'
                          }}
                        >
                          <div style={{ 
                            height: '400px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '2px'
                          }}>
                            <Editor
                              language="yaml"
                              theme="light"
                              value={content}
                              onMount={handleEditorDidMount}
                              options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                fixedOverflowWidgets: true,
                                scrollbar: {
                                  vertical: 'visible',
                                  horizontal: 'visible'
                                },
                                lineNumbers: 'on',
                                renderLineHighlight: 'all',
                                fontSize: 14
                              }}
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