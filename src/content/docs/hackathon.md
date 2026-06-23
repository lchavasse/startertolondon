# Quickstart — Edge AI on a Raspberry Pi

Everything you need to go from a blank microSD card to running speech, language,
and vision models **on the Pi itself** — no cloud, no API keys.

**Your hardware:** Raspberry Pi 5 (4GB). Some units also have a **Raspberry Pi
AI HAT+ (26 TOPS)** — see Part 8.

Follow the parts in order. Each command is copy-paste. If you've never touched a
Pi before, start at Part 1. Wiring and component details live in the
[hardware reference](HARDWARE_DETAILED.md); the rules, submission and prizes are
on the [rules page](RULES.md).

> **Returning your Pi —** the Raspberry Pis are on loan and must come back at the
> end of the two weeks. The easiest way is to bring yours to **Demo Night (7 Jul)
> at LocalGlobe**. **[Please sign up now →](https://luma.com/awkhqorw)**
>
> **Need a specific part?** If your project needs a component that isn't in the
> kit, speak to the team and we'll see what we can do.

---

## Part 1 — Flash the operating system

You do this once, on your laptop, before the Pi will boot.

1. On your laptop, install **Raspberry Pi Imager**: https://www.raspberrypi.com/software/
2. Put the microSD card into the card reader and plug it into your laptop.
3. Open Imager and set three things:
   - **Choose Device:** Raspberry Pi 5
   - **Choose OS:** Raspberry Pi OS (64-bit)
   - **Choose Storage:** your microSD card (double-check you picked the card, not your hard drive)
4. Click **Next → Edit Settings** and fill in:
   - A **username** and **password** (remember these)
   - Your **Wi-Fi** name and password
   - Tick **Enable SSH** (lets you log in from your laptop later)
5. Click **Write**. It takes a few minutes. When it's done, eject the card.

---

## Part 2 — First boot

1. Put the microSD card into the slot on the underside of the Pi.
2. Connect: monitor (the Pi 5 uses **micro-HDMI** — use the port nearest the USB-C),
   USB keyboard, and mouse.
3. Plug in the USB-C power. The Pi boots automatically.
4. Log in with the username and password you set in Part 1. You'll land on the desktop.

Open a **Terminal** (black icon in the top bar). Everything below happens here.

First, update the system:

```bash
sudo apt update && sudo apt full-upgrade -y
sudo reboot
```

---

## Part 3 — Getting around the Pi

A few things you'll use constantly:

- Run a command: type it, press Enter.
- `sudo` runs a command as administrator (needed to install software).
- Install software: `sudo apt install -y <name>`
- Find your Pi's address (to log in from your laptop): `hostname -I`
- Log in from your laptop instead of using the screen: `ssh <username>@<that-address>`

You're now ready to run AI models. Pick any of the parts below.

---

## Part 4 — Text-to-speech (Neuphonic NeuTTS)

Turns text into a natural voice, and can clone a voice from a short clip. Runs on
the CPU. Repo and full docs: https://github.com/neuphonic/neutts

> **Two things make this fast on a Pi** — skip them and it crawls:
> 1. Use the **quantised GGUF** backbone `neuphonic/neutts-nano-q4-gguf` — *not* the
>    PyTorch default, which is ~5–6× slower on the Pi's CPU.
> 2. Use the **ONNX decoder + a pre-encoded reference** so the Pi never pulls the hidden
>    2.3 GB voice **encoder**. Cuts the model download from ~3 GB to ~0.9 GB.

**Install:**

```bash
sudo apt install -y espeak-ng libopenblas-dev python3-venv python3-full cmake build-essential ffmpeg
python3 -m venv ~/tts
source ~/tts/bin/activate

# Build temp files go to the real disk, not the small /tmp RAM-disk
mkdir -p ~/tmp_build && export TMPDIR=~/tmp_build

# CPU-only PyTorch FIRST, or pip pulls ~1.5 GB of unusable CUDA wheels and fills the disk
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# GGUF backbone (llama-cpp) + ONNX decoder. Compiles llama-cpp — 5–15 min.
CMAKE_ARGS="-DGGML_BLAS=ON -DGGML_BLAS_VENDOR=OpenBLAS" pip install "neutts[llama,onnx]" soundfile
```

> `cmake` / `build-essential` are needed to compile `llama-cpp-python`; `espeak-ng` is
> required by the phonemizer — don't skip them. On flaky Wi-Fi, downloads can stall on
> power-save: `sudo nmcli connection modify "<wifi>" 802-11-wireless.powersave 2`.

**Get the code** (ships sample voices, including the pre-encoded `samples/jo.pt`):

```bash
git clone https://github.com/neuphonic/neutts.git
cd neutts
```

**Make it talk** — GGUF backbone + ONNX decoder + pre-encoded reference:

```bash
python -m examples.onnx_example \
  --input_text "Hello hackathon, I am running on a Raspberry Pi." \
  --ref_codes samples/jo.pt \
  --ref_text samples/jo.txt \
  --backbone neuphonic/neutts-nano-q4-gguf
```

> **First run downloads ~0.9 GB** of models (one-time). Don't add `HF_HUB_OFFLINE=1`
> with a GGUF backbone — the loader still pings Hugging Face and errors out offline.

Play the result:

```bash
aplay output.wav
```

> The Pi 5 has **no headphone jack**, but it has **Bluetooth** — that's the
> easiest speaker. Pair one from the Bluetooth icon in the top bar, select it as
> the output, then play with `ffplay -nodisp -autoexit output.wav` (`aplay` only
> reaches HDMI/wired). For a wired option, use the **MAX98357 amp + speaker** in
> the kit — see the [hardware guide](HARDWARE_DETAILED.md).

**Use your own voice:** record a clean mono `.wav`, 3–15 seconds long, and a `.txt` file
with the exact words spoken. The voice→codes **encoding** step needs the big 2.3 GB
encoder, so **do it on your laptop, not the Pi**, then copy the tiny (~4 KB) result over:

```bash
# On your laptop (once per voice):
python -m examples.encode_reference --ref_audio my_voice.wav --output_path my_voice.pt
scp my_voice.pt  pi@raspberrypi.local:~/neutts/samples/
# On the Pi: pass --ref_codes my_voice.pt to the command above
```

**Want it fast + a typed/voice assistant?** Follow the validated, copy-paste
[NeuTTS on a Pi — fast setup recipe](NEUTTS_PI.md) (performance tuning, the ALSA
gotchas, a resident speak/chat harness, and honest latency expectations).

**Going further** — streaming, the encode-off-Pi workflow, voice cloning,
and fine-tuning are covered in the companion reference:
[`NEUTTS_DETAILED.md`](NEUTTS_DETAILED.md).

---

## Part 5 — A language model (Ollama)

Run a chat LLM locally. Ollama is the easiest way.

**Install and run:**

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama run gemma2:2b
```

First run downloads the model (~1.6GB), then you get a chat prompt. Ask a
question, press Enter. Type `/bye` to exit. Expect roughly **3–5 words per
second** — it's local and free, but not fast.

### Picking a model that fits 4GB of RAM

This is the thing to get right. The Pi has 4GB total and the OS already uses
~1GB, so your model has to fit in the remaining **~2.5GB**. Rule of thumb: a
4-bit model needs about **0.7GB of RAM per billion parameters**, plus a little for
context. So keep to **3B parameters or fewer** — ideally 1–2B:

| Model | Command | RAM | Notes |
|---|---|---|---|
| Gemma 2 2B | `gemma2:2b` | ~1.8GB | Recommended — best quality that fits comfortably. |
| Llama 3.2 1B | `llama3.2:1b` | ~1GB | Fastest, lighter, lower quality. |
| Qwen 2.5 1.5B | `qwen2.5:1.5b` | ~1.3GB | Good middle ground. |

A 7B model needs ~5GB and simply will not load.

> You can't damage the Pi by choosing too big a model. If it runs out of RAM the
> program is just killed, or it slows to a crawl swapping to the SD card. Watch
> live memory in a second terminal with `free -h`, and see a loaded model's size
> with `ollama ps`.

**Call it from Python:**

```bash
pip install ollama
```

```python
import ollama
reply = ollama.chat(model="gemma2:2b",
                    messages=[{"role": "user", "content": "Give me a hackathon idea."}])
print(reply["message"]["content"])
```

---

## Part 6 — Speech-to-text (Vosk)

Turn the microphone into text. Vosk is tiny (~50MB model), runs offline on the
CPU, and transcribes live as you speak — the lowest-resource option for the Pi.

> **Start with the simplest mic.** A **USB microphone** or a **Bluetooth headset**
> is plug-and-play. The kit's INMP441 mics use I2S, which takes extra setup on the
> Pi 5 — leave those for later. See the [hardware guide](HARDWARE_DETAILED.md).

Plug in a USB mic (or pair a Bluetooth headset), then install:

```bash
sudo apt install -y portaudio19-dev
python3 -m venv ~/stt
source ~/stt/bin/activate
pip install vosk sounddevice
```

Download the small English model:

```bash
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip
```

Save this as `listen.py`:

```python
import queue, json, sounddevice as sd
from vosk import Model, KaldiRecognizer

model = Model("vosk-model-small-en-us-0.15")
rec = KaldiRecognizer(model, 16000)
q = queue.Queue()

def callback(data, frames, time, status):
    q.put(bytes(data))

with sd.RawInputStream(samplerate=16000, blocksize=8000, dtype="int16",
                       channels=1, callback=callback):
    print("Speak now (Ctrl+C to stop)...")
    while True:
        if rec.AcceptWaveform(q.get()):
            print(json.loads(rec.Result())["text"])
```

Run it with `python listen.py` and talk — the transcribed text prints out.

> Vosk trades some accuracy for being fast and tiny. If you need higher accuracy
> and don't mind it being slower, swap in `faster-whisper` with the `base.en` model.

---

## Part 7 — Vision (camera + YOLO)

Detect objects in a camera feed. You'll need a **Raspberry Pi Camera Module**
plugged into the **CAM/DISP** ribbon connector (cable contacts face the USB ports).

**Test the camera first:**

```bash
rpicam-hello
```

A preview window should appear. If it does, the camera works.

**Run object detection on a photo:**

```bash
python3 -m venv ~/vision
source ~/vision/bin/activate
pip install ultralytics

rpicam-still -o photo.jpg
yolo predict model=yolo11n.pt source=photo.jpg
```

YOLO labels everything it finds and saves an annotated image (the path is printed
in the output). `yolo11n` is the smallest ("nano") model — the right one for a Pi.

> On the Pi 5 **CPU**, live video detection only manages ~1–2 frames per second.
> For smooth real-time detection, use the AI HAT+ in Part 8.

---

## Part 8 — The AI HAT+ (26 TOPS) — real-time vision

The AI HAT+ is an add-on board with a **Hailo-8 NPU**: a dedicated chip for neural
networks. **Pi 5 only.** It does not make Llama faster — it accelerates **vision**
models (object detection, pose, segmentation, face recognition).

**What it gets you:** the same YOLO detection from Part 7, but at **30+ frames per
second** instead of 1–2, and it can run **several models at once** (e.g. detect
objects *and* track body pose on the same feed) without slowing down. It also
frees up the CPU for the rest of your app.

**Fit the board** (power off first): seat it on the GPIO header with the standoffs,
and connect the small PCIe ribbon cable to the Pi's PCIe port.

**Install the software:**

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y hailo-all
sudo reboot
```

**Check it's detected:**

```bash
hailortcli fw-control identify
```

You should see the Hailo device listed.

**Run real-time detection from the camera:**

```bash
rpicam-hello -t 0 \
  --post-process-file /usr/share/rpi-camera-assets/hailo_yolov8_inference.json
```

A live window opens with boxes drawn around detected objects in real time. For
other models (pose, segmentation) and the exact post-process file names, see the
official guide: https://www.raspberrypi.com/documentation/computers/ai.html

---

## Part 9 — Electronics and sensors

The Pi's **GPIO pins** (the double row along the edge) let it sense and control
the physical world. The easiest library is `gpiozero`, which is pre-installed on
Raspberry Pi OS.

> **Two safety rules:** GPIO pins are **3.3V only** — never feed 5V into one or
> you'll kill the pin. And **don't power motors or many servos from the Pi
> itself** — use a separate battery/power supply and connect the grounds together.

In the kit: **servos** (lots — MG996R, SG90, 9g), a **PCA9685** board to drive
them, **MAX98357 amplifiers + wired speakers**, **VL53L0X** laser and **HC-SR04**
ultrasonic distance sensors, **OLED displays**, **USB-C power boards**,
breadboards, jumper wires and screws. Plus a 3D printer for enclosures.

What each is good for:

- **Servos** — move things: robot arms, pan/tilt mounts, grabbers, dials. **Start
  with the small SG90s** (light, low-current); save the heavier MG996R for when
  you actually need torque. Drive them through the **PCA9685** board (one I2C link
  controls 16 servos) with a separate power supply — never power servos from the
  Pi's pins.
- **Distance sensors** — detect how close something is: obstacle avoidance,
  "someone's approaching" triggers, proximity controls. Use the **VL53L0X**
  (plug-and-play I2C); the HC-SR04 needs an extra resistor divider.
- **OLED displays** — show status, sensor values, or transcribed text on a tiny
  screen.
- **Amplifier + wired speaker** — the **MAX98357** is how you get sound out of the
  jack-less Pi 5 for text-to-speech (Part 4).
- **Microphone** — for speech-to-text (Part 6) use a **USB mic**; the kit's
  INMP441 mics are I2S which requires some setup!
- **3D printing** — enclosures, camera mounts, robot chassis, servo brackets.

> **Full part-by-part wiring, libraries and code — plus spec links and the Pi 5
> gotchas — are in the [hardware guide](HARDWARE_DETAILED.md).** There are also
> some extras to help yourself to (a Wi-Fi **Waveshare RoArm** robotic arm and a
> **Seeed XIAO Sense** camera/mic board) covered there.

---

## What you can build with this

The interesting projects combine the parts above. A few starting points:

- **Talking camera / accessibility aid:** AI HAT+ detects what's in front of the
  camera (Part 8) → the LLM writes a sentence about it (Part 5) → NeuTTS speaks it
  aloud (Part 4).
- **Full voice assistant:** speak a question (Vosk, Part 6) → LLM answers
  (Part 5) → NeuTTS reads it back through a wired speaker (Parts 4 + 9).
- **Smart doorbell:** distance sensor or camera spots a person → LLM greets them →
  speaks the greeting.
- **Voice- or gesture-controlled robot:** spoken commands or pose/distance input
  drive servos (Part 9) — a rover, robot arm, or pan/tilt camera that tracks you.

Rule of thumb: use the **AI HAT+ for anything live and camera-based**, the **CPU
for the LLM, speech-to-text and text-to-speech**, and **GPIO/servos** to make it
move — and let them talk to each other.

---

## Quick troubleshooting

| Problem | Fix |
|---|---|
| Pi won't boot / no display | Use the **micro-HDMI port nearest USB-C**; re-seat the microSD card. |
| `espeak` / phonemizer error in NeuTTS | `sudo apt install espeak-ng` |
| NeuTTS painfully slow / not real-time | You're on the PyTorch backbone — add `--backbone neuphonic/neutts-nano-q4-gguf` and use `examples.onnx_example` (see Part 4). |
| LLM is slow or crashes | Use `llama3.2:1b` instead of `3b`; close other apps. |
| `rpicam-hello` shows no camera | Power off, re-seat the ribbon cable (contacts facing the USB ports). |
| `hailortcli` not found / no device | Re-run `sudo apt install hailo-all`, reboot, check the PCIe cable. |
| Ran out of disk space | Use a 32GB+ microSD card. |
