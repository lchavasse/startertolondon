# NeuTTS — In-depth reference

Companion to Part 4 of the main guide. Use this once you've got basic speech
working and want streaming, better voice cloning, or fine-tuning.

Official repo: https://github.com/neuphonic/neutts

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
`neuphonic/neutts-nano-german-q8-gguf`. The codec is always `neuphonic/neucodec`.

---

## Voice cloning — getting good results

Reference clip rules (follow these or quality drops a lot):

- Mono `.wav`, 16–44 kHz
- **3–15 seconds** long
- Clean — minimal background noise
- Natural, continuous speech (no long pauses)

The `.txt` file must contain **exactly** the words spoken in the clip.

### Pre-encode the reference for speed

Encoding the reference takes time. Do it once, save it, reuse it:

```bash
python -m examples.encode_reference --ref_audio myvoice.wav   # makes myvoice.pt
```

Then pass `--ref_codes myvoice.pt` instead of `--ref_audio` — every later
generation is faster because it skips re-encoding.

---

## Streaming (play audio as it generates)

Non-streaming waits for the whole clip, then plays it. Streaming plays in chunks
so speech *starts* sooner — better for assistants and live demos. On a Pi 5 the
nano model is near real-time; if it stutters, fall back to non-streaming.

Streaming needs a GGUF model, a pre-encoded `.pt` reference, and live audio out:

```bash
sudo apt install -y portaudio19-dev
pip install pyaudio

python -m examples.basic_streaming_example \
  --input_text "I am speaking to you in real time from a Raspberry Pi." \
  --ref_codes samples/jo.pt \
  --ref_text  samples/jo.txt
```

(Make `samples/jo.pt` first if it doesn't exist:
`python -m examples.encode_reference --ref_audio samples/jo.wav`)

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
