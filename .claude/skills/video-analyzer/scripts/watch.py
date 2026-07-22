#!/usr/bin/env python3
"""视频分析器主入口：下载视频、提取帧、解析转录。

输出 Markdown 报告到 stdout，列出帧路径和转录文本。
Claude 然后读取每个帧路径来查看视频内容。
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path


SCRIPT_DIR = Path(__file__).parent.resolve()


def parse_time(time_str: str) -> float | None:
    """解析时间字符串为秒数。
    
    支持格式：
    - 90（纯秒数）
    - 1:30（分:秒）
    - 01:30:00（时:分:秒）
    """
    if time_str is None:
        return None
    
    time_str = time_str.strip()
    
    # 纯秒数
    if time_str.isdigit():
        return float(time_str)
    
    # 尝试解析 HH:MM:SS 或 MM:SS
    parts = time_str.split(":")
    
    if len(parts) == 2:
        # MM:SS
        try:
            minutes = int(parts[0])
            seconds = float(parts[1])
            return minutes * 60 + seconds
        except ValueError:
            return None
    elif len(parts) == 3:
        # HH:MM:SS
        try:
            hours = int(parts[0])
            minutes = int(parts[1])
            seconds = float(parts[2])
            return hours * 3600 + minutes * 60 + seconds
        except ValueError:
            return None
    
    return None


def format_time(seconds: float) -> str:
    """将秒数格式化为 MM:SS。"""
    minutes = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{minutes:02d}:{secs:02d}"


def run_download(url: str, work_dir: Path) -> dict:
    """运行下载脚本。"""
    cmd = [sys.executable, str(SCRIPT_DIR / "download.py"), url, str(work_dir)]
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    
    if result.returncode != 0:
        print(f"[watch] Download error: {result.stderr}", file=sys.stderr)
        raise RuntimeError(f"Download failed: {result.stderr}")
    
    return json.loads(result.stdout)


def run_frames(
    video_path: Path,
    work_dir: Path,
    fps: float | None,
    resolution: int,
    max_frames: int,
    start: float | None,
    end: float | None,
) -> dict:
    """运行帧提取脚本。"""
    frames_dir = work_dir / "frames"
    
    cmd = [
        sys.executable,
        str(SCRIPT_DIR / "frames.py"),
        str(video_path),
        "--out-dir", str(frames_dir),
        "--resolution", str(resolution),
        "--max-frames", str(max_frames),
    ]
    
    if fps is not None:
        cmd.extend(["--fps", str(fps)])
    if start is not None:
        cmd.extend(["--start", str(start)])
    if end is not None:
        cmd.extend(["--end", str(end)])
    if start is not None or end is not None:
        cmd.append("--focused")
    
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    
    if result.returncode != 0:
        print(f"[watch] Frames error: {result.stderr}", file=sys.stderr)
        raise RuntimeError(f"Frame extraction failed: {result.stderr}")
    
    return json.loads(result.stdout)


def run_transcribe(vtt_path: Path, start: float | None, end: float | None) -> str:
    """运行字幕解析脚本。"""
    cmd = [
        sys.executable,
        str(SCRIPT_DIR / "transcribe.py"),
        str(vtt_path),
    ]
    
    if start is not None:
        cmd.extend(["--start", str(start)])
    if end is not None:
        cmd.extend(["--end", str(end)])
    
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    
    if result.returncode != 0:
        print(f"[watch] Transcribe error: {result.stderr}", file=sys.stderr)
        return ""
    
    return result.stdout.strip()


def run_whisper(video_path: Path, work_dir: Path, backend: str | None) -> tuple[list[dict], str | None]:
    """运行 Whisper 转录脚本。"""
    cmd = [
        sys.executable,
        str(SCRIPT_DIR / "whisper.py"),
        str(video_path),
        "--audio-out", str(work_dir / "audio.mp3"),
    ]
    
    if backend:
        cmd.extend(["--backend", backend])
    
    result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    
    if result.returncode != 0:
        print(f"[watch] Whisper error: {result.stderr}", file=sys.stderr)
        return [], None
    
    data = json.loads(result.stdout)
    return data.get("segments", []), data.get("backend")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Analyze video content - download, extract frames, transcribe",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  watch.py https://www.bilibili.com/video/BV11SNA6PEZa
  watch.py https://www.youtube.com/watch?v=xxx --start 00:30 --end 05:00
  watch.py video.mp4 --detail high --resolution 1024
        """,
    )
    
    parser.add_argument("video", help="Video URL or local file path")
    parser.add_argument("question", nargs="?", help="Optional question about the video")
    parser.add_argument("--start", help="Start time (MM:SS or seconds)")
    parser.add_argument("--end", help="End time (MM:SS or seconds)")
    parser.add_argument(
        "--detail",
        choices=["high", "balanced", "low", "transcript"],
        default="balanced",
        help="Analysis detail level (default: balanced)",
    )
    parser.add_argument("--resolution", type=int, default=512, help="Frame width in pixels (default: 512)")
    parser.add_argument("--fps", type=float, help="Override auto-calculated fps")
    parser.add_argument("--max-frames", type=int, default=80, help="Maximum frames to extract (default: 80)")
    parser.add_argument("--no-whisper", action="store_true", help="Disable Whisper transcription fallback")
    parser.add_argument("--whisper", choices=["groq", "openai"], help="Force specific Whisper backend")
    parser.add_argument("--out-dir", type=Path, help="Custom output directory (default: temp)")
    
    args = parser.parse_args()
    
    # 解析时间
    start_sec = parse_time(args.start) if args.start else None
    end_sec = parse_time(args.end) if args.end else None
    
    # 根据 detail 级别调整参数
    if args.detail == "high":
        resolution = args.resolution or 1024
        max_frames = args.max_frames or 120
    elif args.detail == "low":
        resolution = args.resolution or 384
        max_frames = args.max_frames or 40
    elif args.detail == "transcript":
        resolution = 256  # 最小化，主要用转录
        max_frames = 10
    else:  # balanced
        resolution = args.resolution
        max_frames = args.max_frames
    
    # 创建工作目录
    if args.out_dir:
        work_dir = args.out_dir
        work_dir.mkdir(parents=True, exist_ok=True)
    else:
        work_dir = Path(tempfile.mkdtemp(prefix="video_analyzer_"))
    
    print(f"[watch] Working directory: {work_dir}", file=sys.stderr)
    
    # 判断是 URL 还是本地文件
    is_url = args.video.startswith(("http://", "https://"))
    
    try:
        # 1. 下载或定位视频
        if is_url:
            print(f"[watch] Downloading video from {args.video}...", file=sys.stderr)
            download_info = run_download(args.video, work_dir)
            video_path = Path(download_info["video_path"]) if download_info.get("video_path") else None
            subtitle_path = Path(download_info["subtitle_path"]) if download_info.get("subtitle_path") else None
            title = download_info.get("title", "Unknown")
            duration = download_info.get("duration", 0)
        else:
            video_path = Path(args.video)
            if not video_path.exists():
                print(f"[watch] Error: Video file not found: {video_path}", file=sys.stderr)
                return 1
            subtitle_path = None
            title = video_path.stem
            duration = 0
        
        if not video_path:
            print("[watch] Error: Failed to get video path", file=sys.stderr)
            return 1
        
        print(f"[watch] Video: {title}", file=sys.stderr)
        if duration:
            print(f"[watch] Duration: {format_time(duration)}", file=sys.stderr)
        
        # 2. 提取帧
        print(f"[watch] Extracting frames...", file=sys.stderr)
        frames_info = run_frames(
            video_path,
            work_dir,
            fps=args.fps,
            resolution=resolution,
            max_frames=max_frames,
            start=start_sec,
            end=end_sec,
        )
        
        frames = [Path(f) for f in frames_info["frames"]]
        print(f"[watch] Extracted {len(frames)} frames @ {frames_info['fps']:.3f} fps", file=sys.stderr)
        
        # 3. 获取转录
        transcript_text = ""
        transcript_source = None
        
        # 优先使用原生字幕
        if subtitle_path and subtitle_path.exists():
            print(f"[watch] Using native subtitles: {subtitle_path.name}", file=sys.stderr)
            transcript_text = run_transcribe(subtitle_path, start_sec, end_sec)
            transcript_source = "native subtitles"
        
        # 如果没有字幕且允许 Whisper，使用 Whisper
        if not transcript_text and not args.no_whisper:
            print(f"[watch] No native subtitles, trying Whisper...", file=sys.stderr)
            segments, backend = run_whisper(video_path, work_dir, args.whisper)
            if segments and backend:
                # 过滤时间范围
                from transcribe import filter_by_time_range, format_transcript
                filtered = filter_by_time_range(segments, start_sec, end_sec)
                transcript_text = format_transcript(filtered)
                transcript_source = f"{backend} whisper"
        
        # 4. 输出报告
        print()
        print("# Video Analysis Report")
        print()
        print(f"**Source:** {args.video}")
        print(f"**Title:** {title}")
        if duration:
            print(f"**Duration:** {format_time(duration)}")
        if start_sec is not None or end_sec is not None:
            effective_start = start_sec if start_sec is not None else 0
            effective_end = end_sec if end_sec is not None else duration
            print(f"**Range:** {format_time(effective_start)} - {format_time(effective_end)}")
        print()
        
        # 帧信息
        print("## Frames")
        print()
        print(f"_Resolution: {resolution}px, FPS: {frames_info['fps']:.3f}, Total: {len(frames)} frames_")
        print()
        
        for i, frame in enumerate(frames, 1):
            # 计算时间戳
            if frames_info["fps"] > 0:
                timestamp = i / frames_info["fps"]
                if start_sec:
                    timestamp += start_sec
                time_str = format_time(timestamp)
            else:
                time_str = f"frame_{i:04d}"
            
            print(f"### Frame {i} @ {time_str}")
            print(f"![Frame {i}]({frame})")
            print()
        
        # 转录文本
        print("## Transcript")
        print()
        if transcript_text:
            label = transcript_source or "transcription"
            if start_sec is not None or end_sec is not None:
                effective_start = start_sec if start_sec is not None else 0
                effective_end = end_sec if end_sec is not None else duration
                print(f"_Source: {label}. Filtered to {format_time(effective_start)} - {format_time(effective_end)}:_")
            else:
                print(f"_Source: {label}._")
            print()
            print("```")
            print(transcript_text)
            print("```")
        elif args.detail == "transcript":
            print("_No transcript available at transcript detail level. Captions were missing and Whisper was unavailable or failed, so there is no visual fallback here. Re-run with `--detail balanced` for frames._")
        else:
            setup_py = SCRIPT_DIR / "setup.py"
            print(f"_No transcript available — proceed with frames only. Captions were missing and the Whisper fallback was unavailable (no API key set, or `--no-whisper` was used). Run `python {setup_py}` to enable Whisper, then re-run._")
        
        # 用户问题
        if args.question:
            print()
            print("## User Question")
            print()
            print(f"> {args.question}")
            print()
            print("_Please analyze the video frames and transcript above to answer this question._")
        
        print()
        print("---")
        print(f"_Work dir: `{work_dir}` — delete when done._")
        
        return 0
        
    except Exception as e:
        print(f"[watch] Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
