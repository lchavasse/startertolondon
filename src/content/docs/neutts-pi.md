# NeuTTS on a Raspberry Pi 5 — fast on-device setup (validated recipe)

A tested, copy-paste path to get **Neuphonic NeuTTS** running well on a Raspberry Pi 5.
Follow top to bottom — every step here was actually needed; the gotchas are inline.
Safe to hand to an AI agent: the commands are sequential and deterministic.

> **What to expect (be realistic).** On a Pi 5, `nano-q4` runs at **~1.3–1.6× real-time**
> (≈1.3–1.6 s of compute per 1 s of audio) with **~1.2–1.4 s to first audio**. It is **not**
> faster than real-time, but it's responsive enough for short replies. Keep responses short.

---

## 0. Hardware

- Raspberry Pi 5, **official 27 W PSU** (a weak supply browns out and corrupts installs).
- **Active cooler strongly recommended** — without it, back-to-back replies heat the chip past
  ~82 °C and it throttles below 2.4 GHz, getting slower over a session.
- A **USB speaker** for output (see §5 for the ALSA gotcha).

## 1. System dependencies

```bash
sudo apt update
sudo apt install -y espeak-ng libopenblas-dev python3-venv python3-full python3-dev \
                    cmake build-essential ffmpeg git
```

## 2. Python env + install (order matters)

```bash
python3 -m venv ~/tts
source ~/tts/bin/activate
mkdir -p ~/tmp_build && export TMPDIR=~/tmp_build   # build temp on disk, not the small /tmp RAM-disk

# CPU-only PyTorch FIRST (avoids pulling huge CUDA wheels)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# NeuTTS with the GGUF backbone (llama.cpp) + the ONNX decoder
CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS" pip install "neutts[llama,onnx]" soundfile
```

## 3. Get the code + a reference voice

```bash
git clone https://github.com/neuphonic/neutts.git
cd neutts          # gives examples/ and samples/ (incl. the pre-encoded samples/jo.pt)
```

## 4. The fast path — verify it works

