#!/usr/bin/env python3
"""使用 Groq 或 OpenAI Whisper API 转录音频。

策略：提取音频（单声道 16kHz mp3，小文件），上传到配置了密钥的 API。
返回与 transcribe.parse_vtt 相同格式的段落，以便管道其余部分统一处理。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


# API 上传限制（25MB）
MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def load_api_key() -> tuple[str | None, str | None]:
    """加载 API 密钥。
    
    优先使用 Groq（更快更便宜），然后是 OpenAI。
    从 ~/.config/watch/.env 或当前目录 .env 读取。
    
    Returns:
        (api_key, backend): backend 是 "groq" 或 "openai"
    """
    env_paths = [
        Path.home() / ".config" / "watch" / ".env",
        Path(".env"),
    ]
    
    env_vars = {}
    for env_path in env_paths:
        if env_path.exists():
            content = env_path.read_text(encoding="utf-8")
            for line in content.split("\n"):
                line = line.strip()
                if line and "=" in line and not line.startswith("#"):
                    key, _, value = line.partition("=")
                    env_vars[key.strip()] = value.strip()
    
    # 也检查环境变量
    env_vars.update(os.environ)
    
    if "GROQ_API_KEY" in env_vars:
        return env_vars["GROQ_API_KEY"], "groq"
    if "OPENAI_API_KEY" in env_vars:
        return env_vars["OPENAI_API_KEY"], "openai"
    
    return None, None


def extract_audio(video_path: Path, output_path: Path) -> Path:
    """提取音频为单声道 16kHz MP3。"""
    cmd = [
        "ffmpeg",
        "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(video_path),
        "-vn",  # 无视频
        "-acodec", "libmp3lame",
        "-ar", "16000",  # 16kHz
        "-ac", "1",  # 单声道
        "-q:a", "4",  # 质量
        str(output_path),
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg audio extraction failed: {result.stderr}")
    
    return output_path


def get_audio_duration(audio_path: Path) -> float:
    """获取音频时长（秒）。"""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "json",
        str(audio_path),
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def split_audio(audio_path: Path, chunks_dir: Path, chunk_duration: float = 600) -> list[Path]:
    """将音频分割成小块（每个约10分钟）。"""
    chunks_dir = Path(chunks_dir)
    chunks_dir.mkdir(parents=True, exist_ok=True)
    
    duration = get_audio_duration(audio_path)
    chunks = []
    
    chunk_num = 0
    start = 0.0
    
    while start < duration:
        end = min(start + chunk_duration, duration)
        chunk_path = chunks_dir / f"chunk_{chunk_num:03d}.mp3"
        
        cmd = [
            "ffmpeg",
            "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(audio_path),
            "-ss", str(start),
            "-t", str(end - start),
            "-c", "copy",
            str(chunk_path),
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            chunks.append(chunk_path)
        
        start = end
        chunk_num += 1
    
    return chunks


def transcribe_with_groq(audio_path: Path, api_key: str) -> list[dict]:
    """使用 Groq Whisper API 转录。"""
    import urllib.request
    import urllib.error
    
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    
    boundary = "----FormBoundary7MA4YWxkTrZu0gW"
    
    # 构建 multipart/form-data
    body = []
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="model"')
    body.append(b"")
    body.append(b"whisper-large-v3")
    
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="response_format"')
    body.append(b"")
    body.append(b"verbose_json")
    
    body.append(f"--{boundary}".encode())
    body.append(f'Content-Disposition: form-data; name="file"; filename="{audio_path.name}"'.encode())
    body.append(b"Content-Type: audio/mpeg")
    body.append(b"")
    body.append(audio_path.read_bytes())
    
    body.append(f"--{boundary}--".encode())
    
    data = b"\r\n".join(body)
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        raise RuntimeError(f"Groq API error: {e.code} - {error_body}")
    
    # 转换为统一格式
    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"].strip(),
        })
    
    return segments


def transcribe_with_openai(audio_path: Path, api_key: str) -> list[dict]:
    """使用 OpenAI Whisper API 转录。"""
    import urllib.request
    import urllib.error
    
    url = "https://api.openai.com/v1/audio/transcriptions"
    
    boundary = "----FormBoundary7MA4YWxkTrZu0gW"
    
    body = []
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="model"')
    body.append(b"")
    body.append(b"whisper-1")
    
    body.append(f"--{boundary}".encode())
    body.append(f'Content-Disposition: form-data; name="file"; filename="{audio_path.name}"'.encode())
    body.append(b"Content-Type: audio/mpeg")
    body.append(b"")
    body.append(audio_path.read_bytes())
    
    body.append(f"--{boundary}--".encode())
    
    data = b"\r\n".join(body)
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        raise RuntimeError(f"OpenAI API error: {e.code} - {error_body}")
    
    # OpenAI 返回简单文本，没有段落信息
    # 我们创建一个单一段落
    text = result.get("text", "").strip()
    if text:
        duration = get_audio_duration(audio_path)
        return [{"start": 0.0, "end": duration, "text": text}]
    return []


def transcribe_video(
    video_path: Path,
    audio_output: Path | None = None,
    backend: str | None = None,
) -> tuple[list[dict], str | None]:
    """转录视频音频。
    
    Args:
        video_path: 视频文件路径
        audio_output: 音频输出路径（可选）
        backend: 强制使用特定后端（"groq" 或 "openai"）
    
    Returns:
        (segments, backend_used): 字幕段落列表和使用的后端
    """
    api_key, detected_backend = load_api_key()
    
    if api_key is None:
        return [], None
    
    if backend is not None:
        # 强制使用指定后端
        if backend == "groq" and "GROQ_API_KEY" in os.environ:
            api_key = os.environ["GROQ_API_KEY"]
        elif backend == "openai" and "OPENAI_API_KEY" in os.environ:
            api_key = os.environ["OPENAI_API_KEY"]
        detected_backend = backend
    
    # 提取音频
    if audio_output is None:
        audio_output = video_path.parent / "audio.mp3"
    
    print(f"[whisper] Extracting audio to {audio_output}...", file=sys.stderr)
    extract_audio(video_path, audio_output)
    
    audio_bytes = audio_output.stat().st_size
    
    # 检查是否需要分块
    if audio_bytes <= MAX_UPLOAD_BYTES:
        print(f"[whisper] Audio: {audio_bytes / 1024:.0f} kB — uploading to {detected_backend}...", file=sys.stderr)
        
        if detected_backend == "groq":
            segments = transcribe_with_openai(audio_output, api_key) if backend == "openai" else transcribe_with_groq(audio_output, api_key)
        else:
            segments = transcribe_with_openai(audio_output, api_key)
    else:
        # 分块处理
        duration = get_audio_duration(audio_output)
        chunk_duration = (MAX_UPLOAD_BYTES / audio_bytes) * duration * 0.9  # 留一些余量
        
        chunks_dir = audio_output.parent / "chunks"
        chunks = split_audio(audio_output, chunks_dir, chunk_duration)
        
        print(f"[whisper] Audio: {audio_bytes / (1024*1024):.1f} MB — splitting into {len(chunks)} chunks...", file=sys.stderr)
        
        segments = []
        time_offset = 0.0
        
        for i, chunk in enumerate(chunks):
            print(f"[whisper] Transcribing chunk {i+1}/{len(chunks)}...", file=sys.stderr)
            
            try:
                if detected_backend == "groq":
                    chunk_segments = transcribe_with_groq(chunk, api_key)
                else:
                    chunk_segments = transcribe_with_openai(chunk, api_key)
                
                # 调整时间戳
                for seg in chunk_segments:
                    seg["start"] += time_offset
                    seg["end"] += time_offset
                
                segments.extend(chunk_segments)
                time_offset += chunk_duration
                
            except Exception as e:
                print(f"[whisper] Chunk {i+1} failed: {e}", file=sys.stderr)
                time_offset += chunk_duration
                continue
    
    print(f"[whisper] Transcribed {len(segments)} segments via {detected_backend}", file=sys.stderr)
    return segments, detected_backend


def main() -> int:
    import argparse
    
    parser = argparse.ArgumentParser(description="Transcribe video using Whisper API")
    parser.add_argument("video", type=Path, help="Video file path")
    parser.add_argument("--audio-out", type=Path, help="Audio output path")
    parser.add_argument("--backend", choices=["groq", "openai"], help="Force specific backend")
    
    args = parser.parse_args()
    
    segments, backend = transcribe_video(args.video, args.audio_out, args.backend)
    
    result = {
        "backend": backend,
        "segments": segments,
    }
    
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
