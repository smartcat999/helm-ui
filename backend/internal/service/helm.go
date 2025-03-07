package service

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart/loader"
	"helm.sh/helm/v3/pkg/chartutil"
	"helm.sh/helm/v3/pkg/cli"
	"helm.sh/helm/v3/pkg/releaseutil"
)

// HelmService 处理 Helm 相关操作
type HelmService struct {
	chartsDir string
	tempDir   string
	settings  *cli.EnvSettings
}

// NewHelmService 创建新的 Helm 服务
func NewHelmService() *HelmService {
	return &HelmService{
		chartsDir: "../charts",
		tempDir:   "../temp",
		settings:  cli.New(),
	}
}

// PackageChart 将 Chart 目录打包成 tgz 文件
func (s *HelmService) PackageChart(chartDir string) (string, error) {
	// 加载 Chart
	chart, err := loader.Load(chartDir)
	if err != nil {
		return "", fmt.Errorf("failed to load chart: %w", err)
	}

	// 确保临时目录存在
	if err := os.MkdirAll(s.tempDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create temp directory: %w", err)
	}

	// 生成打包后的文件名
	packagedFileName := fmt.Sprintf("%s-%s.tgz", chart.Metadata.Name, chart.Metadata.Version)
	packagedFilePath := filepath.Join(s.tempDir, packagedFileName)

	// 打包 Chart
	if _, err := chartutil.Save(chart, s.tempDir); err != nil {
		return "", fmt.Errorf("failed to package chart: %w", err)
	}

	return packagedFilePath, nil
}

// UploadChartDir 上传并打包 Chart 目录
func (s *HelmService) UploadChartDir(chartDir string) error {
	// 打包 Chart
	packagedFilePath, err := s.PackageChart(chartDir)
	if err != nil {
		return err
	}

	// 读取打包后的文件
	chartFile, err := os.Open(packagedFilePath)
	if err != nil {
		return fmt.Errorf("failed to open packaged chart: %w", err)
	}
	defer chartFile.Close()

	// 获取文件名
	fileName := filepath.Base(packagedFilePath)

	// 上传到 charts 目录
	if err := s.UploadChart(chartFile, fileName); err != nil {
		return err
	}

	// 清理临时文件
	if err := os.Remove(packagedFilePath); err != nil {
		return fmt.Errorf("failed to clean up temporary file: %w", err)
	}

	return nil
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
func (s *HelmService) RenderChart(name, version string, values map[string]interface{}, releaseName, namespace string, selectedFiles []string) (string, error) {
	chartPath := filepath.Join(s.chartsDir, fmt.Sprintf("%s-%s.tgz", name, version))

	// 加载 Chart
	chart, err := loader.Load(chartPath)
	if err != nil {
		return "", fmt.Errorf("failed to load chart: %w", err)
	}

	// 创建 action 配置
	actionConfig := new(action.Configuration)
	if err := actionConfig.Init(s.settings.RESTClientGetter(), namespace, os.Getenv("HELM_DRIVER"), nil); err != nil {
		return "", fmt.Errorf("failed to init action config: %w", err)
	}

	// 创建模板动作
	client := action.NewInstall(actionConfig)
	client.DryRun = true
	client.ReleaseName = releaseName
	client.Namespace = namespace
	client.Replace = true
	client.ClientOnly = true

	// 渲染 Chart
	rel, err := client.Run(chart, values)
	if err != nil {
		return "", fmt.Errorf("failed to render chart: %w", err)
	}

	// 如果指定了文件列表，过滤渲染结果
	if len(selectedFiles) > 0 {
		var filteredManifests []string
		manifests := releaseutil.SplitManifests(rel.Manifest)

		for _, selectedFile := range selectedFiles {
			for _, manifest := range manifests {
				// 构建完整的文件路径模式
				fullPath := fmt.Sprintf("%s/%s", chart.Metadata.Name, selectedFile)
				if strings.Contains(manifest, fmt.Sprintf("# Source: %s", fullPath)) {
					filteredManifests = append(filteredManifests, manifest)
				}
			}
		}

		return strings.Join(filteredManifests, "\n---\n"), nil
	}

	return rel.Manifest, nil
}

// ListChartFiles 列出指定 Chart 包含的文件
func (s *HelmService) ListChartFiles(name, version string) ([]string, error) {
	chartPath := filepath.Join(s.chartsDir, fmt.Sprintf("%s-%s.tgz", name, version))

	// 加载 Chart
	chart, err := loader.Load(chartPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load chart: %w", err)
	}

	var files []string
	for _, f := range chart.Raw {
		files = append(files, f.Name)
	}

	return files, nil
}