The two choices that make NeuTTS usable on a Pi:
1. **GGUF backbone** `neuphonic/neutts-nano-q4-gguf` — **not** the PyTorch default (`neutts-nano`),
   which is ~5–6× slower on CPU. (This is the #1 reason people find NeuTTS "too slow" on a Pi.)
2. **ONNX decoder + pre-encoded reference** — never loads the 2.3 GB `w2v-bert` encoder.

```bash
python -m examples.onnx_example \
  --input_text "Hello from a Raspberry Pi." \
  --ref_codes samples/jo.pt \
  --ref_text samples/jo.txt \
  --backbone neuphonic/neutts-nano-q4-gguf
```
> First run downloads ~0.9 GB of models (one-time). **Don't** set `HF_HUB_OFFLINE=1` with a
> GGUF backbone — the loader still pings Hugging Face and errors out offline.

## 5. Audio output — the ALSA card-numbering trap

`aplay -l` shows your cards. **Card *numbers* are not stable across reboots** (a USB speaker can
move from card 2 to card 0), so never hardcode `hw:2,0`. Use the stable **card id** (in brackets
in `cat /proc/asound/cards`, e.g. `Audio` for many USB DACs).

Make the USB speaker the default output via a resampling `plug` (NeuTTS outputs 24 kHz; most USB
DACs want 48 kHz):

```bash
# Find your card id:
cat /proc/asound/cards          # note the [id] of your USB speaker, e.g. "Audio"

# Route default -> USB speaker by ID (replace "Audio" with your id):
cat > ~/.asoundrc <<'EOF'
pcm.!default { type plug; slave.pcm "hw:Audio,0" }
ctl.!default { type hw; card Audio }
EOF

# Unmute / set volume on that card:
amixer -c Audio sset PCM 100% unmute

# Test (you should hear it):
aplay output.wav
```

## 6. Performance tuning (the changes that actually helped)

```bash
# Pin all cores to max clock (default 'ondemand' idles at 1.8 GHz and ramps with lag).
# NOTE: resets on reboot — see "make persistent" below.
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

**Threads:** `llama-cpp-python` defaults to `cpu_count()//2` = **2 of 4 cores**, and NeuTTS doesn't
override it. Force all cores from your own script with a tiny monkeypatch (no need to edit the
installed package) — included in the harness below.

**Make the governor persistent (optional):**
```bash
sudo apt install -y cpufrequtils
echo 'GOVERNOR="performance"' | sudo tee /etc/default/cpufrequtils
sudo systemctl restart cpufrequtils
```

## 7. A resident speak/chat harness

Loading the model takes ~10 s, so keep it **resident** and reuse it. Save as `~/neutts/say.py`:

```python
import os, sys, subprocess, tempfile
# --- force all CPU cores (llama-cpp defaults to half) ---
import llama_cpp
_orig = llama_cpp.Llama.__init__
def _patched(self, *a, **k):
    k.setdefault("n_threads", os.cpu_count())
    return _orig(self, *a, **k)
llama_cpp.Llama.__init__ = _patched

import time, torch, soundfile as sf
from neutts import NeuTTS

VOICE = os.environ.get("VOICE", "samples/jo")           # full reference (best quality)
ref = torch.load(VOICE + ".pt"); rt = open(VOICE + ".txt").read().strip()

print("loading model (~10s)...", flush=True)
tts = NeuTTS(backbone_repo="neuphonic/neutts-nano-q4-gguf", backbone_device="cpu",
             codec_repo="neuphonic/neucodec-onnx-decoder", codec_device="cpu")

def say(text):
    t0 = time.perf_counter()
    wav = tts.infer(text, ref, rt)                       # batch generate (see note below)
    gen = time.perf_counter() - t0
    f = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    sf.write(f, wav, 24000)
    subprocess.run(["aplay", "-q", f])                   # plays to ALSA default (the USB speaker)
    os.unlink(f)
    dur = len(wav) / 24000
    print(f"  [gen {gen:.2f}s | audio {dur:.2f}s | RTF {gen/dur:.2f}x]", flush=True)

say("Warming up.")                                       # first call is slowest
print("\nType text, Enter to speak (Ctrl-D / 'quit' to exit)\n", flush=True)
while True:
    try: line = input("> ").strip()
    except EOFError: break
    if line in ("quit", "exit"): break
    if line: say(line)
```

Run it:
```bash
cd ~/neutts && source ~/tts/bin/activate
python say.py
```

> **Why batch, not streaming?** On the Pi, NeuTTS streaming **stutters** — generation is slower
> than real-time (RTF > 1), so the playback buffer drains mid-sentence, and the incremental ONNX
> decode adds overhead that makes streaming *heavier* overall. Generate-then-play (above) sounds
> clean. Keep replies short and it feels responsive.

## 8. Clone your own voice — do it OFF the Pi

Encoding a voice needs the 2.3 GB `w2v-bert` encoder, which is heavy on a Pi. Encode on a
laptop/desktop and copy the tiny (~4 KB) `.pt` over:

```bash
# On a laptop, inside the same venv + neutts repo:
python -m examples.encode_reference --ref_audio my_voice.wav --output_path my_voice.pt
scp my_voice.{pt,txt} pi@raspberrypi.local:~/neutts/samples/
# On the Pi:  VOICE=samples/my_voice python say.py
```
Reference clip rules: mono `.wav`, 16–44 kHz, **3–15 s**, clean speech; the `.txt` must be the
exact words spoken.

---

## What we tried that did NOT help (so you can skip it)

- **Shorter reference clip** (to cut the per-reply lead-in): saved only ~0.25 s and cost voice
  fidelity. Stick with the full reference. *(Never truncate the `.pt` codes directly — it desyncs
  from the transcript and the model rambles; re-encode a shorter clip if you must.)*
- **Streaming** (§7): stutters on the Pi; batch is better.
- **Disabling the Perth watermark:** it's only ~0.1 s — not worth it.

## Quick troubleshooting

| Symptom | Fix |
|---|---|
| Painfully slow / not near real-time | You're on the PyTorch backbone — use `--backbone neuphonic/neutts-nano-q4-gguf` + `examples.onnx_example`. |
| "Plays" but no sound | ALSA card renumbered — set `~/.asoundrc` to the stable `hw:<id>,0` (§5), not a card number. |
| `espeak` / phonemizer error | `sudo apt install espeak-ng`. |
| Gets slower over a long session | Thermal throttling — fit an active cooler; check `vcgencmd get_throttled` (`0x0` = healthy). |
| Offline run errors on a GGUF repo | Don't set `HF_HUB_OFFLINE=1` with GGUF backbones. |

See also the [NeuTTS reference](NEUTTS_DETAILED.md) for models, voice cloning and fine-tuning.
