package service

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/cli"
	"sigs.k8s.io/yaml"
)

// HelmService 处理 Helm 相关操作
type HelmService struct {
	chartsDir string
	settings  *cli.EnvSettings
}

// NewHelmService 创建新的 Helm 服务
func NewHelmService() *HelmService {
	return &HelmService{
		chartsDir: "../charts",
		settings:  cli.New(),
	}
}

// UploadChart 上传 Helm Chart
func (s *HelmService) UploadChart(chartFile io.Reader, filename string) error {
	// 确保目录存在
	if err := os.MkdirAll(s.chartsDir, 0755); err != nil {
		return fmt.Errorf("failed to create charts directory: %w", err)
	}

	// 创建目标文件
	dst, err := os.Create(filepath.Join(s.chartsDir, filename))
	if err != nil {
		return fmt.Errorf("failed to create chart file: %w", err)
	}
	defer dst.Close()

	// 复制文件内容
	if _, err := io.Copy(dst, chartFile); err != nil {
		return fmt.Errorf("failed to copy chart file: %w", err)
	}

	return nil
}

// ListCharts 列出所有可用的 Charts
func (s *HelmService) ListCharts() ([]string, error) {
	files, err := os.ReadDir(s.chartsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read charts directory: %w", err)
	}

	var charts []string
	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) == ".tgz" {
			charts = append(charts, file.Name())
		}
	}

	return charts, nil
}

// ListChartVersions 列出指定 Chart 的所有版本
func (s *HelmService) ListChartVersions(name string) ([]string, error) {
	files, err := os.ReadDir(s.chartsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read charts directory: %w", err)
	}

	var versions []string
	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) == ".tgz" && filepath.Base(file.Name()) == name {
			versions = append(versions, file.Name())
		}
	}

	return versions, nil
}

// GetChartValues 获取指定 Chart 的 values
func (s *HelmService) GetChartValues(name, version string) (map[string]interface{}, error) {
	chartPath := filepath.Join(s.chartsDir, fmt.Sprintf("%s-%s.tgz", name, version))

	// 加载 Chart
	chart, err := loader.Load(chartPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load chart: %w", err)
	}

	return chart.Values, nil
}

// RenderChart 渲染 Chart
func (s *HelmService) RenderChart(name, version string, values map[string]interface{}) (map[string]string, error) {
	chartPath := filepath.Join(s.chartsDir, fmt.Sprintf("%s-%s.tgz", name, version))

	// 加载 Chart
	chart, err := loader.Load(chartPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load chart: %w", err)
	}

	// 创建 action 配置
	actionConfig := new(action.Configuration)
	if err := actionConfig.Init(s.settings.RESTClientGetter(), "", os.Getenv("HELM_DRIVER"), nil); err != nil {
		return nil, fmt.Errorf("failed to init action config: %w", err)
	}

	// 创建安装动作
	install := action.NewInstall(actionConfig)
	install.DryRun = true
	install.ReleaseName = "test-release"
	install.Replace = true
	install.ClientOnly = true

	// 渲染 Chart
	rel, err := install.Run(chart, values)
	if err != nil {
		return nil, fmt.Errorf("failed to render chart: %w", err)
	}

	// 将渲染结果转换为 map
	result := make(map[string]string)
	manifests := strings.Split(rel.Manifest, "\n---\n")
	for _, manifest := range manifests {
		if manifest == "" {
			continue
		}

		// 将渲染后的内容解析为 YAML
		var obj map[string]interface{}
		if err := yaml.Unmarshal([]byte(manifest), &obj); err != nil {
			continue
		}

		// 获取资源类型
		kind, ok := obj["kind"].(string)
		if !ok {
			continue
		}

		// 将对象转换回 YAML 格式（美化输出）
		data, err := yaml.Marshal(obj)
		if err != nil {
			continue
		}

		result[kind] = string(data)
	}

	return result, nil
}
