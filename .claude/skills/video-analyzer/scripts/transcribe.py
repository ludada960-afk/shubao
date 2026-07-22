#!/usr/bin/env python3
"""解析 WebVTT 字幕文件为时间戳转录文本。

处理 YouTube 自动字幕的滚动重复问题（每行出现2-3次）。
去重连续相同的字幕并合并时间范围。
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def parse_timestamp(ts: str) -> float:
    """将 VTT 时间戳转换为秒数。
    
    支持格式：
    - 00:01:30.500
    - 01:30.500
    - 90.5
    """
    ts = ts.strip()
    
    # 纯秒数
    if ":" not in ts:
        return float(ts)
    
    parts = ts.split(":")
    if len(parts) == 3:
        # HH:MM:SS.mmm
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = float(parts[2])
        return hours * 3600 + minutes * 60 + seconds
    elif len(parts) == 2:
        # MM:SS.mmm
        minutes = int(parts[0])
        seconds = float(parts[1])
        return minutes * 60 + seconds
    else:
        raise ValueError(f"Invalid timestamp: {ts}")


def parse_vtt(vtt_path: Path) -> list[dict]:
    """解析 VTT 文件为字幕段落列表。
    
    Returns:
        [{"start": float, "end": float, "text": str}, ...]
    """
    content = Path(vtt_path).read_text(encoding="utf-8", errors="ignore")
    
    # 移除 BOM 和 WEBVTT 头
    content = content.lstrip("\ufeff")
    if content.startswith("WEBVTT"):
        # 找到第一个空行后的内容
        idx = content.find("\n\n")
        if idx != -1:
            content = content[idx + 2:]
    
    segments = []
    
    # 分割成块（由空行分隔）
    blocks = re.split(r"\n\n+", content.strip())
    
    for block in blocks:
        lines = block.strip().split("\n")
        if not lines:
            continue
        
        # 查找时间戳行
        timestamp_line = None
        for i, line in enumerate(lines):
            if "-->" in line:
                timestamp_line = i
                break
        
        if timestamp_line is None:
            continue
        
        # 解析时间戳
        ts_line = lines[timestamp_line]
        match = re.match(r"(.+?)\s*-->\s*(.+?)(?:\s+.+)?$", ts_line)
        if not match:
            continue
        
        try:
            start = parse_timestamp(match.group(1))
            end = parse_timestamp(match.group(2))
        except ValueError:
            continue
        
        # 收集文本行（跳过序号行）
        text_lines = []
        for line in lines[timestamp_line + 1:]:
            line = line.strip()
            if line and not line.isdigit():
                # 移除 VTT 标签如 <c>、<b> 等
                line = re.sub(r"</?[^>]+>", "", line)
                text_lines.append(line)
        
        if text_lines:
            text = " ".join(text_lines)
            segments.append({"start": start, "end": end, "text": text})
    
    # 去重：合并连续相同的文本
    return dedupe_segments(segments)


def dedupe_segments(segments: list[dict]) -> list[dict]:
    """去重连续相同的字幕段落。
    
    YouTube 自动字幕有滚动重复问题，每行会重复2-3次。
    合并相同文本的时间范围。
    """
    if not segments:
        return []
    
    result = []
    for seg in segments:
        if not result:
            result.append(seg)
            continue
        
        last = result[-1]
        
        # 完全相同的文本
        if seg["text"] == last["text"]:
            last["end"] = seg["end"]
            continue
        
        # 当前文本以上一个文本开头（滚动字幕）
        if seg["text"].startswith(last["text"] + " "):
            last["text"] = seg["text"]
            last["end"] = seg["end"]
            continue
        
        result.append(seg)
    
    return result


def filter_by_time_range(
    segments: list[dict],
    start_seconds: float | None,
    end_seconds: float | None,
) -> list[dict]:
    """过滤指定时间范围内的字幕段落。
    
    返回与时间范围有重叠的段落。
    """
    if start_seconds is None and end_seconds is None:
        return segments
    
    lo = start_seconds if start_seconds is not None else float("-inf")
    hi = end_seconds if end_seconds is not None else float("inf")
    
    return [seg for seg in segments if seg["end"] >= lo and seg["start"] <= hi]


def format_transcript(segments: list[dict]) -> str:
    """将字幕段落格式化为可读文本。
    
    格式：[MM:SS] 文本内容
    """
    lines = []
    for seg in segments:
        start = int(seg["start"])
        minutes = start // 60
        seconds = start % 60
        timestamp = f"[{minutes:02d}:{seconds:02d}]"
        lines.append(f"{timestamp} {seg['text']}")
    
    return "\n".join(lines)


def main() -> int:
    import argparse
    
    parser = argparse.ArgumentParser(description="Parse VTT subtitle file")
    parser.add_argument("vtt", type=Path, help="VTT file path")
    parser.add_argument("--start", type=float, help="Start time in seconds")
    parser.add_argument("--end", type=float, help="End time in seconds")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    
    args = parser.parse_args()
    
    segments = parse_vtt(args.vtt)
    segments = filter_by_time_range(segments, args.start, args.end)
    
    if args.json:
        import json
        print(json.dumps(segments, indent=2, ensure_ascii=False))
    else:
        print(format_transcript(segments))
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
