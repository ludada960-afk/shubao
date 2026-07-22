#!/usr/bin/env python3
"""下载视频和字幕的 yt-dlp 包装器。

支持 Bilibili、YouTube 等平台。
优先下载原生字幕，支持自动字幕回退。
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def run_yt_dlp(url: str, out_dir: Path) -> dict:
    """使用 yt-dlp 下载视频和字幕。
    
    Returns:
        dict: 包含 video_path, subtitle_path, title, duration 等信息
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # 输出文件模板
    output_template = str(out_dir / "%(title)s.%(ext)s")
    
    # 基础命令
    cmd = [
        "yt-dlp",
        "--no-warnings",
        "--no-playlist",
        "--format", "best[height<=720]/best",  # 限制分辨率以节省带宽
        "--output", output_template,
        "--print", "after_move:filepath",  # 打印最终文件路径
        "--print", "after_move:title",
        "--print", "after_move:duration",
        "--print", "after_move:webpage_url",
    ]
    
    # 字幕下载选项
    subtitle_langs = ["zh-CN", "zh-TW", "zh-Hans", "zh-Hant", "zh", "en", "ja", "ko"]
    cmd.extend([
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs", ",".join(subtitle_langs),
        "--convert-subs", "vtt",
        "--skip-download",  # 先只下载字幕信息
    ])
    
    cmd.append(url)
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore"
        )
        
        if result.returncode != 0:
            print(f"[download] yt-dlp error: {result.stderr}", file=sys.stderr)
            # 尝试不下载字幕，只获取信息
            return _try_fallback(url, out_dir)
        
        lines = result.stdout.strip().split("\n")
        info = {
            "url": url,
            "video_path": None,
            "subtitle_path": None,
            "title": None,
            "duration": None,
        }
        
        # 解析输出
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if info["video_path"] is None and not line.startswith("["):
                info["video_path"] = line
            elif info["title"] is None:
                info["title"] = line
            elif info["duration"] is None:
                try:
                    info["duration"] = float(line)
                except ValueError:
                    pass
        
        # 查找下载的字幕文件
        if info["video_path"]:
            video_path = Path(info["video_path"])
            base_name = video_path.stem
            
            # 查找各种语言的字幕
            for lang in subtitle_langs:
                vtt_path = out_dir / f"{base_name}.{lang}.vtt"
                if vtt_path.exists():
                    info["subtitle_path"] = str(vtt_path)
                    info["subtitle_lang"] = lang
                    break
                
                # 自动字幕
                auto_vtt = out_dir / f"{base_name}.{lang}.auto.vtt"
                if auto_vtt.exists():
                    info["subtitle_path"] = str(auto_vtt)
                    info["subtitle_lang"] = f"{lang}-auto"
                    break
        
        return info
        
    except FileNotFoundError:
        print("[download] yt-dlp not found. Please install: pip install yt-dlp", file=sys.stderr)
        raise SystemExit(1)
    except Exception as e:
        print(f"[download] error: {e}", file=sys.stderr)
        return _try_fallback(url, out_dir)


def _try_fallback(url: str, out_dir: Path) -> dict:
    """尝试仅下载视频（无字幕）。"""
    output_template = str(out_dir / "%(title)s.%(ext)s")
    
    cmd = [
        "yt-dlp",
        "--no-warnings",
        "--no-playlist",
        "--format", "best[height<=720]/best",
        "--output", output_template,
        "--print", "after_move:filepath",
        "--print", "after_move:title",
        "--print", "after_move:duration",
        url,
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
        
        if result.returncode != 0:
            print(f"[download] fallback error: {result.stderr}", file=sys.stderr)
            return {"url": url, "error": result.stderr}
        
        lines = result.stdout.strip().split("\n")
        info = {"url": url, "video_path": None, "subtitle_path": None, "title": None, "duration": None}
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if info["video_path"] is None and not line.startswith("["):
                info["video_path"] = line
            elif info["title"] is None:
                info["title"] = line
            elif info["duration"] is None:
                try:
                    info["duration"] = float(line)
                except ValueError:
                    pass
        
        return info
        
    except Exception as e:
        return {"url": url, "error": str(e)}


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: download.py <url> <out-dir>", file=sys.stderr)
        return 2
    
    url = sys.argv[1]
    out_dir = Path(sys.argv[2])
    
    info = run_yt_dlp(url, out_dir)
    print(json.dumps(info, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
