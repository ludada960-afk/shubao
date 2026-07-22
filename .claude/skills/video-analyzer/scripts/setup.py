#!/usr/bin/env python3
"""视频分析器的设置和预检查。

模式：
  setup.py --check      静默预检查。就绪返回 0，失败返回 2/3/4。
  setup.py --json       机器可读状态供 Claude 解析。
  setup.py              安装程序。自动安装依赖、创建 .env、标记完成。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path


CONFIG_DIR = Path.home() / ".config" / "watch"
CONFIG_FILE = CONFIG_DIR / ".env"


def check_ffmpeg() -> bool:
    """检查 ffmpeg 是否安装。"""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_yt_dlp() -> bool:
    """检查 yt-dlp 是否安装。"""
    try:
        result = subprocess.run(
            ["yt-dlp", "--version"],
            capture_output=True,
            timeout=5,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def check_python_deps() -> bool:
    """检查 Python 依赖。"""
    try:
        import urllib.request
        return True
    except ImportError:
        return False


def have_api_key() -> tuple[bool, str | None]:
    """检查是否有 API 密钥。"""
    env_vars = {}
    
    # 从配置文件读取
    if CONFIG_FILE.exists():
        content = CONFIG_FILE.read_text(encoding="utf-8")
        for line in content.split("\n"):
            line = line.strip()
            if line and "=" in line and not line.startswith("#"):
                key, _, value = line.partition("=")
                env_vars[key.strip()] = value.strip()
    
    # 从环境变量读取
    env_vars.update(os.environ)
    
    if "GROQ_API_KEY" in env_vars:
        return True, "groq"
    if "OPENAI_API_KEY" in env_vars:
        return True, "openai"
    
    return False, None


def install_ffmpeg() -> bool:
    """尝试安装 ffmpeg。"""
    print("[setup] ffmpeg not found. Attempting to install...")
    
    # macOS
    if sys.platform == "darwin":
        try:
            subprocess.run(["brew", "install", "ffmpeg"], check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("[setup] Please install ffmpeg manually: brew install ffmpeg")
            return False
    
    # Windows
    elif sys.platform == "win32":
        print("[setup] Please install ffmpeg manually from https://ffmpeg.org/download.html")
        print("[setup] Or use: winget install Gyan.FFmpeg")
        return False
    
    # Linux
    else:
        print("[setup] Please install ffmpeg using your package manager:")
        print("  Ubuntu/Debian: sudo apt install ffmpeg")
        print("  Fedora: sudo dnf install ffmpeg")
        print("  Arch: sudo pacman -S ffmpeg")
        return False


def install_yt_dlp() -> bool:
    """尝试安装 yt-dlp。"""
    print("[setup] yt-dlp not found. Attempting to install...")
    
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "yt-dlp"],
            check=True,
        )
        return True
    except subprocess.CalledProcessError:
        print("[setup] Failed to install yt-dlp. Please install manually:")
        print(f"  {sys.executable} -m pip install yt-dlp")
        return False


def scaffold_config() -> bool:
    """创建配置文件。"""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    
    if CONFIG_FILE.exists():
        return False
    
    config_content = """# Video Analyzer Configuration
# Add your Whisper API key here (optional)

# Groq API key (preferred - cheaper, faster)
# Get one at: console.groq.com/keys
# GROQ_API_KEY=your_key_here

# OpenAI API key (fallback)
# Get one at: platform.openai.com/api-keys
# OPENAI_API_KEY=your_key_here

# Setup marker
SETUP_COMPLETE=false
"""
    
    CONFIG_FILE.write_text(config_content, encoding="utf-8")
    
    # 设置权限（Unix）
    try:
        os.chmod(CONFIG_FILE, 0o600)
    except Exception:
        pass
    
    return True


def write_setup_complete():
    """标记设置完成。"""
    if not CONFIG_FILE.exists():
        return
    
    content = CONFIG_FILE.read_text(encoding="utf-8")
    content = content.replace("SETUP_COMPLETE=false", "SETUP_COMPLETE=true")
    CONFIG_FILE.write_text(content, encoding="utf-8")


def cmd_check() -> int:
    """静默预检查。"""
    if not check_ffmpeg():
        return 2
    if not check_yt_dlp():
        return 3
    if not check_python_deps():
        return 4
    return 0


def cmd_json() -> int:
    """机器可读状态。"""
    status = {
        "ffmpeg": check_ffmpeg(),
        "yt_dlp": check_yt_dlp(),
        "python_deps": check_python_deps(),
        "api_key": have_api_key()[0],
        "config_file": str(CONFIG_FILE),
    }
    print(json.dumps(status, indent=2))
    return 0


def cmd_install() -> int:
    """交互式安装。"""
    print("=" * 50)
    print("Video Analyzer Setup")
    print("=" * 50)
    print()
    
    # 检查 ffmpeg
    if check_ffmpeg():
        print("[✓] ffmpeg is installed")
    else:
        print("[✗] ffmpeg is not installed")
        if not install_ffmpeg():
            print("\n[setup] Please install ffmpeg manually and run setup again.")
            return 2
        print("[✓] ffmpeg installed successfully")
    
    # 检查 yt-dlp
    if check_yt_dlp():
        print("[✓] yt-dlp is installed")
    else:
        print("[✗] yt-dlp is not installed")
        if not install_yt_dlp():
            print("\n[setup] Please install yt-dlp manually and run setup again.")
            return 3
        print("[✓] yt-dlp installed successfully")
    
    # 检查 Python 依赖
    if check_python_deps():
        print("[✓] Python dependencies OK")
    else:
        print("[✗] Python dependencies missing")
        return 4
    
    print()
    
    # 创建配置文件
    created = scaffold_config()
    if created:
        print(f"[setup] Created config file: {CONFIG_FILE}")
    else:
        print(f"[setup] Config file exists: {CONFIG_FILE}")
    
    # 检查 API 密钥
    has_key, backend = have_api_key()
    if has_key:
        write_setup_complete()
        print(f"[setup] API key found: {backend}")
        print("[setup] Setup complete! Video analyzer is ready to use.")
        return 0
    
    print()
    print("[setup] One step left: Add a Whisper API key (optional)")
    print()
    print("  Edit the config file and add either:")
    print("    GROQ_API_KEY=...    (preferred - cheaper, faster)")
    print("    OPENAI_API_KEY=...  (fallback)")
    print()
    print("  Without a key, video analyzer still works but videos")
    print("  without native captions will be analyzed using frames only.")
    print()
    print(f"  Config file location: {CONFIG_FILE}")
    
    return 0


def main() -> int:
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        if arg == "--check":
            return cmd_check()
        if arg == "--json":
            return cmd_json()
    
    return cmd_install()


if __name__ == "__main__":
    raise SystemExit(main())
