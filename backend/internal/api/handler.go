package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/smartcat999/helm-ui/internal/service"
)

// Handler 处理 API 请求
type Handler struct {
	helmService *service.HelmService
}

// NewHandler 创建新的处理器
func NewHandler(helmService *service.HelmService) *Handler {
	return &Handler{
		helmService: helmService,
	}
}

// UploadChart 处理 Chart 上传
func (h *Handler) UploadChart(c *gin.Context) {
	file, header, err := c.Request.FormFile("chart")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No chart file uploaded"})
		return
	}
	defer file.Close()

	if err := h.helmService.UploadChart(file, header.Filename); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Chart uploaded successfully"})
}

// ListCharts 列出所有 Charts
func (h *Handler) ListCharts(c *gin.Context) {
	charts, err := h.helmService.ListCharts()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"charts": charts})
}

// ListChartVersions 列出指定 Chart 的所有版本
func (h *Handler) ListChartVersions(c *gin.Context) {
	name := c.Param("name")
	versions, err := h.helmService.ListChartVersions(name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"versions": versions})
}

// GetChartValues 获取指定 Chart 的 values
func (h *Handler) GetChartValues(c *gin.Context) {
	name := c.Param("name")
	version := c.Param("version")

	values, err := h.helmService.GetChartValues(name, version)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"values": values})
}

// RenderChart 渲染 Chart
func (h *Handler) RenderChart(c *gin.Context) {
	name := c.Param("name")
	version := c.Param("version")

	var values map[string]interface{}
	if err := c.BindJSON(&values); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid values format"})
		return
	}

	result, err := h.helmService.RenderChart(name, version, values)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"files": result})
}
