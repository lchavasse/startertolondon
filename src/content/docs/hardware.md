# Hardware reference — sensors, servos, audio & extras

Companion to the main guide. This lists every component in the kit, what it's
for, how it connects to a **Raspberry Pi 5**, the library to use, the gotchas,
and a link to its spec.

> Grab parts from the shared bins. Servos, jumper wires, breadboards and screws
> are plentiful — sensors, amps and the cool extras are limited, so share them.
> If your project needs something that isn't here, ask the team — we'll see what
> we can do.

---

## ⚠️ Read this first — the one rule that matters

**Never connect 5V — or any external/servo power supply — to the Pi's GPIO pins.**
This is the single fastest way to kill a Raspberry Pi. The GPIO pins are **3.3V
logic only**; feeding 5V or motor power straight into them will fry the board.
Power servos and motors from their **own** supply, and only ever share a **ground**
with the Pi. If you're unsure which pin is which, check before you connect.

A few more things that save time:

- **Enable I2C once** — most sensors here use it: `sudo raspi-config` →
  *Interface Options → I2C → Enable*, then `sudo apt install -y i2c-tools` and
  list connected devices with `i2cdetect -y 1`.
- **Audio: start with Bluetooth.** The Pi 5 has no headphone jack, but it has
  Bluetooth — pair a BT speaker or headset from the desktop menu to get sound out
  (and a mic in) with zero wiring. The wired MAX98357 amp below is the step-up.
- **Servos: start with the small SG90s**, not the heavy MG996R (more on this
  below).

---

## Quick reference

| Component | Qty | Connects via | Works on Pi 5? |
|---|---|---|---|
| MG996R metal-gear servo | 4 | PWM (via PCA9685) | Yes |
| Miuzei 9g micro servo | 10 | PWM (via PCA9685) | Yes |
| SG90 9g micro servo | 10 | PWM (via PCA9685) | Yes |
| PCA9685 16-ch servo driver | 3 | I2C | Yes — use this to drive servos |
| MAX98357 I2S amplifier | 2 | I2S (audio out) | Yes |
| 3W 4Ω speaker | 4 | wired to MAX98357 | Yes |
| INMP441 MEMS mic | 4 | I2S (audio in) | Advanced — use USB/Bluetooth first |
| HC-SR04 ultrasonic distance | 5 | GPIO (needs divider) | Yes, with caveat |
| VL53L0X laser distance (ToF) | 5 | I2C | Yes — preferred sensor |
| 0.96" / 0.91" OLED display | 4 / 2 | I2C | Yes |
| USB-C PD trigger board | 5 | power | Yes — for servo power |
| Breadboards, jumpers, wire, screws | many | — | — |

---

## Servos (MG996R, Miuzei 9g, SG90)

Three types: **MG996R** (big, strong metal-gear, ~10 kg·cm) for joints that need
torque; **SG90 / Miuzei 9g** (small, light) for fingers, sensors, light arms.

**Start with the SG90 / 9g servos.** They're light, draw little current, and are
the easiest to get moving. Only reach for the MG996R when you genuinely need the
torque — and always give it the external supply described below.

**Drive them through the PCA9685, not the Pi's GPIO directly.** The PCA9685 is a
16-channel PWM driver: one I2C connection to the Pi controls up to 16 servos, with
clean timing and separate power.

Wiring:
- PCA9685 `VCC`, `GND`, `SDA`, `SCL` → Pi 3.3V, GND, SDA (GPIO 2), SCL (GPIO 3)
- Servos plug onto the PCA9685's 3-pin headers (brown=GND, red=V+, orange=signal)
- PCA9685 screw terminal `V+` / `GND` → **external 5–6V supply** (see Power below)
- **Tie all grounds together** (Pi, PCA9685, power supply)

```bash
pip install adafruit-circuitpython-servokit
```

```python
from adafruit_servokit import ServoKit
kit = ServoKit(channels=16)
kit.servo[0].angle = 0      # servo on channel 0
kit.servo[0].angle = 90
kit.servo[0].angle = 180
```

> **Never power more than one or two servos from the Pi itself** — especially the
> MG996R, which can pull ~2.5A when it stalls. Use the external supply on the
> PCA9685.

