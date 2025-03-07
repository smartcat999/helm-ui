package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/smartcat999/helm-ui/internal/api"
	"github.com/smartcat999/helm-ui/internal/service"
)

func main() {
	// 创建 Helm 服务
	helmService := service.NewHelmService()

	// 创建 API 处理器
	handler := api.NewHandler(helmService)

	// 设置路由
	r := gin.Default()

	// 允许跨域
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// API 路由
	r.POST("/api/charts", handler.UploadChart)
	r.POST("/api/charts/dir", handler.UploadChartDir)
	r.GET("/api/charts", handler.ListCharts)
	r.GET("/api/charts/:name/versions", handler.ListChartVersions)
	r.POST("/api/charts/:name/:version/render", handler.RenderChart)
	r.GET("/api/charts/:name/:version/values", handler.GetChartValues)

	// 启动服务器
	log.Fatal(http.ListenAndServe(":8080", r))
}
