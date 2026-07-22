#!/usr/bin/env python3
"""提取视频关键帧的 ffmpeg 包装器。

自动计算帧率以控制帧数量和 token 消耗。
短视频使用更高帧率，长视频自动降低帧率。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def get_video_info(video_path: Path) -> dict:
    """使用 ffprobe 获取视频元数据。"""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=duration,width,height,r_frame_rate",
        "-show_entries", "format=duration",
        "-of", "json",
        str(video_path),
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {result.stderr}")
    
    data = json.loads(result.stdout)
    
    # 解析时长
    duration = None
    if "format" in data and "duration" in data["format"]:
        duration = float(data["format"]["duration"])
    elif "streams" in data and len(data["streams"]) > 0:
        stream = data["streams"][0]
        if "duration" in stream:
            duration = float(stream["duration"])
    
    # 解析帧率
    fps = None
    if "streams" in data and len(data["streams"]) > 0:
        stream = data["streams"][0]
        if "r_frame_rate" in stream:
            # 帧率可能是 "30/1" 或 "30000/1001" 格式
            fps_str = stream["r_frame_rate"]
            if "/" in fps_str:
                num, den = fps_str.split("/")
                fps = float(num) / float(den)
            else:
                fps = float(fps_str)
    
    return {
        "duration": duration,
        "fps": fps,
        "width": data["streams"][0].get("width") if "streams" in data else None,
        "height": data["streams"][0].get("height") if "streams" in data else None,
    }


def calculate_auto_fps(duration: float, max_frames: int = 80, focused: bool = False) -> tuple[float, int]:
    """根据视频时长自动计算合适的帧率。
    
    Args:
        duration: 视频时长（秒）
        max_frames: 最大帧数限制
        focused: 是否为聚焦模式（分析特定时间段）
    
    Returns:
        (fps, target_frames): 建议帧率和目标帧数
    """
    if focused:
        # 聚焦模式：更密集的采样
        if duration <= 60:
            fps = 1.0  # 每秒1帧
        elif duration <= 180:
            fps = 0.5  # 每2秒1帧
        elif duration <= 600:
            fps = 0.2  # 每5秒1帧
        else:
            fps = 0.1  # 每10秒1帧
    else:
        # 普通模式
        if duration <= 60:
            fps = 0.5  # 每2秒1帧
        elif duration <= 300:
            fps = 0.2  # 每5秒1帧
        elif duration <= 600:
            fps = 0.1  # 每10秒1帧
        elif duration <= 1800:
            fps = 0.05  # 每20秒1帧
        else:
            fps = 0.033  # 每30秒1帧
    
    target_frames = min(max_frames, int(duration * fps))
    target_frames = max(10, target_frames)  # 至少10帧
    
    # 重新计算实际 fps
    actual_fps = target_frames / duration if duration > 0 else fps
    
    return actual_fps, target_frames


def extract_frames(
    video_path: Path,
    output_dir: Path,
    fps: float = 0.1,
    resolution: int = 512,
    max_frames: int = 80,
    start_seconds: float | None = None,
    end_seconds: float | None = None,
) -> list[Path]:
    """提取视频帧为 JPEG 图片。
    
    Args:
        video_path: 视频文件路径
        output_dir: 输出目录
        fps: 每秒提取帧数
        resolution: 输出图片宽度（高度自动按比例）
        max_frames: 最大帧数限制
        start_seconds: 开始时间（秒），None 表示从头开始
        end_seconds: 结束时间（秒），None 表示到结尾
    
    Returns:
        提取的帧文件路径列表
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 构建 ffmpeg 命令
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    
    # 时间范围
    if start_seconds is not None:
        cmd.extend(["-ss", str(start_seconds)])
    
    cmd.extend(["-i", str(video_path)])
    
    if end_seconds is not None and start_seconds is not None:
        duration = end_seconds - start_seconds
        cmd.extend(["-t", str(duration)])
    elif end_seconds is not None:
        cmd.extend(["-to", str(end_seconds)])
    
    # 视频滤镜：缩放 + fps
    vf_filter = f"fps={fps},scale={resolution}:-1:flags=lanczos"
    cmd.extend([
        "-vf", vf_filter,
        "-q:v", "2",  # JPEG 质量（2-5 是高质量范围）
        "-frame_pts", "1",  # 使用帧时间戳作为文件名
        str(output_dir / "frame_%04d.jpg"),
    ])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr}")
    
    # 获取生成的帧文件列表
    frames = sorted(output_dir.glob("frame_*.jpg"))
    
    # 如果帧数超过限制，均匀采样
    if len(frames) > max_frames:
        step = len(frames) / max_frames
        selected_indices = [int(i * step) for i in range(max_frames)]
        frames = [frames[i] for i in selected_indices]
        
        # 删除未选中的帧
        all_frames = set(output_dir.glob("frame_*.jpg"))
        selected_frames = set(frames)
        for f in all_frames - selected_frames:
            f.unlink()
    
    return frames


def main() -> int:
    import argparse
    
    parser = argparse.ArgumentParser(description="Extract frames from video")
    parser.add_argument("video", type=Path, help="Video file path")
    parser.add_argument("--out-dir", type=Path, required=True, help="Output directory")
    parser.add_argument("--fps", type=float, help="Frames per second (auto if not specified)")
    parser.add_argument("--resolution", type=int, default=512, help="Frame width in pixels")
    parser.add_argument("--max-frames", type=int, default=80, help="Maximum number of frames")
    parser.add_argument("--start", type=float, help="Start time in seconds")
    parser.add_argument("--end", type=float, help="End time in seconds")
    parser.add_argument("--focused", action="store_true", help="Focused mode (denser sampling)")
    
    args = parser.parse_args()
    
    # 获取视频信息
    info = get_video_info(args.video)
    duration = info["duration"]
    
    if duration is None:
        print("Error: Could not determine video duration", file=sys.stderr)
        return 1
    
    # 计算时间范围
    start_sec = args.start
    end_sec = args.end
    effective_start = start_sec if start_sec is not None else 0.0
    effective_end = end_sec if end_sec is not None else duration
    effective_duration = max(0.0, effective_end - effective_start)
    
    # 计算帧率
    if args.fps is not None:
        fps = args.fps
        target_frames = int(effective_duration * fps)
    else:
        fps, target_frames = calculate_auto_fps(
            effective_duration, 
            max_frames=args.max_frames,
            focused=args.focused or (start_sec is not None or end_sec is not None)
        )
    
    print(f"[frames] Video duration: {duration:.1f}s", file=sys.stderr)
    print(f"[frames] Extracting from {effective_start:.1f}s to {effective_end:.1f}s", file=sys.stderr)
    print(f"[frames] FPS: {fps:.3f}, Target frames: {target_frames}", file=sys.stderr)
    
    # 提取帧
    frames = extract_frames(
        args.video,
        args.out_dir,
        fps=fps,
        resolution=args.resolution,
        max_frames=args.max_frames,
        start_seconds=start_sec,
        end_seconds=end_sec,
    )
    
    # 输出结果
    result = {
        "meta": info,
        "fps": fps,
        "target_frames": target_frames,
        "actual_frames": len(frames),
        "focused": args.focused or (start_sec is not None or end_sec is not None),
        "frames": [str(f) for f in frames],
    }
    
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
