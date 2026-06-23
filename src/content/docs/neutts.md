# NeuTTS — In-depth reference

Companion to Part 4 of the main guide. Use this once you've got basic speech
working and want streaming, better voice cloning, or fine-tuning.

Official repo: https://github.com/neuphonic/neutts

---

## The fast, lean path (read this first)

Three independent choices make NeuTTS go from "unfeasibly slow + 3 GB" to "real-time +
0.9 GB" on a Pi:

1. **Backbone:** `neuphonic/neutts-nano-q4-gguf` (GGUF/llama.cpp) — *not* the PyTorch
   default. Measured ~5–6× faster on CPU (M2: warm RTF **0.46×** vs **2.56×** for torch).
2. **Decoder:** `neuphonic/neucodec-onnx-decoder` — the codec *decoder* alone, exported to
   ONNX. Pair it with a pre-encoded reference and the 2.3 GB voice **encoder** is never
   loaded on the device.
3. **Reference:** pre-encode the voice **on a laptop**, copy the tiny `.pt` to the Pi.

The drop-in command is `examples.onnx_example` (see Part 4 of the quickstart). The rest of
this page is the detail behind those choices.

---

## Choosing a model

Set as `backbone_repo` in Python. On a 4GB Pi, stick to the **nano GGUF** models.

| Model repo | Notes |
|---|---|
| `neuphonic/neutts-nano-q4-gguf` | **Default for the Pi.** Smallest and fastest. |
| `neuphonic/neutts-nano-q8-gguf` | Slightly better quality, a bit heavier. |
| `neuphonic/neutts-nano` | Highest nano quality, no GGUF — slower on CPU. |
| `neuphonic/neutts-air` | ~360M params, best overall quality, heavy for a Pi. |

Other languages exist, e.g. `neuphonic/neutts-nano-french-q4-gguf` and
`neuphonic/neutts-nano-german-q8-gguf`.

> ⚠️ The repo's default backbone in `examples/basic_example.py` is the **PyTorch**
> `neuphonic/neutts-nano` — the slow one. Always pass `--backbone ...-q4-gguf`.

**Codec (the decoder):** two options.

| Codec repo | Use when |
|---|---|
| `neuphonic/neucodec-onnx-decoder` | **Default for the Pi.** Decoder-only ONNX graph; needs a *pre-encoded* reference, never loads the 2.3 GB encoder. Use with `examples.onnx_example`. |
| `neuphonic/neucodec` | Full codec (encoder + decoder). Only needed when you must encode a reference *on this machine* (`examples.basic_example`). |

---

## Voice cloning — getting good results

Reference clip rules (follow these or quality drops a lot):

- Mono `.wav`, 16–44 kHz
- **3–15 seconds** long
- Clean — minimal background noise
- Natural, continuous speech (no long pauses)

The `.txt` file must contain **exactly** the words spoken in the clip.

### Encode the reference OFF the Pi

Encoding (voice → codes) is the *only* step that needs the big 2.3 GB `w2v-bert` encoder —
and its output is a **~4 KB tensor of integers** that decodes identically on any machine.
So do it once on a laptop/Mac/GPU box and copy the `.pt` over; the Pi then never downloads
or loads the encoder at all.

```bash
# On your laptop (once per voice):
python -m examples.encode_reference --ref_audio my_voice.wav --output_path my_voice.pt
scp my_voice.pt  pi@raspberrypi.local:~/neutts/samples/
```

On the Pi, pass `--ref_codes my_voice.pt` (with `examples.onnx_example`) — generation skips
re-encoding *and* the encoder never has to exist on the device. The repo already ships
pre-encoded refs (`samples/jo.pt`, `dave.pt`, …) so you can start with zero encoding.

> Building a fleet? Bake the `.pt` files into your Pi image or a shared repo — new Pis need
> only `neutts-nano-q4-gguf` (~190 MB) + `neucodec-onnx-decoder` (~750 MB), no encoder setup.

---

## Streaming (play audio as it generates)

Non-streaming waits for the whole clip, then plays it. Streaming plays in chunks
so speech *starts* sooner — better for assistants and live demos. Only the first
~0.5 s chunk is on the critical path instead of the whole clip.

Streaming **requires a GGUF backbone** (it's asserted — PyTorch can't stream), a
pre-encoded `.pt` reference, and live audio out:

```bash
sudo apt install -y portaudio19-dev
pip install pyaudio

python -m examples.basic_streaming_example \
  --input_text "I am speaking to you in real time from a Raspberry Pi." \
  --ref_codes samples/jo.pt \
  --ref_text  samples/jo.txt \
  --backbone  neuphonic/neutts-nano-q4-gguf \
  --prefill   3
```

> `samples/jo.pt` already ships in the repo. The **first chunk carries the model warmup
> cost**, so keep one process resident for an assistant rather than spawning per utterance.

**If streaming stutters / crackles** on the Pi, per-chunk generation is lagging playback.
`--prefill N` buffers N chunks before playback starts — trading a little startup delay for
gapless audio. Start at `3` and lower it if startup feels sluggish; or drop to `q4` / shorten
the input.

> `--prefill` is a small local patch to `examples/basic_streaming_example.py` — the player
> thread already accepts `prefill_chunks`, it just isn't exposed as a CLI flag yet. Three
> edits: add `prefill=0` to `main(...)`, pass it into the `audio_player_thread(...)` call,
> and add the `--prefill` argparse arg. (Upstream PR welcome.)

---

## Fine-tuning (advanced)

Only needed to teach the model a specific voice/style from a larger dataset. For
most projects, voice cloning above is enough. **Do not fine-tune on the Pi** — do
it on a laptop/GPU machine and copy the result over.

1. Encode your audio with NeuCodec into the same format as the `Emilia-YODAS`
   dataset on Hugging Face (each clip → codec tokens + transcript).
2. Copy and edit `examples/finetune_config.yaml`:
   - Learning rate `1e-5` to `4e-5` (smaller dataset → smaller LR)
   - ~`1000–2000` steps for a ~10-hour dataset
3. Run from the repo root:

   ```bash
   python examples/finetune.py examples/finetune_config.yaml
   ```

To train from scratch instead, set `restore_from: "Qwen/Qwen2.5-0.5B"` and add the
speech tokens to the vocab:

```python
new_tokens = codec_special_tokens + codec_tokens
tokenizer.add_tokens(new_tokens)
model.resize_token_embeddings(len(tokenizer), mean_resizing=False)
```

Full guide: https://github.com/neuphonic/neutts/blob/main/TRAINING.md
