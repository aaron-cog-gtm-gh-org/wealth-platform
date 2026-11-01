import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const run = (binary, args) => {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 120_000, maxBuffer: 2_000_000 });
  if (result.error || result.status !== 0) {
    throw new Error(`${binary} failed: ${result.error?.message ?? result.stderr?.trim() ?? result.status}`);
  }
  return result.stdout.trim();
};

const safeRecording = (runDir, name) => {
  const full = path.resolve(runDir, name);
  if (!full.startsWith(`${path.resolve(runDir)}${path.sep}`) || !fs.existsSync(full) ||
      !fs.realpathSync(full).startsWith(`${fs.realpathSync(runDir)}${path.sep}`) || !fs.statSync(full).isFile()) {
    throw new Error(`Recording is not a file inside the run: ${name}`);
  }
  return full;
};

export function demoSequence(report) {
  const rows = [...report.baselineRows, ...report.gapTests, ...report.retestRows];
  const sequence = rows.flatMap((row) => (row.recordings ?? []).map((attempt, index) => ({
    id: row.id,
    title: row.title.replace(/^\[?WM-(?:TC|GAP)-\d+\]?\s*/, ''),
    phase: row.phase,
    status: attempt.status,
    attempt: index + 1,
    video: attempt.video
  })));
  if (sequence.length === 0 || sequence.some((clip) => !clip.video)) {
    throw new Error('Every test attempt must have an individual recording before composing the demo video');
  }
  return sequence;
}

export function buildDemoVideo(runDir, output = path.join(runDir, 'full-run.mp4')) {
  const report = JSON.parse(fs.readFileSync(path.join(runDir, 'report.json'), 'utf8'));
  const sequence = demoSequence(report);
  const inputs = sequence.map((clip) => safeRecording(runDir, clip.video));
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'wealth-qa-video-'));
  try {
    const files = [];
    sequence.forEach((clip, index) => {
      const title = path.join(scratch, `${index}-title.txt`);
      const card = path.join(scratch, `${index}-card.mp4`);
      const action = path.join(scratch, `${index}-action.mp4`);
      const words = clip.title.split(/\s+/);
      const titleLines = [''];
      for (const word of words) {
        const last = titleLines.length - 1;
        if (`${titleLines[last]} ${word}`.length > 55) titleLines.push(word);
        else titleLines[last] = `${titleLines[last]} ${word}`.trim();
      }
      fs.writeFileSync(title, `${clip.id}\n${titleLines.join('\n')}\n${clip.phase.toUpperCase()}  ·  Attempt ${clip.attempt}  ·  ${clip.status.toUpperCase()}`);
      run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
        'color=c=0x003168:s=1280x900:r=15:d=2.5', '-vf',
        `drawtext=font='DejaVu Sans':textfile=${title}:expansion=none:fontcolor=white:fontsize=35:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=18`,
        '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p', card]);
      run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputs[index], '-an',
        '-vf', 'scale=1280:900:flags=fast_bilinear,fps=15,format=yuv420p,tpad=stop_mode=clone:stop_duration=1.5',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', action]);
      files.push(card, action);
      process.stdout.write(`Composed ${index + 1}/${sequence.length}: ${clip.id} ${clip.phase}\n`);
    });
    const manifest = path.join(scratch, 'concat.txt');
    fs.writeFileSync(manifest, files.map((file) => `file '${file}'`).join('\n') + '\n');
    const composed = path.join(scratch, 'full-run.mp4');
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0',
      '-i', manifest, '-c', 'copy', '-movflags', '+faststart', composed]);
    const duration = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1', composed]));
    if (!(duration > 0)) throw new Error('The composed video has no playable duration');
    fs.renameSync(composed, output);
    fs.writeFileSync(path.join(runDir, 'demo-manifest.json'), JSON.stringify({ duration, clips: sequence }, null, 2));
    return { output, duration, clips: sequence.length };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
