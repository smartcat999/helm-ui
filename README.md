# Helm UI

一个用于测试和预览 Helm Charts 渲染结果的工具。

## 功能特性

- 上传 Helm Chart 包
- 查看已上传的 Charts 列表
- 查看指定 Chart 的所有版本
- 获取 Chart 的默认 values
- 自定义 values 并预览渲染结果
- 支持查看渲染后的 YAML 文件

## API 接口

### 上传 Chart
```
POST /api/charts
Content-Type: multipart/form-data
```

### 获取 Charts 列表
```
GET /api/charts
```

### 获取 Chart 版本列表
```
GET /api/charts/:name/versions
```

### 获取 Chart Values
```
GET /api/charts/:name/:version/values
```

### 渲染 Chart
```
POST /api/charts/:name/:version/render
Content-Type: application/json

{
    "key1": "value1",
    "key2": "value2"
}
```

## 快速开始

1. 克隆项目
```bash
git clone https://github.com/smartcat999/helm-ui.git
cd helm-ui
```

2. 安装依赖
```bash
go mod download
```

3. 运行服务
```bash
cd backend/cmd
go run main.go
```

4. 使用示例

上传 Chart：
```bash
curl -X POST -F "chart=@mychart-0.1.0.tgz" http://localhost:8080/api/charts
```

渲染 Chart：
```bash
curl -X POST -H "Content-Type: application/json" -d '{"replicaCount": 3}' \
    http://localhost:8080/api/charts/mychart/0.1.0/render
```

## 目录结构

```
helm-ui/
├── backend/
│   ├── cmd/
│   │   └── main.go
│   └── internal/
│       ├── api/
│       │   └── handler.go
│       └── service/
│           └── helm.go
├── charts/
└── README.md
```

## 依赖

- Go 1.21+
- Helm v3
- gin-gonic/gin 