Specs: [MG996R datasheet](https://components101.com/motors/mg996r-servo-motor-datasheet) ·
[SG90 datasheet](https://components101.com/motors/servo-motor-basics-pinout-datasheet) ·
[PCA9685 guide (Adafruit)](https://learn.adafruit.com/16-channel-pwm-servo-driver)

---

## Power (USB-C PD trigger boards)

Servos need their own 5–6V power — don't take it from the Pi. The **USB-C PD
trigger** boards pull a chosen voltage from any USB-C PD charger or power bank.
Set the board to **5V** and wire its output to the PCA9685's `V+`/`GND` screw
terminals. This gives the servos a strong, separate supply.

> Set the output voltage on the board (solder pad / jumper) **before** connecting
> servos — confirm it reads ~5V with a multimeter. Common-ground it with the Pi.

Spec: [USB-C PD trigger boards explained](https://www.tindie.com/products/lcsc/usb-c-pd-trigger-board/)

---

## Audio out (Bluetooth first, then MAX98357 + speaker)

The Pi 5 has no headphone jack. **Easiest path: a Bluetooth speaker.** Pair one
from the Bluetooth icon in the top bar, select it as the output device, and play
with a PipeWire-aware player like `ffplay -nodisp -autoexit output.wav` or
`mpv output.wav`. (Plain `aplay` only reaches HDMI/wired devices, not Bluetooth.)

**Wired step-up: the MAX98357 amplifier.** It takes I2S digital audio from the Pi
and drives a **4Ω speaker** directly — louder and lower-latency than Bluetooth,
and no pairing.

Wiring:
- `LRC` → GPIO 19, `BCLK` → GPIO 18, `DIN` → GPIO 21
- `VIN` → 5V, `GND` → GND
- Speaker `+`/`–` → MAX98357 screw terminals

Enable it: add to `/boot/firmware/config.txt`:

```
dtparam=i2s=on
dtoverlay=max98357a
```

Reboot. It appears as an audio output device, and `aplay output.wav` (from the
TTS section) plays through the speaker.

Spec: [MAX98357 guide (Adafruit)](https://learn.adafruit.com/adafruit-max98357-i2s-class-d-mono-amp)

---

## Microphone — start simple, INMP441 is advanced

For getting speech-to-text working quickly, use the easiest mic you can:

- **A USB microphone or USB sound card** — plug-and-play. The Vosk code in the
  main guide works with it unchanged.
- **A Bluetooth headset** — pair it and it provides both mic in and audio out.

The kit's **INMP441** mics are **I2S**, which takes extra setup on the Pi 5 (I2S
audio *input* needs device-tree config and is fiddly). They're worth it later, and
they're a perfect match for an **ESP32 / Seeed XIAO Sense** — the natural home for
these "for ESP32" mics — which can stream audio to the Pi over Wi-Fi. Leave them
for once your core demo works.

Spec: [INMP441 datasheet](https://invensense.tdk.com/wp-content/uploads/2015/02/INMP441.pdf)

---

## Distance sensors (VL53L0X and HC-SR04)

Two kinds. **Prefer the VL53L0X on the Pi** — it's I2C, runs at 3.3V natively, and
needs no extra parts.

**VL53L0X** (laser time-of-flight, up to ~2m):
- `VIN`→3.3V, `GND`→GND, `SDA`→GPIO 2, `SCL`→GPIO 3

```bash
pip install adafruit-circuitpython-vl53l0x
```

```python
import board, adafruit_vl53l0x
i2c = board.I2C()
sensor = adafruit_vl53l0x.VL53L0X(i2c)
print(sensor.range, "mm")
```

**HC-SR04** (ultrasonic, cheap and chunky): works, but its `ECHO` pin outputs
**5V**, which can damage a 3.3V GPIO. You must build a **voltage divider** on
ECHO (e.g. 1kΩ + 2kΩ resistors) — **note: resistors aren't in the kit**, so the
VL53L0X is the lower-friction choice. With a divider in place:

```python
from gpiozero import DistanceSensor
sensor = DistanceSensor(echo=24, trigger=23)  # echo via voltage divider
print(sensor.distance * 100, "cm")
```

Specs: [VL53L0X (Adafruit)](https://learn.adafruit.com/adafruit-vl53l0x-micro-lidar-distance-sensor-breakout) ·
[HC-SR04 datasheet](https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf)

---

## OLED displays (0.96" 128×64 and 0.91" 128×32)

Tiny I2C screens — great for showing status, sensor readings, or transcribed
text. Both are SSD1306/SSD1315-compatible.

- `VCC`→3.3V, `GND`→GND, `SDA`→GPIO 2, `SCL`→GPIO 3 (default I2C address `0x3C`)

```bash
pip install luma.oled
```

```python
from luma.core.interface.serial import i2c
from luma.oled.device import ssd1306
from luma.core.render import canvas

device = ssd1306(i2c(port=1, address=0x3C))
with canvas(device) as draw:
    draw.text((0, 0), "Hello hackathon", fill="white")
```

Spec: [Monochrome OLED guide (Adafruit)](https://learn.adafruit.com/monochrome-oled-breakouts)

---

## Prototyping bits

- **DuPont jumper wires** (M-M, M-F, F-F) — connect modules to the Pi's GPIO and
  to breadboards. M-F are the ones you'll use most for Pi → breadboard.
- **SYB-170 mini breadboards** — solderless; build a circuit without soldering.
- **24 AWG silicone hookup wire** — for speaker leads and tidier permanent runs.
- **M3/M4 screw kit** — mounting boards, servos, and 3D-printed parts. MG996R
  brackets and most HATs use M2.5/M3.
- **Gaffer tape** — the universal hackathon structural material.

---

## Cool extras (help yourself, limited supply)

- **Waveshare RoArm (RoArm-M3)** — a Wi-Fi-controlled robotic arm. It runs its own
  web server and takes **JSON commands over HTTP**, so the Pi can drive it over
  the network without any wiring. Great for "LLM/voice → physical action" demos.
  [Waveshare RoArm-M3 wiki](https://www.waveshare.com/wiki/RoArm-M3)
- **Seeed Studio XIAO ESP32-S3 Sense** — a thumbnail-sized board with a **camera
  and microphone** built in. Perfect as a wireless sensor/mic satellite that
  feeds the Pi (and the natural home for those INMP441 I2S mics).
  [Seeed XIAO ESP32-S3 Sense wiki](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)

> Confirm exact model numbers on the boards themselves before deep-diving — the
> "Sense" chip and RoArm variant determine which SDK/wiki page applies.

---

## Where things plug in (Pi 5 GPIO quick map)

Most modules here share the **I2C bus**, so they can coexist on the same pins:

- **3.3V** → pin 1 · **5V** → pin 2/4 · **GND** → pin 6 (and others)
- **I2C:** SDA → GPIO 2 (pin 3), SCL → GPIO 3 (pin 5) — PCA9685, VL53L0X, OLEDs
- **I2S (audio out):** BCLK → GPIO 18, LRC → GPIO 19, DIN → GPIO 21 — MAX98357

Full pinout: https://pinout.xyz
