---
name: video-analyzer
description: 分析视频内容（URL或本地路径）。使用 yt-dlp 下载视频，使用 ffmpeg 提取自动缩放的关键帧，从字幕获取转录文本（或使用 Whisper API 作为后备），并将结果交给 Claude 以便回答关于视频内容的问题。用于深度解析 B 站、YouTube 等平台的视频，提取要点、分析架构和功能逻辑。
---

# 视频分析器 (Video Analyzer)

## 功能概述

这个技能让 Claude 能够深度分析任何视频内容。它会：
1. 使用 yt-dlp 下载视频（支持 B 站、YouTube 等平台）
2. 使用 ffmpeg 提取关键帧（自动调整帧率以控制 token 消耗）
3. 提取字幕或使用 Whisper API 生成转录文本
4. 将帧和转录文本交给 Claude 进行深度分析

## 使用场景

- 分析 B 站教程视频，提取功能要点和实现逻辑
- 分析竞品视频，了解行业最佳实践
- 从视频中学习架构设计和技术方案
- 提取视频中的视觉设计元素和交互模式

## 使用方法

### 基本用法

```
分析视频: <视频URL>
```

例如：
```
分析视频: https://www.bilibili.com/video/BV11SNA6PEZa
```

### 带问题的分析

```
分析视频: <视频URL> [你的问题]
```

例如：
```
分析视频: https://www.bilibili.com/video/BV1RSRSBeEPL 这个产品的核心功能架构是什么？
```

### 分析特定时间段

```
分析视频: <视频URL> --start 00:30 --end 05:00
```

### 调整详细程度

```
分析视频: <视频URL> --detail high    # 更多帧，更高分辨率
分析视频: <视频URL> --detail low     # 更少帧，节省 token
```

## 工作流程

1. **预检查**: 运行 `python scripts/setup.py --check` 检查依赖
2. **下载视频**: 使用 yt-dlp 下载视频和原生字幕
3. **提取帧**: 使用 ffmpeg 提取关键帧（自动计算帧率）
4. **获取转录**: 优先使用原生字幕，如无则使用 Whisper API
5. **分析报告**: Claude 读取帧和转录文本，生成深度分析

## 依赖要求

- Python 3.9+
- ffmpeg
- yt-dlp
- requests (用于 Whisper API)

## API 配置（可选）

如需使用 Whisper 转录（当视频无字幕时）：

1. 创建配置文件：`~/.config/watch/.env`
2. 添加 API 密钥（二选一）：
   - `GROQ_API_KEY=...`（推荐，更快更便宜）
   - `OPENAI_API_KEY=...`（备选）

## 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `--start` | 开始时间 | `00:30` 或 `90`（秒） |
| `--end` | 结束时间 | `05:00` 或 `300`（秒） |
| `--detail` | 详细程度 | `high`/`balanced`/`low`/`transcript` |
| `--resolution` | 帧宽度 | `512`（默认）、`1024` |
| `--fps` | 固定帧率 | 覆盖自动帧率计算 |
| `--no-whisper` | 禁用 Whisper | 仅使用原生字幕 |

## Token 效率

- 80 帧 @ 512px 约 50-80k 图像 token
- 转录文本很便宜（10 分钟视频约几千 token）
- 分辨率提升到 1024 会使图像 token 增加约 4 倍

## 安全与权限

**这个技能会：**
- 本地运行 yt-dlp 下载视频和字幕
- 本地运行 ffmpeg 提取帧和音频
- 仅在需要时发送音频到 Whisper API
- 将下载的视频、帧、音频写入临时目录

**这个技能不会：**
- 上传视频本身到任何 API
- 访问任何平台账户（不登录、不使用 Cookie）
- 在不同提供商之间共享 API 密钥
- 记录或缓存 API 密钥到输出文件

## 故障排除

- **下载失败**: 可能是需要登录或区域限制的视频
- **无转录可用**: 字幕缺失且 Whisper 未配置，运行 `python scripts/setup.py` 设置
- **长视频警告**: 建议使用 `--start`/`--end` 聚焦特定段落

## 脚本说明

- `watch.py`: 主入口，协调整个流程
- `download.py`: yt-dlp 包装器，下载视频和字幕
- `frames.py`: ffmpeg 帧提取，自动计算帧率
- `transcribe.py`: 字幕解析和时间段过滤
- `whisper.py`: Groq/OpenAI Whisper API 客户端
- `setup.py`: 预检查和安装程序
